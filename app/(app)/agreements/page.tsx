"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Copy,
  Eye,
  FileText,
  Package,
  Pencil,
  Send,
  Shield,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  currency,
  dateCompact,
  dateISO,
  invoiceTotal,
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
  Invoice,
  NewClientDraft,
  SettingsMap,
} from "@/lib/types";
import AgreementForm, {
  type AgreementDraft,
} from "./agreement-form";
import AgreementPreview from "./agreement-preview";
import MarkSignedModal, {
  type SignatureValues,
} from "./mark-signed-modal";
import MarkEndedModal, { type EndValues } from "./mark-ended-modal";
import FirstInvoiceModal, {
  type FirstInvoiceValues,
} from "./first-invoice-modal";
import SendPackageModal from "./send-package-modal";

const STATUS_FILTERS = [
  "all",
  "draft",
  "sent",
  "signed",
  "ended",
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
    ended_date: a.ended_date ?? "",
    end_reason: a.end_reason ?? "",
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
    ended_date: "",
    end_reason: "",
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
    ended_date: d.ended_date || null,
    end_reason: d.end_reason || null,
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
  // Unified "mark signed" capture. "commit" writes straight to the DB (from the
  // preview/row action); "draft" folds the captured signature into the open
  // edit draft so a form status change to 'signed' can't save null signers.
  const [signReq, setSignReq] = useState<
    { mode: "commit"; agreement: Agreement } | { mode: "draft" } | null
  >(null);
  const [signingSaving, setSigningSaving] = useState(false);
  // Unified "mark ended" capture, mirroring the signed flow. "commit" writes
  // straight to the DB (from the preview); "draft" folds the captured end date
  // + reason into the open edit draft so a form status change to 'ended' can't
  // save a bare ended status.
  const [endReq, setEndReq] = useState<
    { mode: "commit"; agreement: Agreement } | { mode: "draft" } | null
  >(null);
  const [endingSaving, setEndingSaving] = useState(false);
  // Deal-package actions.
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [firstInvoiceFor, setFirstInvoiceFor] = useState<Agreement | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [sendPackageFor, setSendPackageFor] = useState<Agreement | null>(null);
  const [sendingPackage, setSendingPackage] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: ags }, { data: cls }, { data: stg }, { data: invs }] =
      await Promise.all([
        supabase
          .from("agreements")
          .select("*")
          .order("date", { ascending: false }),
        supabase.from("clients").select("*").order("name", { ascending: true }),
        supabase.from("settings").select("key, value"),
        // All invoices: linked ones drive the idempotent action + package
        // deposit; the full set is needed to generate the next invoice number.
        supabase
          .from("invoices")
          .select("id, agreement_id, number, status, items, discount")
          .order("created_at", { ascending: true }),
      ]);
    setAgreements((ags as Agreement[] | null) ?? []);
    setClients((cls as Client[] | null) ?? []);
    setInvoices((invs as Invoice[] | null) ?? []);
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

  // agreement id -> its first linked invoice (idempotency + package deposit).
  const invoiceByAgreement = useMemo(() => {
    const m = new Map<string, Invoice>();
    for (const inv of invoices) {
      if (inv.agreement_id && !m.has(inv.agreement_id)) {
        m.set(inv.agreement_id, inv);
      }
    }
    return m;
  }, [invoices]);

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
      .filter((a) => a.status === "signed")
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
      ended_date: "",
      end_reason: "",
      date: dateISO(),
    });
    await supabase.from("agreements").insert(payload);
    await load();
  }

  // Prefill the signature from the linked client's signer fields (matched by
  // client_id, falling back to email), keeping any signature already captured.
  function resolveSignPrefill(opts: {
    client_id: string | null;
    client_email: string | null;
    signed_date: string | null;
    signed_by_name: string | null;
    signed_by_title: string | null;
  }): SignatureValues {
    const c =
      (opts.client_id
        ? clients.find((x) => x.id === opts.client_id)
        : null) ||
      (opts.client_email
        ? clients.find(
            (x) =>
              (x.email ?? "").toLowerCase() ===
              (opts.client_email ?? "").toLowerCase(),
          )
        : null) ||
      null;
    return {
      signed_date: opts.signed_date || dateISO(),
      signed_by_name: opts.signed_by_name || c?.signer_name || "",
      signed_by_title: opts.signed_by_title || c?.signer_title || "",
    };
  }

  const signInitial: SignatureValues = !signReq
    ? { signed_date: "", signed_by_name: "", signed_by_title: "" }
    : signReq.mode === "commit"
      ? resolveSignPrefill({
          client_id: signReq.agreement.client_id,
          client_email: signReq.agreement.client_email,
          signed_date: signReq.agreement.signed_date,
          signed_by_name: signReq.agreement.signed_by_name,
          signed_by_title: signReq.agreement.signed_by_title,
        })
      : resolveSignPrefill({
          client_id: editing?.client_id || null,
          client_email: editing?.client_email || null,
          signed_date: editing?.signed_date || null,
          signed_by_name: editing?.signed_by_name || null,
          signed_by_title: editing?.signed_by_title || null,
        });

  async function confirmSign(v: SignatureValues) {
    if (!signReq) return;

    // Draft mode: fold the signature into the open edit draft. The normal Save
    // persists it — so a form status change to 'signed' never writes nulls.
    if (signReq.mode === "draft") {
      setEditing((d) =>
        d
          ? {
              ...d,
              status: "signed",
              signed_date: v.signed_date,
              signed_by_name: v.signed_by_name,
              signed_by_title: v.signed_by_title,
            }
          : d,
      );
      setSignReq(null);
      return;
    }

    // Commit mode: stamp all three fields + status in one write.
    const a = signReq.agreement;
    setSigningSaving(true);
    const { error } = await supabase
      .from("agreements")
      .update({
        status: "signed",
        signed_date: v.signed_date || null,
        signed_by_name: v.signed_by_name || null,
        signed_by_title: v.signed_by_title || null,
      })
      .eq("id", a.id);
    if (error) {
      setSigningSaving(false);
      console.error("Mark signed failed:", error);
      alert(`Mark signed failed: ${error.message}`);
      return;
    }

    // Close out the originating opportunity, if any.
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
      const wonDate = v.signed_date || dateISO();
      await supabase
        .from("opportunities")
        .update({
          stage: "won",
          won_at: `${wonDate}T00:00:00Z`,
          lost_at: null,
        })
        .eq("id", oppId);
    }

    setSigningSaving(false);
    setSignReq(null);
    setPreviewing(null);
    await load();
  }

  const endInitial: EndValues = !endReq
    ? { ended_date: "", end_reason: "" }
    : endReq.mode === "commit"
      ? {
          ended_date: endReq.agreement.ended_date || dateISO(),
          end_reason: endReq.agreement.end_reason || "",
        }
      : {
          ended_date: editing?.ended_date || dateISO(),
          end_reason: editing?.end_reason || "",
        };

  async function confirmEnd(v: EndValues) {
    if (!endReq) return;

    // Draft mode: fold the end date + reason into the open edit draft. The
    // normal Save persists it — so a form status change to 'ended' never writes
    // a bare ended status.
    if (endReq.mode === "draft") {
      setEditing((d) =>
        d
          ? {
              ...d,
              status: "ended",
              ended_date: v.ended_date,
              end_reason: v.end_reason,
            }
          : d,
      );
      setEndReq(null);
      return;
    }

    // Commit mode: stamp status + both fields in one write.
    const a = endReq.agreement;
    setEndingSaving(true);
    const { error } = await supabase
      .from("agreements")
      .update({
        status: "ended",
        ended_date: v.ended_date || null,
        end_reason: v.end_reason || null,
      })
      .eq("id", a.id);
    if (error) {
      setEndingSaving(false);
      console.error("Mark ended failed:", error);
      alert(`Mark ended failed: ${error.message}`);
      return;
    }

    setEndingSaving(false);
    setEndReq(null);
    setPreviewing(null);
    await load();
  }

  function buildEmailParts(a: Agreement) {
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
      const { generateAgreementPDF } = await import("@/lib/pdf/agreement-pdf");
      generateAgreementPDF(a, settings);
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

  async function downloadNda(a: Agreement) {
    try {
      const { generateNdaPdf } = await import("@/lib/pdf/nda-pdf");
      generateNdaPdf(a, settings);
    } catch (err) {
      console.error("NDA PDF generation failed:", err);
    }
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

  // ── Deal package ────────────────────────────────────────────────
  function openFirstInvoice(a: Agreement) {
    const existing = invoiceByAgreement.get(a.id);
    if (existing) {
      router.push(`/invoices?edit=${existing.id}`);
      return;
    }
    setFirstInvoiceFor(a);
  }

  async function createFirstInvoice(v: FirstInvoiceValues) {
    const a = firstInvoiceFor;
    if (!a || !a.client_id) return;
    setCreatingInvoice(true);
    const { error } = await supabase.from("invoices").insert({
      number: v.number,
      date: v.date,
      due: v.due || null,
      service_start_date: v.service_start_date || null,
      service_end_date: v.service_end_date || null,
      status: "draft",
      client_id: a.client_id,
      agreement_id: a.id,
      client_name: a.client_name,
      client_email: a.client_email,
      client_company: a.client_company,
      client_address: a.client_address,
      items: [{ service_id: null, title: v.title, description: null, qty: 1, rate: v.amount }],
      discount: 0,
    });
    setCreatingInvoice(false);
    if (error) {
      console.error("Create first invoice failed:", error);
      alert(`Create invoice failed: ${error.message}`);
      return;
    }
    setFirstInvoiceFor(null);
    setToast(`Invoice ${v.number} created for ${a.number}.`);
    await load();
  }

  // Send agreement + accepted proposal + first invoice as one email. Returns
  // true on success (modal closes); false leaves edits intact.
  async function handleSendPackage(
    to: string,
    subject: string,
    body: string,
  ): Promise<boolean> {
    if (!sendPackageFor) return false;
    setSendingPackage(true);
    try {
      const res = await fetch(
        `/api/agreements/${sendPackageFor.id}/send-package`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, subject, body }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(json.error || "Failed to send package.");
        return false;
      }
      setSendPackageFor(null);
      setToast("Package sent. Agreement and invoice marked as sent.");
      await load();
      return true;
    } catch {
      setToast("Failed to send package. Check your connection and try again.");
      return false;
    } finally {
      setSendingPackage(false);
    }
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
          label="Signed monthly value"
          value={`${currency(stats.activeValue, currencyCode)}/mo`}
          hint="sum of signed retainers"
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
                  const linkedInvoice = invoiceByAgreement.get(a.id);
                  const canCreateInvoice =
                    !!a.client_id &&
                    (a.status === "draft" || a.status === "sent");
                  const showInvoiceBtn = !!linkedInvoice || canCreateInvoice;
                  const canSendPackage =
                    a.status === "draft" && !!a.client_id && !!linkedInvoice;
                  return (
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
                        style={{ minWidth: 232, whiteSpace: "nowrap" }}
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
                          {showInvoiceBtn && (
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => openFirstInvoice(a)}
                              aria-label={
                                linkedInvoice
                                  ? "View invoice"
                                  : "Create first invoice"
                              }
                              title={
                                linkedInvoice
                                  ? `View invoice ${linkedInvoice.number ?? ""}`.trim()
                                  : "Create first invoice"
                              }
                            >
                              <FileText size={15} strokeWidth={1.75} />
                            </button>
                          )}
                          {canSendPackage && (
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => setSendPackageFor(a)}
                              aria-label="Send package"
                              title="Send package (agreement + proposal + invoice)"
                            >
                              <Package size={15} strokeWidth={1.75} />
                            </button>
                          )}
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
                            onClick={() => downloadNda(a)}
                            aria-label="Download NDA"
                            title="Download NDA"
                          >
                            <Shield size={15} strokeWidth={1.75} />
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
        onRequestSign={() => setSignReq({ mode: "draft" })}
        onRequestEnd={() => setEndReq({ mode: "draft" })}
      />

      <AgreementPreview
        open={!!previewing}
        agreement={previewing}
        settings={settings}
        onClose={() => setPreviewing(null)}
        onMarkSigned={(a) => setSignReq({ mode: "commit", agreement: a })}
        onMarkEnded={(a) => setEndReq({ mode: "commit", agreement: a })}
        onSend={sendEmail}
      />

      <MarkSignedModal
        open={!!signReq}
        agreementNumber={
          signReq?.mode === "commit"
            ? signReq.agreement.number
            : (editing?.number ?? "")
        }
        clientLabel={
          signReq?.mode === "commit"
            ? signReq.agreement.client_company ||
              signReq.agreement.client_name ||
              ""
            : editing?.client_company || editing?.client_name || ""
        }
        initial={signInitial}
        saving={signingSaving}
        onConfirm={confirmSign}
        onCancel={() => setSignReq(null)}
      />

      <MarkEndedModal
        open={!!endReq}
        agreementNumber={
          endReq?.mode === "commit"
            ? endReq.agreement.number
            : (editing?.number ?? "")
        }
        clientLabel={
          endReq?.mode === "commit"
            ? endReq.agreement.client_company ||
              endReq.agreement.client_name ||
              ""
            : editing?.client_company || editing?.client_name || ""
        }
        initial={endInitial}
        saving={endingSaving}
        onConfirm={confirmEnd}
        onCancel={() => setEndReq(null)}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Delete agreement?"
        message="This action cannot be undone."
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />

      <FirstInvoiceModal
        open={!!firstInvoiceFor}
        agreement={firstInvoiceFor}
        suggestedNumber={nextInvoiceNumber(invoices)}
        currencyCode={currencyCode}
        saving={creatingInvoice}
        onClose={() => setFirstInvoiceFor(null)}
        onCreate={createFirstInvoice}
      />

      <SendPackageModal
        open={!!sendPackageFor}
        agreement={sendPackageFor}
        depositFormatted={
          sendPackageFor
            ? (() => {
                const inv = invoiceByAgreement.get(sendPackageFor.id);
                return inv
                  ? currency(invoiceTotal(inv.items, inv.discount), currencyCode)
                  : null;
              })()
            : null
        }
        hasProposal={!!sendPackageFor?.proposal_id}
        sending={sendingPackage}
        onClose={() => setSendPackageFor(null)}
        onSend={handleSendPackage}
      />

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
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
