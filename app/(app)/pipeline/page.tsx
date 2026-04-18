"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  addDays,
  currencyCompact,
  dateCompact,
  dateISO,
  nextInvoiceNumber,
} from "@/lib/format";
import { Modal, ConfirmDialog } from "@/components/modal";
import type { Client } from "@/lib/types";

type Contact = {
  id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  status: string | null;
  stage: string | null;
  notes: string | null;
  monthly_value: number | null;
  last_contact: string | null;
};

type Proposal = {
  id: string;
  number: string | null;
  client_name: string | null;
  client_company: string | null;
  phase1_price: string | null;
  status: string | null;
  valid_until: string | null;
  date: string | null;
};

type ProspectDraft = {
  id?: string;
  name: string;
  company: string;
  email: string;
  status: string;
  stage: string;
  notes: string;
  monthly_value: string;
  last_contact: string;
};

type ClientDraft = {
  id: string;
  name: string;
  monthly_value: string;
  growth_stage: string;
  notes: string;
};

const EMPTY_PROSPECT: ProspectDraft = {
  name: "",
  company: "",
  email: "",
  status: "idea",
  stage: "",
  notes: "",
  monthly_value: "0",
  last_contact: "",
};

const DEFAULT_TARGET_MRR = 25000;

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "in_conversation", label: "In conversation" },
  { value: "outreach", label: "Outreach" },
  { value: "proposal_sent", label: "Proposal sent" },
  { value: "waiting", label: "Waiting" },
];

const STAGE_LABEL = new Map(STAGE_OPTIONS.map((s) => [s.value, s.label]));

const GROWTH_LABEL: Record<string, string> = {
  launch: "Launch",
  scale: "Scale",
  optimize: "Optimize",
};

const HEALTH_FROM_GROWTH: Record<string, { label: string; tone: string }> = {
  launch: { label: "launch", tone: "var(--muted)" },
  scale: { label: "strong", tone: "var(--brand-green-dark, var(--accent))" },
  optimize: { label: "optimize", tone: "var(--warn, var(--accent))" },
};

function parseMoney(s: string | null | undefined): number {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
}

function moneyOrDash(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!v) return "—";
  return currencyCompact(v);
}

