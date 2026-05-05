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
import { DEFAULT_NDA_TERMS } from "@/lib/defaults/nda-terms";
import type {
  Agreement,
  AgreementStatus,
  Client,
  NewClientDraft,
  SettingsMap,
} from "@/lib/types";
import AgreementForm, {
  type AgreementDraft,
} from "./agreement-form";
import AgreementPreview from "./agreement-preview";
import NDAForm, { type NDADraft } from "./nda-form";
import NDAPreview from "./nda-preview";

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

function nextAgreementNumber(
  existing: { number: string | null; type?: string | null }[],
) {
  // ATMSA### is independent from ATMNDA###. Filter to services rows so the
  // ATMNDA prefix doesn't accidentally match the ATMSA regex.
  const services = existing.filter(
    (r) => (r.type ?? "services") === "services",
  );
  return nextInvoiceNumber(services, "ATMSA").replace(/^#/, "");
}

function nextNDANumber(
  existing: { number: string | null; type?: string | null }[],
) {
  const ndas = existing.filter((r) => r.type === "nda");
  return nextInvoiceNumber(ndas, "ATMNDA").replace(/^#/, "");
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
    opportunity_id: a.opportunity_id,
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

function ndaToDraft(a: Agreement, clients: Client[]): NDADraft {
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
    client_id: matchedClient?.id ?? "",
    client_name: a.client_name || matchedClient?.name || "",
    client_email: a.client_email || matchedClient?.email || "",
    client_company: a.client_company || matchedClient?.company || "",
    client_address: a.client_address || matchedClient?.address || "",
    nda_purpose: a.nda_purpose ?? "",
    nda_term_years: String(a.nda_term_years ?? 2),
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
    opportunity_id: null,
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

function emptyNDADraft(number: string): NDADraft {
  return {
    number,
    date: dateISO(),
    status: "draft",
    client_id: "",
    client_name: "",
    client_email: "",
    client_company: "",
    client_address: "",
    nda_purpose: "",
    nda_term_years: "2",
    signed_date: "",
    signed_by_name: "",
    signed_by_title: "",
    notes: "",
  };
}

function buildPayload(d: AgreementDraft) {
  return {
    type: "services" as const,
    number: d.number,
    date: d.date,
    status: d.status,
    proposal_id: d.proposal_id,
    proposal_number: d.proposal_number,
    proposal_date: d.proposal_date,
    opportunity_id: d.opportunity_id,
    client_id: d.client_id || null,
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

function buildNDAPayload(d: NDADraft) {
  return {
    type: "nda" as const,
    number: d.number,
    date: d.date,
    status: d.status,
    proposal_id: null,
    proposal_number: null,
    proposal_date: null,
    opportunity_id: null,
    client_id: d.client_id || null,
    client_name: d.client_name || null,
    client_email: d.client_email || null,
    client_company: d.client_company || null,
    client_address: d.client_address || null,
    // Services-specific columns stay null for NDA rows.
    phase1_items: null,
    phase1_total: null,
    phase1_discount: null,
    phase1_timeline: null,
    phase1_payment: null,
    phase2_service: null,
    phase2_rate: null,
    phase2_discount: null,
    phase2_commitment: null,
    phase2_start_date: null,
    kickoff_items: null,
    terms: null,
    signed_date: d.signed_date || null,
    signed_by_name: d.signed_by_name || null,
    signed_by_title: d.signed_by_title || null,
    notes: d.notes || null,
    nda_purpose: d.nda_purpose || null,
    nda_term_years: Number(d.nda_term_years) || 2,
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
  const [editingNDA, setEditingNDA] = useState<NDADraft | null>(null);
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
      if (match.type === "nda") {
        setEditingNDA(ndaToDraft(match, clients));
      } else {
        setEditing(agreementToDraft(match, clients));
      }
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
      .filter((a) => a.status === "active" && a.type !== "nda")
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

  function startNewNDA() {
    const number = nextNDANumber(agreements);
    setEditingNDA(emptyNDADraft(number));
  }

  function startEdit(a: Agreement) {
    if (a.type === "nda") {
      setEditingNDA(ndaToDraft(a, clients));
    } else {
      setEditing(agreementToDraft(a, clients));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!editing.client_id) {
      alert("Please select a client.");
      return;
    }
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

  async function handleSaveNDA(e: React.FormEvent) {
    e.preventDefault();
    if (!editingNDA) return;
    if (!editingNDA.client_id) {
      alert("Please select a client.");
      return;
    }
    setSaving(true);
    const payload = buildNDAPayload(editingNDA);
    const { error } = editingNDA.id
      ? await supabase
          .from("agreements")
          .update(payload)
          .eq("id", editingNDA.id)
      : await supabase.from("agreements").insert(payload);
    setSaving(false);
    if (error) {
      console.error("Save NDA failed:", error);
      alert(`Save failed: ${error.message}`);
      return;
    }
    setEditingNDA(null);
    await load();
  }

  async function handleDelete() {
    if (!deleting) return;
    await supabase.from("agreements").delete().eq("id", deleting.id);
    setDeleting(null);
    await load();
  }

  async function duplicate(a: Agreement) {
    if (a.type === "nda") {
      const number = nextNDANumber(agreements);
      const base = ndaToDraft(a, clients);
      const payload = buildNDAPayload({
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
    } else {
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
    }
    await load();
  }

  async function markSigned(a: Agreement) {
    const signed = dateISO();
    await supabase
      .from("agreements")
      .update({ status: "signed", signed_date: signed })
      .eq("id", a.id);

    // Close out the originating opportunity, if any. NDAs aren't tied to
    // opportunities so this branch is a no-op for them.
    if (a.type !== "nda") {
      let oppId = a.opportunity_id;
      if (!oppId && a.proposal_id) {
        const { data: prop } = await supabase
          .from("proposals")
          .select("opportunity_id")
          .eq("id", a.proposal_id)
          .maybeSingle();
        oppId = (prop?.opportunity_id as string | null) ?? null;
      }
      if (oppId) {
        await supabase
          .from("opportunities")
          .update({
            stage: "won",
            won_at: `${signed}T00:00:00Z`,
            lost_at: null,
          })
          .eq("id", oppId);
      }
    }

    await load();
    setPreviewing(null);
  }

  // Build subject + body using the agreement_email_* / nda_email_*
  // settings templates. Branches on agreement.type.
  function buildEmailParts(a: Agreement) {
    if (a.type === "nda") {
      const subjectTemplate =
        settings.nda_email_subject ??
        "Mutual NDA — Attomik & {client_company} (#{nda_number})";
      const bodyTemplate =
        settings.nda_email_body ??
        "Hi {client_name},\n\nAttached is a Mutual NDA between Attomik and {client_company} (#{nda_number}).\n\nReply with \"I accept\" to confirm, or sign and return.\n\nPablo";
      const vars: Record<string, string> = {
        client_name: a.client_name ?? "",
        client_company: a.client_company ?? a.client_name ?? "Client",
        nda_number: a.number,
        purpose: a.nda_purpose ?? "",
        term_years: String(a.nda_term_years ?? 2),
      };
      const fill = (tpl: string) =>
        tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
      return { subject: fill(subjectTemplate), body: fill(bodyTemplate) };
    }
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
    return {
      subject: fill(subjectTemplate),
      body: fill(bodyTemplate),
    };
  }

  function sendEmail(a: Agreement) {
    if (!a.client_email) return;
    const { subject, body } = buildEmailParts(a);
    window.location.href = `mailto:${a.client_email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    if (a.status === "draft") {
      supabase
        .from("agreements")
        .update({ status: "sent" })
        .eq("id", a.id)
        .then(() => load());
    }
  }

  // "Generate email" — downloads the PDF, then opens Gmail compose for
  // account@attomik.co with the client as To and Pablo as Cc, subject + body
  // prefilled. User drags the just-downloaded PDF into the compose window.
  async function generateEmail(a: Agreement) {
    if (!a.client_email) return;
    try {
      if (a.type === "nda") {
        const { generateNDAPDF } = await import("@/lib/pdf/nda-pdf");
        generateNDAPDF(a, settings);
      } else {
        const { generateAgreementPDF } = await import(
          "@/lib/pdf/agreement-pdf"
        );
        generateAgreementPDF(a, settings);
      }
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
    const { subject, body } = buildEmailParts(a);
    const url =
      "https://mail.google.com/mail/u/account@attomik.co/?view=cm&fs=1" +
      `&to=${encodeURIComponent(a.client_email)}` +
      `&cc=${encodeURIComponent("pablo@attomik.co")}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    if (a.status === "draft") {
      await supabase
        .from("agreements")
        .update({ status: "sent" })
        .eq("id", a.id);
      await load();
    }
  }

  async function handleGenerateEmailFromForm() {
    if (!editing?.id) return;
    const a = agreements.find((x) => x.id === editing.id);
    if (!a) return;
    await generateEmail(a);
  }

  async function handleGenerateEmailFromNDAForm() {
    if (!editingNDA?.id) return;
    const a = agreements.find((x) => x.id === editingNDA.id);
    if (!a) return;
    await generateEmail(a);
  }

  async function handleCreateClient(d: NewClientDraft): Promise<Client | null> {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: d.name.trim(),
        company: d.company.trim() || null,
        email: d.email.trim() || null,
        address: d.address.trim() || null,
        payment_terms: d.payment_terms.trim() || null,
        status: "active",
        emails: [],
        monthly_value: 0,
      })
      .select()
      .single();
    if (error) {
      console.error("Create client failed:", error);
      alert(`Create client failed: ${error.message}`);
      return null;
    }
    await load();
    return data as Client;
  }

  function statusLabel(s: AgreementStatus): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Agreements</h1>
        </div>
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          <button className="btn btn-secondary" onClick={startNewNDA}>
            + Generate NDA
          </button>
          <button className="btn btn-primary" onClick={startNew}>
            + New Agreement
          </button>
        </div>
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
                filtered.map((a) => {
                  const isNDA = a.type === "nda";
                  return (
                    <tr key={a.id}>
                      <td className="td-mono td-strong">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--sp-2)",
                          }}
                        >
                          <span>{a.number}</span>
                          <span
                            className="caption mono"
                            style={{
                              padding: "1px 6px",
                              borderRadius: "var(--r-sm)",
                              border: "1px solid var(--border)",
                              background: isNDA
                                ? "var(--gray-150)"
                                : "transparent",
                              fontSize: "10px",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {isNDA ? "NDA" : "SERVICES"}
                          </span>
                        </div>
                      </td>
                      <td>
                        {a.client_company || a.client_name || "—"}
                        {a.client_name && a.client_company && (
                          <div className="caption">{a.client_name}</div>
                        )}
                      </td>
                      <td className="td-right td-mono">
                        {isNDA
                          ? "—"
                          : currency(
                              Math.max(
                                0,
                                (Number(a.phase1_total) || 0) -
                                  (Number(a.phase1_discount) || 0),
                              ),
                              currencyCode,
                            )}
                      </td>
                      <td className="td-right td-mono">
                        {isNDA
                          ? "—"
                          : Number(a.phase2_rate) > 0
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
                  );
                })
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
        onGenerateEmail={handleGenerateEmailFromForm}
        onCreateClient={handleCreateClient}
      />

      <NDAForm
        open={!!editingNDA}
        draft={editingNDA}
        clients={clients}
        saving={saving}
        onChange={setEditingNDA}
        onClose={() => setEditingNDA(null)}
        onSubmit={handleSaveNDA}
        onGenerateEmail={handleGenerateEmailFromNDAForm}
        onCreateClient={handleCreateClient}
      />

      {previewing?.type === "nda" ? (
        <NDAPreview
          open={!!previewing}
          agreement={previewing}
          settings={settings}
          onClose={() => setPreviewing(null)}
          onMarkSigned={markSigned}
          onSend={sendEmail}
        />
      ) : (
        <AgreementPreview
          open={!!previewing}
          agreement={previewing}
          settings={settings}
          onClose={() => setPreviewing(null)}
          onMarkSigned={markSigned}
          onSend={sendEmail}
        />
      )}

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
