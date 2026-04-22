"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, Eye, Pencil, Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  currency,
  dateCompact,
  dateISO,
  nextInvoiceNumber,
} from "@/lib/format";
import { ConfirmDialog } from "@/components/modal";
import {
  DEFAULT_KICKOFF_ITEMS,
} from "@/lib/defaults/kickoff-checklist";
import { DEFAULT_LEGAL_TERMS } from "@/lib/defaults/legal-terms";
import type {
  Agreement,
  AgreementStatus,
  Client,
  SettingsMap,
} from "@/lib/types";
import AgreementForm, {
  type AgreementDraft,
} from "./agreement-form";
import AgreementPreview from "./agreement-preview";

const STATUS_FILTERS = [
  "all",
  "draft",
  "sent",
  "signed",
  "active",
  "completed",
  "cancelled",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function nextAgreementNumber(existing: { number: string | null }[]) {
  return nextInvoiceNumber(existing, "ATMSA").replace(/^#/, "");
}

function agreementToDraft(
  a: Agreement,
  clients: Client[],
): AgreementDraft {
  const matchedClient =
    (a.client_email &&
      clients.find(
        (c) =>
          (c.email ?? "").toLowerCase() ===
          (a.client_email ?? "").toLowerCase(),
      )) ||
    null;
  return {
    id: a.id,
    number: a.number,
    date: a.date ?? dateISO(),
    status: a.status,
    proposal_id: a.proposal_id,
    proposal_number: a.proposal_number,
    proposal_date: a.proposal_date,
    client_id: matchedClient?.id ?? "",
    client_name: a.client_name || matchedClient?.name || "",
    client_email: a.client_email || matchedClient?.email || "",
    client_company: a.client_company || matchedClient?.company || "",
    client_address: a.client_address || matchedClient?.address || "",
    phase1_items: Array.isArray(a.phase1_items) ? a.phase1_items : [],
    phase1_total: String(a.phase1_total ?? 0),
    phase1_discount: String(a.phase1_discount ?? 0),
    phase1_timeline: a.phase1_timeline ?? "",
    phase1_payment: a.phase1_payment ?? "",
    phase2_service: a.phase2_service ?? "",
    phase2_rate: String(a.phase2_rate ?? 0),
    phase2_discount: String(a.phase2_discount ?? 0),
    phase2_commitment: String(a.phase2_commitment ?? 3),
    phase2_start_date: a.phase2_start_date ?? "",
    kickoff_items:
      Array.isArray(a.kickoff_items) && a.kickoff_items.length > 0
        ? a.kickoff_items
        : DEFAULT_KICKOFF_ITEMS,
    terms: a.terms || DEFAULT_LEGAL_TERMS,
    signed_date: a.signed_date ?? "",
    signed_by_name: a.signed_by_name ?? "",
    signed_by_title: a.signed_by_title ?? "",
    notes: a.notes ?? "",
  };
}

function emptyDraft(
  number: string,
  settings: SettingsMap,
): AgreementDraft {
  return {
    number,
    date: dateISO(),
    status: "draft",
    proposal_id: null,
    proposal_number: null,
    proposal_date: null,
    client_id: "",
    client_name: "",
    client_email: "",
    client_company: "",
    client_address: "",
    phase1_items: [{ name: "", price: 0 }],
    phase1_total: "0",
    phase1_discount: "",
    phase1_timeline: "20 – 45 days",
    phase1_payment:
      settings.agreement_default_phase1_payment ??
      "50% upon signing, 50% upon delivery",
    phase2_service: "",
    phase2_rate: "0",
    phase2_discount: "",
    phase2_commitment: "3",
    phase2_start_date: "",
    kickoff_items: DEFAULT_KICKOFF_ITEMS,
    terms: DEFAULT_LEGAL_TERMS,
    signed_date: "",
    signed_by_name: "",
    signed_by_title: "",
    notes: "",
  };
}

function buildPayload(d: AgreementDraft) {
  return {
    number: d.number,
    date: d.date,
    status: d.status,
    proposal_id: d.proposal_id,
    proposal_number: d.proposal_number,
    proposal_date: d.proposal_date,
    client_name: d.client_name || null,
    client_email: d.client_email || null,
    client_company: d.client_company || null,
    client_address: d.client_address || null,
    phase1_items: d.phase1_items,
    phase1_total: d.phase1_items.reduce(
      (sum, it) => sum + (Number(it.price) || 0),
      0,
    ),
    phase1_discount: Number(d.phase1_discount) || 0,
    phase1_timeline: d.phase1_timeline || null,
    phase1_payment: d.phase1_payment || null,
    phase2_service: d.phase2_service || null,
    phase2_rate: Number(d.phase2_rate) || 0,
    phase2_discount: Number(d.phase2_discount) || 0,
    phase2_commitment: Number(d.phase2_commitment) || 0,
    phase2_start_date: d.phase2_start_date || null,
    kickoff_items: d.kickoff_items,
    terms: d.terms || null,
    signed_date: d.signed_date || null,
    signed_by_name: d.signed_by_name || null,
    signed_by_title: d.signed_by_title || null,
    notes: d.notes || null,
  };
}

export default function AgreementsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<AgreementDraft | null>(null);
  const [previewing, setPreviewing] = useState<Agreement | null>(null);
  const [deleting, setDeleting] = useState<Agreement | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: ags }, { data: cls }, { data: stg }] = await Promise.all([
      supabase
        .from("agreements")
        .select("*")
        .order("date", { ascending: false }),
      supabase.from("clients").select("*").order("name", { ascending: true }),
      supabase.from("settings").select("key, value"),
    ]);
    setAgreements((ags as Agreement[] | null) ?? []);
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

  // Support deep-link ?edit={id}
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || agreements.length === 0) return;
    const match = agreements.find((a) => a.id === editId);
    if (match) {
      setEditing(agreementToDraft(match, clients));
      router.replace("/agreements");
    }
  }, [searchParams, agreements, clients, router]);

  const currencyCode = settings.currency ?? "USD";

  const filtered = useMemo(() => {
    if (filter === "all") return agreements;
    return agreements.filter((a) => a.status === filter);
  }, [agreements, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: agreements.length };
    for (const a of agreements) {
      c[a.status] = (c[a.status] ?? 0) + 1;
    }
    return c;
  }, [agreements]);

  const stats = useMemo(() => {
    const total = agreements.length;
    const pending = agreements.filter((a) => a.status === "sent").length;
    const activeValue = agreements
      .filter((a) => a.status === "active")
      .reduce(
        (sum, a) =>
          sum +
          Math.max(
            0,
            (Number(a.phase2_rate) || 0) - (Number(a.phase2_discount) || 0),
          ),
        0,
      );
    const currentYear = new Date().getFullYear();
    const signedThisYear = agreements.filter((a) => {
      if (!a.signed_date) return false;
      return new Date(a.signed_date).getFullYear() === currentYear;
    }).length;
    return { total, pending, activeValue, signedThisYear };
  }, [agreements]);

  function startNew() {
    const number = nextAgreementNumber(agreements);
    setEditing(emptyDraft(number, settings));
  }

  function startEdit(a: Agreement) {
    setEditing(agreementToDraft(a, clients));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const payload = buildPayload(editing);
    const { error } = editing.id
      ? await supabase
          .from("agreements")
          .update(payload)
          .eq("id", editing.id)
      : await supabase.from("agreements").insert(payload);
    setSaving(false);
    if (error) {
      console.error("Save agreement failed:", error);
      alert(`Save failed: ${error.message}`);
      return;
    }
    setEditing(null);
    await load();
  }

  async function handleDelete() {
    if (!deleting) return;
    await supabase.from("agreements").delete().eq("id", deleting.id);
    setDeleting(null);
    await load();
  }

  async function duplicate(a: Agreement) {
    const number = nextAgreementNumber(agreements);
    const base = agreementToDraft(a, clients);
    const payload = buildPayload({
      ...base,
      id: undefined,
      number,
      status: "draft",
      signed_date: "",
      signed_by_name: "",
      signed_by_title: "",
      date: dateISO(),
    });
    await supabase.from("agreements").insert(payload);
    await load();
  }

  async function markSigned(a: Agreement) {
    await supabase
      .from("agreements")
      .update({ status: "signed", signed_date: dateISO() })
      .eq("id", a.id);
    await load();
    setPreviewing(null);
  }

  function sendEmail(a: Agreement) {
    if (!a.client_email) return;
    const subjectTemplate =
      settings.agreement_email_subject ??
      "Welcome to Attomik — Services Agreement for {client_company}";
    const bodyTemplate =
      settings.agreement_email_body ??
      "Hi {client_name},\n\nAttached is the Services Agreement for {client_company} (#{agreement_number}).\n\nPablo";
    const vars: Record<string, string> = {
      client_name: a.client_name ?? "",
      client_company: a.client_company ?? a.client_name ?? "Client",
      agreement_number: a.number,
      phase1_total: currency(
        Math.max(
          0,
          (Number(a.phase1_total) || 0) - (Number(a.phase1_discount) || 0),
        ),
        currencyCode,
      ),
      phase2_rate: currency(
        Math.max(
          0,
          (Number(a.phase2_rate) || 0) - (Number(a.phase2_discount) || 0),
        ),
        currencyCode,
      ),
    };
    const fill = (tpl: string) =>
      tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
    const subject = encodeURIComponent(fill(subjectTemplate));
    const body = encodeURIComponent(fill(bodyTemplate));
    window.location.href = `mailto:${a.client_email}?subject=${subject}&body=${body}`;
    // Mark as sent if currently draft
    if (a.status === "draft") {
      supabase
        .from("agreements")
        .update({ status: "sent" })
        .eq("id", a.id)
        .then(() => load());
    }
  }

  function statusLabel(s: AgreementStatus): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Service Agreements</h1>
        </div>
        <button className="btn btn-primary" onClick={startNew}>
          + New Agreement
        </button>
      </header>

      <section className="grid-4">
        <Kpi
          label="Total"
          value={String(stats.total)}
          hint="all agreements"
        />
        <Kpi
          label="Pending signature"
          value={String(stats.pending)}
          hint="status: sent"
          accent
        />
        <Kpi
          label="Active monthly value"
          value={`${currency(stats.activeValue, currencyCode)}/mo`}
          hint="sum of active retainers"
        />
        <Kpi
          label="Signed this year"
          value={String(stats.signedThisYear)}
          hint={String(new Date().getFullYear())}
        />
      </section>

      <div className="tabs" style={{ marginBottom: "var(--sp-5)" }}>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={`tab-btn ${filter === s ? "active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "all" : statusLabel(s).toLowerCase()}
            <span className="tab-count">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="table-wrapper table-compact">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Client</th>
                <th className="td-right">Phase 1</th>
                <th className="td-right">Phase 2</th>
                <th>Status</th>
                <th>Date</th>
                <th className="td-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="td-muted">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="td-muted">
                    No agreements
                    {filter !== "all" ? ` with status "${filter}"` : " yet"}.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id}>
                    <td className="td-mono td-strong">{a.number}</td>
                    <td>
                      {a.client_company || a.client_name || "—"}
                      {a.client_name && a.client_company && (
                        <div className="caption">{a.client_name}</div>
                      )}
                    </td>
                    <td className="td-right td-mono">
                      {currency(
                        Math.max(
                          0,
                          (Number(a.phase1_total) || 0) -
                            (Number(a.phase1_discount) || 0),
                        ),
                        currencyCode,
                      )}
                    </td>
                    <td className="td-right td-mono">
                      {Number(a.phase2_rate) > 0
                        ? `${currency(
                            Math.max(
                              0,
                              (Number(a.phase2_rate) || 0) -
                                (Number(a.phase2_discount) || 0),
                            ),
                            currencyCode,
                          )}/mo`
                        : "—"}
                    </td>
                    <td>
                      <span className={`badge status-${a.status}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="td-muted">{dateCompact(a.date)}</td>
                    <td
                      className="td-right"
                      style={{ minWidth: 200, whiteSpace: "nowrap" }}
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
                          onClick={() => setPreviewing(a)}
                          aria-label="Preview"
                          title="Preview"
                        >
                          <Eye size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => startEdit(a)}
                          aria-label="Edit"
                          title="Edit"
                        >
                          <Pencil size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => sendEmail(a)}
                          disabled={!a.client_email}
                          aria-label="Send via email"
                          title="Send via email"
                        >
                          <Send size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => duplicate(a)}
                          aria-label="Duplicate"
                          title="Duplicate"
                        >
                          <Copy size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => setDeleting(a)}
                          aria-label="Delete"
                          title="Delete"
                        >
                          <Trash2 size={15} strokeWidth={1.75} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AgreementForm
        open={!!editing}
        draft={editing}
        clients={clients}
        saving={saving}
        currencyCode={currencyCode}
        settings={settings}
        onChange={setEditing}
        onClose={() => setEditing(null)}
        onSubmit={handleSave}
      />

      <AgreementPreview
        open={!!previewing}
        agreement={previewing}
        settings={settings}
        onClose={() => setPreviewing(null)}
        onMarkSigned={markSigned}
        onSend={sendEmail}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Delete agreement?"
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