export default function PipelinePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [clients, setClients] = useState<Client[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);

  const [targetMRR, setTargetMRR] = useState<number>(DEFAULT_TARGET_MRR);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState("");

  const [loading, setLoading] = useState(true);
  const [editingProspect, setEditingProspect] = useState<ProspectDraft | null>(
    null,
  );
  const [editingClient, setEditingClient] = useState<ClientDraft | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cls }, { data: cts }, { data: props }, { data: stg }] =
      await Promise.all([
        supabase.from("clients").select("*").order("name", { ascending: true }),
        supabase
          .from("pipeline_contacts")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("proposals")
          .select(
            "id, number, client_name, client_company, phase1_price, status, valid_until, date",
          )
          .order("date", { ascending: false }),
        supabase.from("settings").select("key, value"),
      ]);
    setClients((cls as Client[] | null) ?? []);
    setContacts((cts as Contact[] | null) ?? []);
    setProposals((props as Proposal[] | null) ?? []);
    const targetRow = (stg as { key: string; value: string }[] | null)?.find(
      (r) => r.key === "target_mrr",
    );
    const t = parseMoney(targetRow?.value);
    setTargetMRR(t > 0 ? t : DEFAULT_TARGET_MRR);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // ── derived lists ───────────────────────────────────────────────

  const activeClients = useMemo(
    () => clients.filter((c) => (c.status ?? "active") === "active"),
    [clients],
  );
  const pausedClients = useMemo(
    () => clients.filter((c) => c.status === "paused"),
    [clients],
  );
  const cancelledClients = useMemo(
    () => clients.filter((c) => c.status === "cancelled"),
    [clients],
  );
  const warmContacts = useMemo(
    () =>
      contacts.filter(
        (c) => c.status === "warm" || c.status === "contacted",
      ),
    [contacts],
  );
  const declinedContacts = useMemo(
    () => contacts.filter((c) => c.status === "no_reply"),
    [contacts],
  );
  const ideaContacts = useMemo(
    () => contacts.filter((c) => c.status === "idea"),
    [contacts],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (loading) return;
    // eslint-disable-next-line no-console
    console.log("[pipeline] cancelled/declined rows", {
      cancelledClients: cancelledClients.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
      })),
      declinedContacts: declinedContacts.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
      })),
      ideaContacts: ideaContacts.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
      })),
    });
  }, [loading, cancelledClients, declinedContacts, ideaContacts]);

  const fixedMRR = useMemo(() => {
    const total = activeClients.reduce(
      (s, c) => s + Number(c.monthly_value ?? 0),
      0,
    );
    // eslint-disable-next-line no-console
    console.log(
      "[pipeline] fixedMRR",
      total,
      activeClients.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        monthly_value: c.monthly_value,
      })),
    );
    return total;
  }, [activeClients]);
  const warmPipelineMRR = useMemo(
    () => warmContacts.reduce((s, c) => s + Number(c.monthly_value ?? 0), 0),
    [warmContacts],
  );
  const sentProposals = useMemo(
    () =>
      proposals.filter(
        (p) => p.status === "sent" || p.status === "draft",
      ),
    [proposals],
  );
  const sentProposalValue = useMemo(
    () => sentProposals.reduce((s, p) => s + parseMoney(p.phase1_price), 0),
    [sentProposals],
  );
  const pausedMRR = useMemo(
    () => pausedClients.reduce((s, c) => s + Number(c.monthly_value ?? 0), 0),
    [pausedClients],
  );
  const gapRaw = targetMRR - fixedMRR;
  const aboveTarget = gapRaw <= 0;
  const gapAbsolute = Math.abs(gapRaw);

  // ── handlers ────────────────────────────────────────────────────

  async function saveTarget(e: React.FormEvent) {
    e.preventDefault();
    const v = parseMoney(targetDraft);
    if (v <= 0) {
      setEditingTarget(false);
      return;
    }
    await supabase
      .from("settings")
      .upsert({ key: "target_mrr", value: String(v) }, { onConflict: "key" });
    setTargetMRR(v);
    setEditingTarget(false);
  }

  async function saveProspect(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProspect) return;
    setSaving(true);
    const payload = {
      name: editingProspect.name,
      company: editingProspect.company,
      email: editingProspect.email,
      status: editingProspect.status,
      stage: editingProspect.stage || null,
      notes: editingProspect.notes,
      monthly_value: Number(editingProspect.monthly_value) || 0,
      last_contact: editingProspect.last_contact || null,
    };
    if (editingProspect.id) {
      await supabase
        .from("pipeline_contacts")
        .update(payload)
        .eq("id", editingProspect.id);
    } else {
      await supabase.from("pipeline_contacts").insert(payload);
    }
    setSaving(false);
    setEditingProspect(null);
    await load();
  }

  async function saveClientEdits(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClient) return;
    setSaving(true);
    await supabase
      .from("clients")
      .update({
        monthly_value: Number(editingClient.monthly_value) || 0,
        growth_stage: editingClient.growth_stage || null,
        notes: editingClient.notes || null,
      })
      .eq("id", editingClient.id);
    setSaving(false);
    setEditingClient(null);
    await load();
  }

  async function setClientStatus(c: Client, status: string) {
    await supabase.from("clients").update({ status }).eq("id", c.id);
    await load();
  }

  async function setContactStatus(c: Contact, status: string) {
    await supabase
      .from("pipeline_contacts")
      .update({ status })
      .eq("id", c.id);
    await load();
  }

  async function setProposalStatus(p: Proposal, status: string) {
    await supabase.from("proposals").update({ status }).eq("id", p.id);
    await load();
  }

  async function handleDelete() {
    if (!deleting) return;
    await supabase.from("pipeline_contacts").delete().eq("id", deleting.id);
    setDeleting(null);
    await load();
  }

  async function convertToProposal(c: Contact) {
    const number = nextInvoiceNumber(proposals, "PROP");
    const today = dateISO();
    const valid = dateISO(addDays(new Date(), 30));
    await supabase.from("proposals").insert({
      number,
      date: today,
      valid_until: valid,
      status: "draft",
      client_name: c.name,
      client_email: c.email,
      client_company: c.company,
      intro:
        "Built in two phases. You only commit to Phase 1 — Phase 2 starts after launch and runs month-by-month with no commitment, so you can cancel after Phase 1 or stop anytime once it's running.",
      phase1_title: "DTC Strategy + Shopify Build",
      phase1_price: "8000",
      phase1_timeline: "20 – 45 days",
      phase1_payment: "$5k to start · $3k on launch",
      phase2_title: "Growth + Ads Bundle",
      phase2_monthly: String(c.monthly_value ?? 4000),
      phase2_commitment: "3 months",
    });
    await supabase
      .from("pipeline_contacts")
      .update({ stage: "proposal_sent" })
      .eq("id", c.id);
    router.push("/proposals");
  }

  function openNewProspect(status: string) {
    setEditingProspect({ ...EMPTY_PROSPECT, status });
  }

  function openEditProspect(c: Contact) {
    setEditingProspect({
      id: c.id,
      name: c.name ?? "",
      company: c.company ?? "",
      email: c.email ?? "",
      status: c.status ?? "idea",
      stage: c.stage ?? "",
      notes: c.notes ?? "",
      monthly_value: String(c.monthly_value ?? 0),
      last_contact: c.last_contact ?? "",
    });
  }

  function openEditClient(c: Client) {
    setEditingClient({
      id: c.id,
      name: c.name ?? "",
      monthly_value: String(c.monthly_value ?? 0),
      growth_stage: c.growth_stage ?? "",
      notes: c.notes ?? "",
    });
  }

  // ── render ──────────────────────────────────────────────────────

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Pipeline</h1>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => openNewProspect("idea")}
        >
          <Plus size={15} strokeWidth={2} />
          New prospect
        </button>
      </header>

      <section className="grid-4">
        <Kpi
          label="Fixed MRR"
          value={currencyCompact(fixedMRR)}
          hint={`${activeClients.length} active client${activeClients.length === 1 ? "" : "s"}`}
          accent
        />
        <Kpi
          label="Warm pipeline"
          value={currencyCompact(warmPipelineMRR + sentProposalValue)}
          hint={`${warmContacts.length} prospect${
            warmContacts.length === 1 ? "" : "s"
          } · ${sentProposals.length} proposal${
            sentProposals.length === 1 ? "" : "s"
          }`}
        />
        <TargetKpi
          editing={editingTarget}
          draft={targetDraft}
          value={targetMRR}
          onStart={() => {
            setTargetDraft(String(targetMRR));
            setEditingTarget(true);
          }}
          onChange={setTargetDraft}
          onCancel={() => setEditingTarget(false)}
          onSubmit={saveTarget}
        />
        <Kpi
          label="Gap to target"
          value={currencyCompact(gapAbsolute)}
          hint={aboveTarget ? "above target ↑" : "to reach goal"}
          tone={aboveTarget ? "positive" : "negative"}
        />
      </section>

      {/* Active clients */}
      <SectionHeader
        label="Active clients"
        count={activeClients.length}
        totalValue={fixedMRR}
        valueSuffix="/ mo"
      />
      {loading ? (
        <EmptyRow text="Loading…" />
      ) : activeClients.length === 0 ? (
        <EmptyRow text="No active clients." />
      ) : (
        <ClientTable
          clients={activeClients}
          actions={(c) => (
            <>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => openEditClient(c)}
              >
                Edit
              </button>
              <button
                className="btn btn-secondary btn-xs"
                onClick={() => setClientStatus(c, "paused")}
              >
                Mark as Paused
              </button>
            </>
          )}
        />
      )}

      {/* Paused */}
      <SectionHeader
        label="Paused"
        count={pausedClients.length}
        totalValue={pausedMRR}
        valueSuffix="/ mo"
      />
      {pausedClients.length === 0 ? (
        <EmptyRow text="No paused clients." />
      ) : (
        <ClientTable
          clients={pausedClients}
          actions={(c) => (
            <>
              <button
                className="btn btn-secondary btn-xs"
                onClick={() => setClientStatus(c, "active")}
              >
                Reactivate
              </button>
              <button
                className="btn btn-danger btn-xs"
                onClick={() => setClientStatus(c, "cancelled")}
              >
                Mark as Cancelled
              </button>
            </>
          )}
        />
      )}

      {/* Warm leads */}
      <SectionHeader
        label="Warm leads"
        count={warmContacts.length + sentProposals.length}
        totalValue={warmPipelineMRR + sentProposalValue}
        valueSuffix=""
      />
      {warmContacts.length + sentProposals.length === 0 ? (
        <EmptyRow text="No warm leads or sent proposals." />
      ) : (
        <>
          {warmContacts.length > 0 && (
            <>
              <Subheader label="Prospects" count={warmContacts.length} />
              <div className="table-wrapper" style={{ marginBottom: "var(--sp-5)" }}>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Company</th>
                        <th className="td-right">Expected /mo</th>
                        <th>Stage</th>
                        <th>Last contact</th>
                        <th>Notes</th>
                        <th className="td-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {warmContacts.map((c) => (
                        <tr key={c.id}>
                          <td className="td-strong">{c.name ?? "—"}</td>
                          <td className="td-muted">{c.company ?? "—"}</td>
                          <td className="td-right td-mono">
                            {moneyOrDash(c.monthly_value)}
                          </td>
                          <td>
                            {c.stage ? (
                              <span className="badge">
                                {STAGE_LABEL.get(c.stage) ?? c.stage}
                              </span>
                            ) : (
                              <span className="td-muted">—</span>
                            )}
                          </td>
                          <td className="td-muted">
                            {c.last_contact ? dateCompact(c.last_contact) : "—"}
                          </td>
                          <td
                            className="td-muted truncate"
                            style={{ maxWidth: 240 }}
                          >
                            {c.notes?.split("\n")[0] ?? "—"}
                          </td>
                          <td className="td-right">
                            <div
                              className="flex gap-2"
                              style={{ justifyContent: "flex-end" }}
                            >
                              <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => openEditProspect(c)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-secondary btn-xs"
                                onClick={() => convertToProposal(c)}
                              >
                                → Proposal
                              </button>
                              <button
                                className="btn btn-danger btn-xs"
                                onClick={() =>
                                  setContactStatus(c, "no_reply")
                                }
                              >
                                Mark declined
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {sentProposals.length > 0 && (
            <>
              <Subheader label="Proposals" count={sentProposals.length} />
              <div className="table-wrapper" style={{ marginBottom: "var(--sp-5)" }}>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Proposal</th>
                        <th className="td-right">Phase 1</th>
                        <th>Status</th>
                        <th>Valid until</th>
                        <th className="td-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sentProposals.map((p) => (
                        <tr key={p.id}>
                          <td className="td-strong">
                            {p.client_name ?? p.client_company ?? "—"}
                          </td>
                          <td className="td-mono">{p.number ?? "—"}</td>
                          <td className="td-right td-mono">
                            {parseMoney(p.phase1_price) > 0
                              ? currencyCompact(parseMoney(p.phase1_price))
                              : "—"}
                          </td>
                          <td>
                            <span
                              className={`badge status-${p.status ?? "sent"}`}
                            >
                              {p.status ?? "sent"}
                            </span>
                          </td>
                          <td className="td-muted">
                            {p.valid_until ? dateCompact(p.valid_until) : "—"}
                          </td>
                          <td className="td-right">
                            <div
                              className="flex gap-2"
                              style={{ justifyContent: "flex-end" }}
                            >
                              <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => router.push("/proposals")}
                              >
                                View
                              </button>
                              <button
                                className="btn btn-secondary btn-xs"
                                onClick={() =>
                                  setProposalStatus(p, "accepted")
                                }
                              >
                                Mark accepted
                              </button>
                              <button
                                className="btn btn-danger btn-xs"
                                onClick={() =>
                                  setProposalStatus(p, "declined")
                                }
                              >
                                Mark declined
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Cancelled / Declined */}
      <SectionHeader
        label="Cancelled / Declined"
        count={cancelledClients.length + declinedContacts.length}
      />
      {cancelledClients.length + declinedContacts.length === 0 ? (
        <EmptyRow text="No cancelled clients or declined prospects." />
      ) : (
        <div className="table-wrapper">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Source</th>
                  <th className="td-right">Value /mo</th>
                  <th>Why lost</th>
                </tr>
              </thead>
              <tbody>
                {cancelledClients.map((c) => (
                  <tr key={`client-${c.id}`}>
                    <td className="td-strong">{c.name ?? "—"}</td>
                    <td className="td-muted">{c.company ?? "—"}</td>
                    <td>
                      <span className="badge status-cancelled">client</span>
                    </td>
                    <td className="td-right td-mono">
                      {moneyOrDash(c.monthly_value)}
                    </td>
                    <td className="td-muted truncate" style={{ maxWidth: 320 }}>
                      {c.notes ?? "—"}
                    </td>
                  </tr>
                ))}
                {declinedContacts.map((c) => (
                  <tr key={`contact-${c.id}`}>
                    <td className="td-strong">{c.name ?? "—"}</td>
                    <td className="td-muted">{c.company ?? "—"}</td>
                    <td>
                      <span className="badge status-no_reply">prospect</span>
                    </td>
                    <td className="td-right td-mono">
                      {moneyOrDash(c.monthly_value)}
                    </td>
                    <td className="td-muted truncate" style={{ maxWidth: 320 }}>
                      {c.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ideas */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "var(--sp-7)",
          marginBottom: "var(--sp-3)",
          gap: "var(--sp-3)",
        }}
      >
        <SectionHeader
          label="Ideas"
          count={ideaContacts.length}
          inline
          totalValue={ideaContacts.reduce(
            (s, c) => s + Number(c.monthly_value ?? 0),
            0,
          )}
          valueSuffix="/ mo"
        />
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => openNewProspect("idea")}
        >
          <Plus size={14} strokeWidth={2} />
          Add idea
        </button>
      </div>
      {ideaContacts.length === 0 ? (
        <EmptyRow text="No ideas yet." />
      ) : (
        <div className="table-wrapper">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th className="td-right">Expected /mo</th>
                  <th>Notes</th>
                  <th className="td-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ideaContacts.map((c) => (
                  <tr key={c.id}>
                    <td className="td-strong">{c.name ?? "—"}</td>
                    <td className="td-muted">{c.company ?? "—"}</td>
                    <td className="td-right td-mono">
                      {moneyOrDash(c.monthly_value)}
                    </td>
                    <td className="td-muted truncate" style={{ maxWidth: 320 }}>
                      {c.notes?.split("\n")[0] ?? "—"}
                    </td>
                    <td className="td-right">
                      <div
                        className="flex gap-2"
                        style={{ justifyContent: "flex-end" }}
                      >
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => openEditProspect(c)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-secondary btn-xs"
                          onClick={() => setContactStatus(c, "contacted")}
                        >
                          Mark contacted
                        </button>
                        <button
                          className="btn btn-danger btn-xs"
                          onClick={() => setDeleting(c)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Prospect modal */}
      <Modal
        open={!!editingProspect}
        onClose={() => setEditingProspect(null)}
        title={editingProspect?.id ? "Edit prospect" : "New prospect"}
        maxWidth={560}
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setEditingProspect(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="prospect-form"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save prospect"}
            </button>
          </>
        }
      >
        {editingProspect && (
          <form
            id="prospect-form"
            onSubmit={saveProspect}
            className="flex-col"
            style={{ gap: "var(--sp-4)" }}
          >
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  required
                  value={editingProspect.name}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Company</label>
                <input
                  value={editingProspect.company}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      company: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={editingProspect.email}
                onChange={(e) =>
                  setEditingProspect({
                    ...editingProspect,
                    email: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  value={editingProspect.status}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      status: e.target.value,
                    })
                  }
                >
                  <option value="idea">Idea</option>
                  <option value="contacted">Contacted</option>
                  <option value="warm">Warm</option>
                  <option value="no_reply">No Reply</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Stage</label>
                <select
                  value={editingProspect.stage}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      stage: e.target.value,
                    })
                  }
                >
                  {STAGE_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Expected /mo ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingProspect.monthly_value}
                  onChange={(e) =>
                    setEditingProspect({
                      ...editingProspect,
                      monthly_value: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Last contact</label>
              <input
                type="date"
                value={editingProspect.last_contact}
                onChange={(e) =>
                  setEditingProspect({
                    ...editingProspect,
                    last_contact: e.target.value,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                rows={4}
                value={editingProspect.notes}
                onChange={(e) =>
                  setEditingProspect({
                    ...editingProspect,
                    notes: e.target.value,
                  })
                }
              />
            </div>
          </form>
        )}
      </Modal>

      {/* Client quick-edit modal */}
      <Modal
        open={!!editingClient}
        onClose={() => setEditingClient(null)}
        title={`Edit ${editingClient?.name ?? "client"}`}
        maxWidth={520}
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setEditingClient(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="client-edit-form"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        {editingClient && (
          <form
            id="client-edit-form"
            onSubmit={saveClientEdits}
            className="flex-col"
            style={{ gap: "var(--sp-4)" }}
          >
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Monthly Retainer ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingClient.monthly_value}
                  onChange={(e) =>
                    setEditingClient({
                      ...editingClient,
                      monthly_value: e.target.value,
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Growth stage</label>
                <select
                  value={editingClient.growth_stage}
                  onChange={(e) =>
                    setEditingClient({
                      ...editingClient,
                      growth_stage: e.target.value,
                    })
                  }
                >
                  <option value="">—</option>
                  <option value="launch">Launch</option>
                  <option value="scale">Scale</option>
                  <option value="optimize">Optimize</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                rows={4}
                value={editingClient.notes}
                onChange={(e) =>
                  setEditingClient({
                    ...editingClient,
                    notes: e.target.value,
                  })
                }
              />
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete prospect?"
        message="This action cannot be undone."
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ── presentational helpers ──────────────────────────────────────────

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
      <div className="kpi-value" style={toneColor ? { color: toneColor } : undefined}>
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

function TargetKpi({
  editing,
  draft,
  value,
  onStart,
  onChange,
  onCancel,
  onSubmit,
}: {
  editing: boolean;
  draft: string;
  value: number;
  onStart: () => void;
  onChange: (s: string) => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="kpi-card">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--sp-2)",
        }}
      >
        <div className="kpi-label">Target MRR</div>
        {!editing && (
          <button
            type="button"
            className="icon-btn"
            onClick={onStart}
            aria-label="Edit target"
            title="Edit"
            style={{
              width: 22,
              height: 22,
              marginTop: "calc(-1 * var(--sp-2))",
            }}
          >
            <Pencil size={12} strokeWidth={1.75} />
          </button>
        )}
      </div>
      {editing ? (
        <form
          onSubmit={onSubmit}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-2)",
            marginTop: "var(--sp-1)",
          }}
        >
          <span className="mono" style={{ color: "var(--muted)" }}>
            $
          </span>
          <input
            type="number"
            min="0"
            step="1"
            autoFocus
            value={draft}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: "var(--fw-bold)",
              padding: "4px 8px",
            }}
          />
          <button
            type="submit"
            className="icon-btn"
            aria-label="Save"
            title="Save"
          >
            <Check size={15} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onCancel}
            aria-label="Cancel"
            title="Cancel"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </form>
      ) : (
        <>
          <div className="kpi-value">{currencyCompact(value)}</div>
          <div className="kpi-sub">monthly goal</div>
        </>
      )}
    </div>
  );
}

function SectionHeader({
  label,
  count,
  totalValue,
  valueSuffix,
  inline,
}: {
  label: string;
  count: number;
  totalValue?: number;
  valueSuffix?: string;
  inline?: boolean;
}) {
  const bar = (
    <div
      className="section-header"
      style={inline ? { margin: 0, flex: 1 } : undefined}
    >
      <div className="section-header-bar" />
      <div
        className="section-header-title"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-2)",
        }}
      >
        {label}
        <span
          className="badge badge-gray mono"
          style={{ fontSize: "var(--fs-11)" }}
        >
          {count}
        </span>
        {totalValue !== undefined && totalValue > 0 && (
          <span
            className="mono"
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--muted)",
              fontWeight: "var(--fw-normal)",
            }}
          >
            · {currencyCompact(totalValue)} {valueSuffix ?? ""}
          </span>
        )}
      </div>
      <div className="section-header-line" />
    </div>
  );
  return bar;
}

function Subheader({ label, count }: { label: string; count: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-2)",
        marginBottom: "var(--sp-2)",
        marginTop: "var(--sp-3)",
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: "var(--fs-11)",
          letterSpacing: "var(--ls-wide)",
          textTransform: "uppercase",
          color: "var(--muted)",
          fontWeight: "var(--fw-semibold)",
        }}
      >
        {label}
      </span>
      <span
        className="badge badge-gray mono"
        style={{ fontSize: "var(--fs-11)" }}
      >
        {count}
      </span>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div
      className="card"
      style={{
        padding: "var(--sp-4)",
        background: "var(--gray-150)",
        marginBottom: "var(--sp-5)",
      }}
    >
      <div className="caption mono">{text}</div>
    </div>
  );
}

