"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  FilePlus,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  addDays,
  currency,
  currencyCompact,
  dateCompact,
  dateISO,
  invoiceTotal,
  nextInvoiceNumber,
  type LineItem,
} from "@/lib/format";
import { Modal, ConfirmDialog } from "@/components/modal";

type Contact = {
  id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  status: string | null;
  notes: string | null;
  monthly_value: number | null;
  last_contact: string | null;
};

type Invoice = {
  id: string;
  number: string | null;
  client_name: string | null;
  date: string | null;
  status: string | null;
  items: LineItem[] | null;
  discount: number | null;
};

type Proposal = {
  id: string;
  number: string | null;
  date: string | null;
  client_name: string | null;
  client_company: string | null;
  status: string | null;
  phase1_price: string | null;
  phase2_monthly: string | null;
  phase2_commitment: string | null;
};

type Draft = {
  id?: string;
  name: string;
  company: string;
  email: string;
  status: string;
  notes: string;
  monthly_value: string;
  last_contact: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  company: "",
  email: "",
  status: "idea",
  notes: "",
  monthly_value: "0",
  last_contact: "",
};

const SECTION_ORDER: { status: string; label: string }[] = [
  { status: "warm", label: "Warm" },
  { status: "contacted", label: "Contacted" },
  { status: "no_reply", label: "No reply" },
  { status: "idea", label: "Ideas" },
];

const DEFAULT_TARGET_MRR = 25000;

// ── helpers ─────────────────────────────────────────────────────────

