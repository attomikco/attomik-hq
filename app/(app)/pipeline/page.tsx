"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FilePlus, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  addDays,
  currency,
  currencyCompact,
  dateCompact,
  dateISO,
  nextInvoiceNumber,
} from "@/lib/format";
import { ConfirmDialog } from "@/components/modal";
import {
  OPEN_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGES,
  type Client,
  type Opportunity,
  type OpportunityStage,
  type SettingsMap,
} from "@/lib/types";
import { DEFAULT_PROPOSAL_INTRO } from "@/lib/defaults/proposal-intro";
import OpportunityForm, { type OpportunityDraft } from "./opportunity-form";

const TAB_FILTERS = ["all", "open", "won", "lost"] as const;
type TabFilter = (typeof TAB_FILTERS)[number];

const STAGE_LABEL: Record<OpportunityStage, string> = {
  idea: "Idea",
  qualified: "Qualified",
  discovery: "Discovery",
  proposal_drafted: "Proposal drafted",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

// Stages where it makes sense to convert into a proposal. Excludes the two
// terminal stages (won, lost). The conversion handler itself sets stage to
// proposal_drafted, so showing the button on idea/qualified/discovery is the
// natural funnel entry point; showing it on proposal_drafted/proposal_sent/
// negotiation lets you regenerate if the first attempt was wrong.
const CAN_CONVERT_STAGES: OpportunityStage[] = [
  "idea",
  "qualified",
  "discovery",
  "proposal_drafted",
  "proposal_sent",
  "negotiation",
];

function emptyDraft(): OpportunityDraft {
  return {
    company_name: "",
    contact_name: "",
    contact_email: "",
    stage: "idea",
    source: "",
    estimated_value: "0",
    estimated_phase1_value: "8000",
    estimated_phase2_monthly: "5000",
    estimated_phase: "phase1_phase2",
    next_action: "",
    next_action_date: "",
    notes: "",
    lost_reason: "",
  };
}

function toDraft(o: Opportunity): OpportunityDraft {
  return {
    id: o.id,
    company_name: o.company_name ?? "",
    contact_name: o.contact_name ?? "",
    contact_email: o.contact_email ?? "",
    stage: o.stage,
    source: o.source ?? "",
    estimated_value: String(o.estimated_value ?? 0),
    estimated_phase1_value: String(o.estimated_phase1_value ?? 8000),
    estimated_phase2_monthly: String(o.estimated_phase2_monthly ?? 5000),
    estimated_phase: o.estimated_phase ?? "",
    next_action: o.next_action ?? "",
    next_action_date: o.next_action_date ?? "",
    notes: o.notes ?? "",
    lost_reason: o.lost_reason ?? "",
  };
}

function buildPayload(d: OpportunityDraft, prev: OpportunityStage | null) {
  const phase1 = Number(d.estimated_phase1_value) || 0;
  const phase2 = Number(d.estimated_phase2_monthly) || 0;
  const phase1Counts =
    d.estimated_phase === "phase1_only" || d.estimated_phase === "phase1_phase2";
  const phase2Counts =
    d.estimated_phase === "phase2_only" || d.estimated_phase === "phase1_phase2";
  // Keep legacy estimated_value populated as a phase-aware rollup so any
  // remaining read sites stay coherent with the new split fields.
  const legacyEstimate =
    (phase1Counts ? phase1 : 0) + (phase2Counts ? phase2 * 6 : 0);

  const base: Record<string, unknown> = {
    company_name: d.company_name || null,
    contact_name: d.contact_name || null,
    contact_email: d.contact_email || null,
    stage: d.stage,
    source: d.source || null,
    estimated_value: legacyEstimate,
    estimated_phase1_value: phase1,
    estimated_phase2_monthly: phase2,
    estimated_phase: d.estimated_phase || null,
    next_action: d.next_action || null,
    next_action_date: d.next_action_date || null,
    notes: d.notes || null,
    lost_reason: d.stage === "lost" ? d.lost_reason || null : null,
  };

  // Stamp won_at / lost_at on stage transitions; clear them if leaving the
  // terminal stage. The trigger keeps updated_at fresh for free.
  if (d.stage === "won") {
    if (prev !== "won") base.won_at = new Date().toISOString();
    base.lost_at = null;
  } else if (d.stage === "lost") {
    if (prev !== "lost") base.lost_at = new Date().toISOString();
    base.won_at = null;
  } else {
    base.won_at = null;
    base.lost_at = null;
  }

  return base;
}

function isOpen(stage: OpportunityStage): boolean {
  return OPEN_OPPORTUNITY_STAGES.includes(stage);
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

// Phase-aware contribution helpers: an opportunity only contributes to a
// metric the selected scope actually delivers. A phase1_only deal has no
// MRR contribution; a phase2_only deal has no one-time contribution.
function opportunityMonthlyContribution(opp: Opportunity): number {
  const phase = opp.estimated_phase;
  if (phase === "phase1_phase2" || phase === "phase2_only") {
    return Number(opp.estimated_phase2_monthly) || 0;
  }
  return 0;
}

function opportunityOneTimeContribution(opp: Opportunity): number {
  const phase = opp.estimated_phase;
  if (phase === "phase1_only" || phase === "phase1_phase2") {
    return Number(opp.estimated_phase1_value) || 0;
  }
  return 0;
}

function opportunityValueDisplay(
  opp: Opportunity,
  currencyCode: string,
): string {
  const phase = opp.estimated_phase;
  const p1 = Number(opp.estimated_phase1_value) || 0;
  const p2 = Number(opp.estimated_phase2_monthly) || 0;
  if (phase === "phase1_only") return currency(p1, currencyCode);
  if (phase === "phase2_only") return `${currency(p2, currencyCode)}/mo`;
  if (phase === "phase1_phase2") {
    return `${currency(p1, currencyCode)} + ${currency(p2, currencyCode)}/mo`;
  }
  return "—";
}

export default function PipelinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TabFilter>("open");
  const [editing, setEditing] = useState<OpportunityDraft | null>(null);
  const [editingPrevStage, setEditingPrevStage] =
    useState<OpportunityStage | null>(null);
  const [deleting, setDeleting] = useState<Opportunity | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: opps }, { data: cls }, { data: stg }] = await Promise.all([
      supabase
        .from("opportunities")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("*"),
      supabase.from("settings").select("key, value"),
    ]);
    setOpportunities((opps as Opportunity[] | null) ?? []);
    setClients((cls as Client[] | null) ?? []);
    const map: SettingsMap = {};
    for (const row of (stg as { key: string; value: string }[] | null) ?? []) {
      (map as Record<string, string>)[row.key] = row.value;
    }
    setSettings(map);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Deep-link ?edit={id} from any external flow (e.g. a future
  // proposal-generation hook that wants to land here)
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || opportunities.length === 0) return;
    const match = opportunities.find((o) => o.id === editId);
    if (match) {
      setEditing(toDraft(match));
      setEditingPrevStage(match.stage);
      router.replace("/pipeline");
    }
  }, [searchParams, opportunities, router]);

  const currencyCode = settings.currency ?? "USD";
  const today = dateISO();
  const quarterStart = startOfQuarter(new Date()).toISOString();

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients) m.set(c.id, c.name ?? "");
    return m;
  }, [clients]);

  const counts = useMemo(() => {
    const c: Record<TabFilter, number> = {
      all: opportunities.length,
      open: 0,
      won: 0,
      lost: 0,
    };
    for (const o of opportunities) {
      if (o.stage === "won") c.won += 1;
      else if (o.stage === "lost") c.lost += 1;
      else c.open += 1;
    }
    return c;
  }, [opportunities]);

  const filtered = useMemo(() => {
    const base =
      filter === "all"
        ? opportunities
        : filter === "open"
          ? opportunities.filter((o) => isOpen(o.stage))
          : opportunities.filter((o) => o.stage === filter);

    // Sort by next_action_date ascending; nulls go to the bottom.
    return [...base].sort((a, b) => {
      const ad = a.next_action_date;
      const bd = b.next_action_date;
      if (!ad && !bd) return 0;
      if (!ad) return 1;
      if (!bd) return -1;
      return ad.localeCompare(bd);
    });
  }, [opportunities, filter]);

  const stats = useMemo(() => {
    const open = opportunities.filter((o) => isOpen(o.stage));
    const overdue = open.filter(
      (o) => o.next_action_date && o.next_action_date < today,
    ).length;
    const pipelineMrr = open.reduce(
      (sum, o) => sum + opportunityMonthlyContribution(o),
      0,
    );
    const pipelineOneTime = open.reduce(
      (sum, o) => sum + opportunityOneTimeContribution(o),
      0,
    );
    const wonThisQuarterOpps = opportunities.filter(
      (o) => o.stage === "won" && o.won_at && o.won_at >= quarterStart,
    );
    const wonThisQuarterMrr = wonThisQuarterOpps.reduce(
      (sum, o) => sum + opportunityMonthlyContribution(o),
      0,
    );
    return {
      open: open.length,
      overdue,
      pipelineMrr,
      pipelineOneTime,
      wonThisQuarterMrr,
    };
  }, [opportunities, today, quarterStart]);

  function startNew() {
    setEditing(emptyDraft());
    setEditingPrevStage(null);
  }

  function startEdit(o: Opportunity) {
    setEditing(toDraft(o));
    setEditingPrevStage(o.stage);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const payload = buildPayload(editing, editingPrevStage);
    // eslint-disable-next-line no-console
    console.log("[opportunity:save]", {
      mode: editing.id ? "update" : "insert",
      editing_next_action: editing.next_action,
      editing_next_action_date: editing.next_action_date,
      payload,
    });
    const { data, error } = editing.id
      ? await supabase
          .from("opportunities")
          .update(payload)
          .eq("id", editing.id)
          .select()
          .single()
      : await supabase
          .from("opportunities")
          .insert(payload)
          .select()
          .single();
    setSaving(false);
    // eslint-disable-next-line no-console
    console.log("[opportunity:save] response", { error, data });
    if (error) {
      console.error("Save opportunity failed:", error);
      alert(`Save failed: ${error.message}`);
      return;
    }
    setEditing(null);
    setEditingPrevStage(null);
    await load();
  }

  async function handleDelete() {
    if (!deleting) return;
    await supabase.from("opportunities").delete().eq("id", deleting.id);
    setDeleting(null);
    await load();
  }

  // Core proposal-creation flow shared by the modal footer and the row
  // action button. Caller is responsible for any pre-save (the modal does an
  // auto-save first; row action skips that since the row is already saved).
  async function convertOpportunityToProposal(opp: {
    id: string;
    contact_name: string | null;
    contact_email: string | null;
    company_name: string | null;
  }): Promise<boolean> {
    // Compute the next proposal number; strip the leading # to match the
    // agreements pattern (proposals stores raw "PROP001" going forward).
    const { data: existingProps } = await supabase
      .from("proposals")
      .select("number");
    const number = nextInvoiceNumber(
      (existingProps as { number: string | null }[] | null) ?? [],
      "PROP",
    ).replace(/^#/, "");

    // Insert a draft proposal using current-era schema fields only.
    const today = dateISO();
    const valid = dateISO(addDays(new Date(), 30));
    const proposalPayload = {
      number,
      date: today,
      valid_until: valid,
      status: "draft",
      client_name: opp.contact_name || opp.company_name || null,
      client_email: opp.contact_email || null,
      client_company: opp.company_name || null,
      intro: DEFAULT_PROPOSAL_INTRO,
      notes: "",
      p1_items: [
        {
          service_id: null,
          title: "",
          description: "",
          qty: 1,
          rate: 0,
        },
      ],
      p1_discount_amount: 0,
      phase1_compare: "",
      phase1_note: "",
      phase1_timeline: "20 – 45 days",
      phase1_payment: "$5k to start · $3k on launch",
      p2_items: [
        {
          service_id: null,
          title: "",
          description: "",
          qty: 1,
          rate: 0,
        },
      ],
      phase2_title: "",
      p2_discount_amount: 0,
      phase2_compare: "",
      phase2_note: "",
      phase2_commitment: "3",
      opportunity_id: opp.id,
    };
    const { data: inserted, error: insErr } = await supabase
      .from("proposals")
      .insert(proposalPayload)
      .select("id")
      .single();
    if (insErr) {
      console.error("Generate proposal failed:", insErr);
      alert(`Generate proposal failed: ${insErr.message}`);
      return false;
    }

    // Move the opportunity to proposal_drafted and clear next_action — the
    // user will set a fresh one once the proposal is in shape.
    await supabase
      .from("opportunities")
      .update({ stage: "proposal_drafted", next_action: null })
      .eq("id", opp.id);

    router.push(`/proposals?edit=${inserted?.id ?? ""}`);
    return true;
  }

  async function handleGenerateProposal() {
    if (!editing || !editing.id) return;
    setSaving(true);

    // Persist any in-flight edits so the new proposal reflects the latest
    // company / contact / value the user typed.
    const updatePayload = buildPayload(editing, editingPrevStage);
    const { error: saveErr } = await supabase
      .from("opportunities")
      .update(updatePayload)
      .eq("id", editing.id);
    if (saveErr) {
      setSaving(false);
      console.error("Save before conversion failed:", saveErr);
      alert(`Save failed: ${saveErr.message}`);
      return;
    }

    const ok = await convertOpportunityToProposal({
      id: editing.id,
      contact_name: editing.contact_name || null,
      contact_email: editing.contact_email || null,
      company_name: editing.company_name || null,
    });
    setSaving(false);
    if (ok) {
      setEditing(null);
      setEditingPrevStage(null);
    }
  }

  async function handleGenerateProposalFromRow(o: Opportunity) {
    setSaving(true);
    await convertOpportunityToProposal({
      id: o.id,
      contact_name: o.contact_name,
      contact_email: o.contact_email,
      company_name: o.company_name,
    });
    setSaving(false);
  }

  function showGenerateProposalFor(d: OpportunityDraft | null): boolean {
    if (!d || !d.id) return false;
    return CAN_CONVERT_STAGES.includes(d.stage);
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Pipeline</h1>
        </div>
        <button className="btn btn-primary" onClick={startNew}>
          + New opportunity
        </button>
      </header>

      <section className="grid-5">
        <Kpi
          label="Open"
          value={String(stats.open)}
          hint="not won or lost"
          accent
        />
        <Kpi
          label="Overdue next action"
          value={String(stats.overdue)}
          hint={stats.overdue > 0 ? "needs follow-up" : "all caught up"}
          tone={stats.overdue > 0 ? "negative" : undefined}
        />
        <Kpi
          label="Pipeline MRR"
          value={`${currencyCompact(stats.pipelineMrr, currencyCode)}/mo`}
          hint="if all open opps close"
        />
        <Kpi
          label="Pipeline one-time"
          value={currencyCompact(stats.pipelineOneTime, currencyCode)}
          hint="Phase 1 fees from open opps"
        />
        <Kpi
          label="Won this quarter (MRR)"
          value={`${currencyCompact(stats.wonThisQuarterMrr, currencyCode)}/mo`}
          hint={`since ${dateCompact(quarterStart.slice(0, 10))}`}
        />
      </section>

      <div className="tabs" style={{ marginBottom: "var(--sp-5)" }}>
        {TAB_FILTERS.map((s) => (
          <button
            key={s}
            className={`tab-btn ${filter === s ? "active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s}
            <span className="tab-count">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="table-wrapper table-compact">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Stage</th>
                <th>Next action</th>
                <th>Next action date</th>
                <th className="td-right">Estimated value</th>
                <th>Source</th>
                <th className="td-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="td-muted">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="td-muted">
                    No opportunities
                    {filter !== "all" ? ` in "${filter}"` : " yet"}.
                  </td>
                </tr>
              ) : (
                filtered.map((o) => {
                  const overdue =
                    isOpen(o.stage) &&
                    !!o.next_action_date &&
                    o.next_action_date < today;
                  return (
                    <tr key={o.id}>
                      <td className="td-strong">
                        {(o.client_id && clientNameById.get(o.client_id)) ||
                          o.company_name ||
                          "—"}
                      </td>
                      <td className="td-muted">
                        {o.contact_name ?? "—"}
                        {o.contact_email && (
                          <div className="caption mono">
                            {o.contact_email}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge status-${o.stage}`}>
                          {STAGE_LABEL[o.stage]}
                        </span>
                      </td>
                      <td className="td-muted truncate" style={{ maxWidth: 200 }}>
                        {o.next_action ?? "—"}
                      </td>
                      <td
                        className="td-muted"
                        style={
                          overdue
                            ? {
                                color: "var(--danger)",
                                fontWeight: "var(--fw-semibold)",
                              }
                            : undefined
                        }
                      >
                        {o.next_action_date
                          ? dateCompact(o.next_action_date)
                          : "—"}
                        {overdue && (
                          <span
                            className="mono"
                            style={{
                              marginLeft: "var(--sp-2)",
                              fontSize: "var(--fs-11)",
                              color: "var(--danger)",
                            }}
                          >
                            overdue
                          </span>
                        )}
                      </td>
                      <td className="td-right td-mono">
                        {opportunityValueDisplay(o, currencyCode)}
                      </td>
                      <td className="td-muted">{o.source ?? "—"}</td>
                      <td
                        className="td-right"
                        style={{ minWidth: 120, whiteSpace: "nowrap" }}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            gap: "var(--sp-1)",
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => startEdit(o)}
                            aria-label="Edit"
                            title="Edit"
                          >
                            <Pencil size={15} strokeWidth={1.75} />
                          </button>
                          {CAN_CONVERT_STAGES.includes(o.stage) && (
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => handleGenerateProposalFromRow(o)}
                              disabled={saving}
                              aria-label="Generate proposal"
                              title="Generate proposal"
                            >
                              <FilePlus size={15} strokeWidth={1.75} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-btn danger"
                            onClick={() => setDeleting(o)}
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash2 size={15} strokeWidth={1.75} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <OpportunityForm
        open={!!editing}
        draft={editing}
        saving={saving}
        currencyCode={currencyCode}
        showGenerateProposal={showGenerateProposalFor(editing)}
        onChange={setEditing}
        onClose={() => {
          setEditing(null);
          setEditingPrevStage(null);
        }}
        onSubmit={handleSave}
        onGenerateProposal={handleGenerateProposal}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Delete opportunity?"
        message="This action cannot be undone."
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  tone?: "positive" | "negative";
}) {
  const toneColor =
    tone === "positive"
      ? "var(--brand-green-dark, var(--accent))"
      : tone === "negative"
        ? "var(--danger)"
        : undefined;
  return (
    <div className={`kpi-card${accent ? " accent" : ""}`}>
      <div className="kpi-label">{label}</div>
      <div
        className="kpi-value"
        style={toneColor ? { color: toneColor } : undefined}
      >
        {value}
      </div>
      {hint && (
        <div
          className="kpi-sub"
          style={toneColor ? { color: toneColor } : undefined}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