function ClientTable({
  clients,
  actions,
}: {
  clients: Client[];
  actions: (c: Client) => React.ReactNode;
}) {
  return (
    <div className="table-wrapper">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th className="td-right">Monthly</th>
              <th>Growth stage</th>
              <th>Health</th>
              <th>Notes</th>
              <th className="td-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const stageKey = (c.growth_stage ?? "").toLowerCase();
              const health = HEALTH_FROM_GROWTH[stageKey];
              return (
                <tr key={c.id}>
                  <td className="td-strong">{c.name ?? "—"}</td>
                  <td className="td-right td-mono">
                    {moneyOrDash(c.monthly_value)}
                  </td>
                  <td>
                    {stageKey ? (
                      <span className="badge badge-gray">
                        {GROWTH_LABEL[stageKey] ?? stageKey}
                      </span>
                    ) : (
                      <span className="td-muted">—</span>
                    )}
                  </td>
                  <td>
                    {health ? (
                      <span
                        className="mono"
                        style={{
                          fontSize: "var(--text-sm)",
                          color: health.tone,
                          fontWeight: "var(--fw-semibold)",
                          textTransform: "uppercase",
                          letterSpacing: "var(--ls-wide)",
                        }}
                      >
                        {health.label}
                      </span>
                    ) : (
                      <span className="td-muted">—</span>
                    )}
                  </td>
                  <td className="td-muted truncate" style={{ maxWidth: 240 }}>
                    {c.notes?.split("\n")[0] ?? "—"}
                  </td>
                  <td className="td-right">
                    <div
                      className="flex gap-2"
                      style={{ justifyContent: "flex-end" }}
                    >
                      {actions(c)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