function parseMoney(s: string | null | undefined): number {
  if (!s) return 0;
  const cleaned = String(s).replace(/[^\d.]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function promoteStatus(current: string): string | null {
  switch (current) {
    case "idea":
      return "contacted";
    case "contacted":
      return "warm";
    case "warm":
      return "active";
    case "no_reply":
      return "contacted";
    default:
      return null;
  }
}

function demoteStatus(current: string): string | null {
  switch (current) {
    case "warm":
      return "contacted";
    case "contacted":
      return "no_reply";
    default:
      return null;
  }
}

// ── page ────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [targetMRR, setTargetMRR] = useState<number>(DEFAULT_TARGET_MRR);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState("");

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: cData },
      { data: iData },
      { data: pData },
      { data: stgData },
    ] = await Promise.all([
      supabase
        .from("pipeline_contacts")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("id, number, client_name, date, status, items, discount")
        .order("date", { ascending: false })
        .limit(500),
      supabase
        .from("proposals")
        .select(
          "id, number, date, client_name, client_company, status, phase1_price, phase2_monthly, phase2_commitment",
        )
        .order("date", { ascending: false })
        .limit(200),
      supabase.from("settings").select("key, value"),
    ]);
    setContacts((cData as Contact[] | null) ?? []);
    setInvoices((iData as Invoice[] | null) ?? []);
    setProposals((pData as Proposal[] | null) ?? []);
    const targetRow =
      (stgData as { key: string; value: string }[] | null)?.find(
        (r) => r.key === "target_mrr",
      ) ?? null;
    const parsed = parseMoney(targetRow?.value);
    setTargetMRR(parsed > 0 ? parsed : DEFAULT_TARGET_MRR);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // ── derived ─────────────────────────────────────────────────────

  const fixedMRR = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const byClient = new Map<string, { amount: number; date: string }>();
    for (const inv of invoices) {
      if (!inv.client_name || !inv.date) continue;
      if (!inv.date.startsWith(currentMonth)) continue;
      const status = inv.status ?? "";
      if (status !== "paid" && status !== "sent" && status !== "overdue") continue;
      const existing = byClient.get(inv.client_name);
      if (!existing || inv.date > existing.date) {
        byClient.set(inv.client_name, {
          amount: invoiceTotal(inv.items, inv.discount),
          date: inv.date,
        });
      }
    }
    return Array.from(byClient.values()).reduce((s, v) => s + v.amount, 0);
  }, [invoices]);

  const sentProposals = useMemo(
    () =>
      proposals
        .filter((p) => p.status === "sent")
        .map((p) => ({
          proposal: p,
          value:
            parseMoney(p.phase1_price) +
            parseMoney(p.phase2_monthly) * parseMoney(p.phase2_commitment),
        }))
        .sort((a, b) => (a.proposal.date ?? "") < (b.proposal.date ?? "") ? 1 : -1),
    [proposals],
  );

  const warmPipeline = useMemo(
    () => sentProposals.reduce((sum, p) => sum + p.value, 0),
    [sentProposals],
  );

  const gap = Math.max(0, targetMRR - fixedMRR);

  const activeClients = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const byClient = new Map<
      string,
      { name: string; status: string; date: string; amount: number }
    >();
    for (const inv of invoices) {
      if (!inv.client_name || !inv.date) continue;
      const d = new Date(inv.date);
      if (isNaN(d.getTime()) || d.getFullYear() !== thisYear) continue;
      const status = inv.status ?? "";
      if (status !== "paid" && status !== "sent" && status !== "overdue") continue;
      const existing = byClient.get(inv.client_name);
      if (!existing || inv.date > existing.date) {
        byClient.set(inv.client_name, {
          name: inv.client_name,
          status,
          date: inv.date,
          amount: invoiceTotal(inv.items, inv.discount),
        });
      }
    }
    return Array.from(byClient.values()).sort((a, b) =>
      a.date < b.date ? 1 : -1,
    );
  }, [invoices]);

  const contactsByStatus = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const s of SECTION_ORDER) map.set(s.status, []);
    for (const c of contacts) {
      const status = c.status ?? "idea";
      if (status === "active") continue;
      if (!map.has(status)) map.set(status, []);
      map.get(status)!.push(c);
    }
    return map;
  }, [contacts]);

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const payload = {
      name: editing.name,
      company: editing.company,
      email: editing.email,
      status: editing.status,
      notes: editing.notes,
      monthly_value: Number(editing.monthly_value) || 0,
      last_contact: editing.last_contact || null,
    };
    if (editing.id) {
      await supabase
        .from("pipeline_contacts")
        .update(payload)
        .eq("id", editing.id);
    } else {
      await supabase.from("pipeline_contacts").insert(payload);
    }
    setSaving(false);
    setEditing(null);
    await load();
  }

  async function handleDelete() {
    if (!deleting) return;
    await supabase.from("pipeline_contacts").delete().eq("id", deleting.id);
    setDeleting(null);
    await load();
  }

  async function changeStatus(c: Contact, next: string) {
    await supabase
      .from("pipeline_contacts")
      .update({ status: next })
      .eq("id", c.id);
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
      items: [],
      discount: 0,
      phase1_title: "DTC Strategy + Shopify Build",
      phase1_price: "8000",
      phase1_timeline: "20 – 45 days",
      phase1_payment: "$5k to start · $3k on launch",
      phase2_title: "Growth + Ads Bundle",
      phase2_monthly: "$4,000 / mo",
      phase2_commitment: "3",
    });
    router.push("/proposals");
  }

  function openNew(status: string) {
    setEditing({ ...EMPTY_DRAFT, status });
  }

  function openEdit(c: Contact) {
    setEditing({
      id: c.id,
      name: c.name ?? "",
      company: c.company ?? "",
      email: c.email ?? "",
      status: c.status ?? "idea",
      notes: c.notes ?? "",
      monthly_value: String(c.monthly_value ?? 0),
      last_contact: c.last_contact ?? "",
    });
  }

  // ── render ──────────────────────────────────────────────────────

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <div className="label mono" style={{ marginBottom: "var(--sp-2)" }}>
            03 / Pipeline
          </div>
          <h1>Pipeline.</h1>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => openNew("idea")}
        >
          <Plus size={15} strokeWidth={2} />
          New prospect
        </button>
      </header>

      <section className="grid-4">
        <Kpi
          label="Fixed MRR"
          value={currencyCompact(fixedMRR)}
          hint="most recent invoice · this month"
          accent
        />
        <Kpi
          label="Warm pipeline"
          value={currencyCompact(warmPipeline)}
          hint="sent proposals · phase 1 + total phase 2"
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
          value={currencyCompact(gap)}
          hint={gap === 0 ? "on target" : "to reach goal"}
        />
      </section>

      <div className="section-header">
        <div className="section-header-bar" />
        <div className="section-header-title">
          Active clients · this year
        </div>
        <div className="section-header-line" />
      </div>

      <div className="card">
        {loading ? (
          <div className="caption mono">Loading…</div>
        ) : activeClients.length === 0 ? (
          <div className="caption mono">No billed clients this year.</div>
        ) : (
          <ul style={{ listStyle: "none" }}>
            {activeClients.map((c, i) => (
              <li
                key={c.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--sp-3)",
                  padding: "var(--sp-3) 0",
                  borderBottom:
                    i < activeClients.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--sp-3)",
                    flex: 1,
                    minWidth: 0,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontWeight: "var(--fw-semibold)",
                    }}
                  >
                    {c.name}
                  </span>
                  <span className={`badge status-${c.status}`}>{c.status}</span>
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--muted)",
                    }}
                  >
                    {dateCompact(c.date)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--sp-3)",
                    flexShrink: 0,
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontWeight: "var(--fw-semibold)" }}
                  >
                    {currencyCompact(c.amount)}
                  </span>
                  <Link
                    href={`/invoices?client=${encodeURIComponent(c.name)}`}
                    className="btn btn-ghost btn-xs"
                  >
                    View invoices
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="section-header">
        <div className="section-header-bar" />
        <div className="section-header-title">Prospects CRM</div>
        <div className="section-header-line" />
      </div>

      {SECTION_ORDER.map(({ status, label }) => {
        const list = contactsByStatus.get(status) ?? [];
        const warmProposals = status === "warm" ? sentProposals : [];
        return (
          <StatusSection
            key={status}
            status={status}
            label={label}
            contacts={list}
            proposals={warmProposals}
            onAdd={() => openNew(status)}
            onEdit={openEdit}
            onDelete={(c) => setDeleting(c)}
            onPromote={(c) => {
              const next = promoteStatus(c.status ?? status);
              if (next) changeStatus(c, next);
            }}
            onDemote={(c) => {
              const next = demoteStatus(c.status ?? status);
              if (next) changeStatus(c, next);
            }}
            onConvert={convertToProposal}
            onAcceptProposal={async (p) => {
              await supabase
                .from("proposals")
                .update({ status: "accepted" })
                .eq("id", p.id);
              await load();
            }}
          />
        );
      })}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit prospect" : "New prospect"}
        maxWidth={560}
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setEditing(null)}
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
        {editing && (
          <form
            id="prospect-form"
            onSubmit={handleSave}
            className="flex-col"
            style={{ gap: "var(--sp-4)" }}
          >
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  required
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Company</label>
                <input
                  value={editing.company}
                  onChange={(e) =>
                    setEditing({ ...editing, company: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={editing.email}
                onChange={(e) =>
                  setEditing({ ...editing, email: e.target.value })
                }
              />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value })
                  }
                >
                  <option value="idea">idea</option>
                  <option value="contacted">contacted</option>
                  <option value="warm">warm</option>
                  <option value="no_reply">no_reply</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Monthly value (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editing.monthly_value}
                  onChange={(e) =>
                    setEditing({ ...editing, monthly_value: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Last contact</label>
              <input
                type="date"
                value={editing.last_contact}
                onChange={(e) =>
                  setEditing({ ...editing, last_contact: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                rows={4}
                value={editing.notes}
                onChange={(e) =>
                  setEditing({ ...editing, notes: e.target.value })
                }
              />
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete prospect?"
        message={`Remove ${deleting?.name ?? "this prospect"} from the pipeline?`}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ── components ──────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`kpi-card${accent ? " accent" : ""}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-sub">{hint}</div>}
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
            style={{ width: 22, height: 22, marginTop: "calc(-1 * var(--sp-2))" }}
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
          <span className="mono" style={{ color: "var(--muted)" }}>$</span>
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

function StatusSection({
  status,
  label,
  contacts,
  proposals,
  onAdd,
  onEdit,
  onDelete,
  onPromote,
  onDemote,
  onConvert,
  onAcceptProposal,
}: {
  status: string;
  label: string;
  contacts: Contact[];
  proposals: { proposal: Proposal; value: number }[];
  onAdd: () => void;
  onEdit: (c: Contact) => void;
  onDelete: (c: Contact) => void;
  onPromote: (c: Contact) => void;
  onDemote: (c: Contact) => void;
  onConvert: (c: Contact) => void;
  onAcceptProposal: (p: Proposal) => void;
}) {
  const totalCount = contacts.length + proposals.length;
  return (
    <div style={{ marginBottom: "var(--sp-7)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--sp-3)",
          gap: "var(--sp-3)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-3)",
          }}
        >
          <span
            className={`badge status-${status}`}
            style={{ fontSize: "var(--text-xs)" }}
          >
            {label}
          </span>
          <span
            className="mono"
            style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}
          >
            {totalCount} {totalCount === 1 ? "entry" : "entries"}
            {proposals.length > 0 && (
              <span style={{ color: "var(--accent-dark)" }}>
                {" · "}
                {proposals.length} proposal{proposals.length === 1 ? "" : "s"}
              </span>
            )}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onAdd}
        >
          <Plus size={14} strokeWidth={2} />
          Add
        </button>
      </div>

      {totalCount === 0 ? (
        <div
          className="card"
          style={{ padding: "var(--sp-4)", background: "var(--gray-150)" }}
        >
          <div className="caption mono">No prospects in {label.toLowerCase()}.</div>
        </div>
      ) : (
        <div className="grid-3">
          {proposals.map(({ proposal, value }) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              value={value}
              onAccept={() => onAcceptProposal(proposal)}
            />
          ))}
          {contacts.map((c) => (
            <ProspectCard
              key={c.id}
              contact={c}
              onEdit={() => onEdit(c)}
              onDelete={() => onDelete(c)}
              onPromote={() => onPromote(c)}
              onDemote={() => onDemote(c)}
              onConvert={() => onConvert(c)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalCard({
  proposal,
  value,
  onAccept,
}: {
  proposal: Proposal;
  value: number;
  onAccept: () => void;
}) {
  const phase1 = parseMoney(proposal.phase1_price);
  const monthly = parseMoney(proposal.phase2_monthly);
  const months = parseMoney(proposal.phase2_commitment);
  return (
    <div
      className="card card-sm"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-3)",
        borderColor: "var(--accent-dark)",
        borderLeftWidth: 3,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--sp-2)",
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: "var(--fs-10)",
            letterSpacing: "var(--ls-wide)",
            textTransform: "uppercase",
            color: "var(--accent-dark)",
            fontWeight: "var(--fw-bold)",
          }}
        >
          Proposal sent
        </span>
        <span
          className="mono"
          style={{ fontSize: "var(--fs-11)", color: "var(--muted)" }}
        >
          {proposal.number ?? "—"}
        </span>
      </div>

      <div>
        <div
          style={{
            fontWeight: "var(--fw-semibold)",
            fontSize: "var(--text-base)",
          }}
        >
          {proposal.client_name ?? "—"}
        </div>
        {proposal.client_company && (
          <div className="caption" style={{ marginTop: "var(--sp-1)" }}>
            {proposal.client_company}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "var(--sp-2)",
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: "var(--text-md)",
            fontWeight: "var(--fw-bold)",
          }}
        >
          {currencyCompact(value)}
        </span>
        {proposal.date && (
          <span
            className="mono"
            style={{ fontSize: "var(--fs-11)", color: "var(--muted)" }}
          >
            sent {dateCompact(proposal.date)}
          </span>
        )}
      </div>

      {phase1 > 0 || monthly > 0 ? (
        <div
          className="caption mono"
          style={{
            fontSize: "var(--fs-11)",
            color: "var(--muted)",
            lineHeight: 1.5,
          }}
        >
          {phase1 > 0 && <>Phase 1 {currencyCompact(phase1)}</>}
          {phase1 > 0 && monthly > 0 && " · "}
          {monthly > 0 && (
            <>
              Phase 2 {currencyCompact(monthly)}/mo
              {months > 0 && ` × ${months}`}
            </>
          )}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: "var(--sp-1)",
          marginTop: "auto",
          paddingTop: "var(--sp-2)",
          borderTop: "1px solid var(--border)",
          justifyContent: "flex-end",
        }}
      >
        <Link
          href="/proposals"
          className="icon-btn"
          aria-label="Open in proposals"
          title="Open in proposals"
        >
          <ExternalLink size={14} strokeWidth={1.75} />
        </Link>
        <button
          type="button"
          className="icon-btn"
          onClick={onAccept}
          aria-label="Mark as accepted"
          title="Mark as accepted"
        >
          <Check size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function ProspectCard({
  contact,
  onEdit,
  onDelete,
  onPromote,
  onDemote,
  onConvert,
}: {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
  onPromote: () => void;
  onDemote: () => void;
  onConvert: () => void;
}) {
  const status = contact.status ?? "idea";
  const canPromote = promoteStatus(status) !== null;
  const canDemote = demoteStatus(status) !== null;
  const notes = contact.notes?.split("\n")[0] ?? "";

  return (
    <div
      className="card card-sm"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-3)",
      }}
    >
      <div>
        <div
          style={{
            fontWeight: "var(--fw-semibold)",
            fontSize: "var(--text-base)",
          }}
        >
          {contact.name ?? "—"}
        </div>
        {contact.company && (
          <div
            className="caption"
            style={{ marginTop: "var(--sp-1)" }}
          >
            {contact.company}
          </div>
        )}
      </div>

      {(Number(contact.monthly_value ?? 0) > 0 || contact.last_contact) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--sp-2)",
          }}
        >
          {Number(contact.monthly_value ?? 0) > 0 ? (
            <span
              className="mono"
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: "var(--fw-semibold)",
              }}
            >
              {currencyCompact(Number(contact.monthly_value ?? 0))}
              <span style={{ color: "var(--muted)" }}> /mo</span>
            </span>
          ) : (
            <span />
          )}
          {contact.last_contact && (
            <span
              className="mono"
              style={{ fontSize: "var(--fs-11)", color: "var(--muted)" }}
            >
              {dateCompact(contact.last_contact)}
            </span>
          )}
        </div>
      )}

      {notes && (
        <div
          className="caption truncate"
          style={{
            maxWidth: "100%",
            fontSize: "var(--text-sm)",
          }}
          title={contact.notes ?? undefined}
        >
          {notes}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "var(--sp-1)",
          marginTop: "auto",
          paddingTop: "var(--sp-2)",
          borderTop: "1px solid var(--border)",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          className="icon-btn"
          onClick={onEdit}
          aria-label="Edit"
          title="Edit"
        >
          <Pencil size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onPromote}
          disabled={!canPromote}
          aria-label="Promote"
          title={canPromote ? `Promote to ${promoteStatus(status)}` : "Cannot promote"}
          style={canPromote ? undefined : { opacity: 0.3, cursor: "not-allowed" }}
        >
          <ArrowUp size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onDemote}
          disabled={!canDemote}
          aria-label="Demote"
          title={canDemote ? `Demote to ${demoteStatus(status)}` : "Cannot demote"}
          style={canDemote ? undefined : { opacity: 0.3, cursor: "not-allowed" }}
        >
          <ArrowDown size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onConvert}
          aria-label="Convert to proposal"
          title="Convert to proposal"
        >
          <FilePlus size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="icon-btn danger"
          onClick={onDelete}
          aria-label="Delete"
          title="Delete"
        >
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
