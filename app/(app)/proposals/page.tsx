"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Check,
  Eye,
  FileSignature,
  Mail,
  Pencil,
  Send,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  currency,
  dateShort,
  dateISO,
  addDays,
  proposalPhase1Net,
  proposalPhase2Net,
  nextInvoiceNumber,
  lineSubtotal,
} from "@/lib/format";
import { ConfirmDialog, Modal } from "@/components/modal";
import {
  EMPTY_LINE,
  toLineItemDraft,
  fromLineItemDraft,
  type Client,
  type LineItemDraft,
  type NewClientDraft,
  type Proposal,
  type Service,
  type SettingsMap,
} from "@/lib/types";
import { DEFAULT_PROPOSAL_INTRO } from "@/lib/defaults/proposal-intro";
import ProposalForm, {
  type ProposalDraft,
} from "./proposal-form";
import ProposalPreview from "./proposal-preview";
import RequestDetailsModal from "./request-details-modal";
import CreateClientModal, { type ClientDraft } from "./create-client-modal";

const TAB_FILTERS = ["all", "awaiting", "accepted", "declined"] as const;
type TabFilter = (typeof TAB_FILTERS)[number];

const TAB_LABEL: Record<TabFilter, string> = {
  all: "All",
  awaiting: "Awaiting response",
  accepted: "Accepted",
  declined: "Declined",
};

// A sent proposal is "stale" once it has been waiting this many days.
const STALE_DAYS = 7;

function nextProposalNumber(existing: { number: string | null }[]) {
  return nextInvoiceNumber(existing, "PROP");
}

// Whole days elapsed since an ISO timestamp; null when unset.
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// Timestamp patch for a status transition. sent_at / accepted_at / declined_at
// stamp on first entry only; leaving a state never clears its timestamp, so the
// lifecycle history survives for reporting. decline_reason is handled by the
// caller (it needs clearing on non-declined statuses / a prompt on decline).
function lifecycleTimestamps(
  next: string,
  existing: Pick<Proposal, "sent_at" | "accepted_at" | "declined_at">,
): Record<string, string> {
  const now = new Date().toISOString();
  const patch: Record<string, string> = {};
  if (next === "sent" && !existing.sent_at) patch.sent_at = now;
  if (next === "accepted" && !existing.accepted_at) patch.accepted_at = now;
  if (next === "declined" && !existing.declined_at) patch.declined_at = now;
  return patch;
}

function emptyDraft(number: string): ProposalDraft {
  const today = dateISO();
  const valid = dateISO(addDays(new Date(), 30));
  return {
    number,
    date: today,
    valid_until: valid,
    status: "draft",
    decline_reason: "",
    client_id: "",
    client_name: "",
    client_email: "",
    client_company: "",
    intro: DEFAULT_PROPOSAL_INTRO,
    notes: "",
    p1_items: [{ ...EMPTY_LINE }],
    p1_discount_amount: "",
    phase1_compare: "10000",
    phase1_note: "",
    phase1_timeline: "20 – 45 days",
    phase1_payment: "$5k to start · $3k on launch",
    p2_items: [{ ...EMPTY_LINE }],
    phase2_title: "",
    p2_discount_amount: "",
    phase2_compare: "",
    phase2_note: "",
    phase2_commitment: "3",
  };
}

export default function ProposalsPage() {
  // eslint-disable-next-line no-console
  console.log("[proposals] ProposalsPage render");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TabFilter>("all");
  const [editing, setEditing] = useState<ProposalDraft | null>(null);
  // Lifecycle timestamps of the row currently open in the edit modal, so
  // handleSave can stamp on a status transition made inside the form.
  const [editingPrev, setEditingPrev] = useState<
    Pick<Proposal, "status" | "sent_at" | "accepted_at" | "declined_at">
  >({ status: null, sent_at: null, accepted_at: null, declined_at: null });
  const [previewing, setPreviewing] = useState<Proposal | null>(null);
  const [deleting, setDeleting] = useState<Proposal | null>(null);
  const [declining, setDeclining] = useState<Proposal | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [requestingDetails, setRequestingDetails] = useState<Proposal | null>(
    null,
  );
  const [creatingClient, setCreatingClient] = useState<Proposal | null>(null);
  const [savingClient, setSavingClient] = useState(false);
  const [saving, setSaving] = useState(false);
  // Transient notice (e.g. the form-path decline gap on a linked proposal).
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    // eslint-disable-next-line no-console
    console.log("[proposals] load() called");
    setLoading(true);
    const { data: servicesData, error: servicesError } = await supabase
      .from("services")
      .select("*")
      .order("price", { ascending: true });
    // eslint-disable-next-line no-console
    console.log(
      "[proposals] services fetch:",
      servicesData?.length,
      servicesError,
    );
    if (servicesError) {
      // eslint-disable-next-line no-console
      console.error(
        "[proposals] services fetch error detail:",
        servicesError.message,
        servicesError.code,
      );
    }
    const [{ data: props }, { data: stg }, { data: cls }] = await Promise.all([
      supabase
        .from("proposals")
        .select("*")
        .order("number", { ascending: false }),
      supabase.from("settings").select("key, value"),
      supabase.from("clients").select("*").order("name", { ascending: true }),
    ]);
    setProposals((props as Proposal[] | null) ?? []);
    setClients((cls as Client[] | null) ?? []);
    setServices((servicesData as Service[] | null) ?? []);
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

  // Deep-link ?edit={id}, used by the pipeline → proposal conversion flow.
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || proposals.length === 0) return;
    const match = proposals.find((p) => p.id === editId);
    if (match) {
      startEdit(match);
      router.replace("/proposals");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, proposals]);

  const currencyCode = settings.currency ?? "USD";

  const stats = useMemo(() => {
    const total = proposals.length;
    const sent = proposals.filter((p) => p.status === "sent").length;
    const accepted = proposals.filter((p) => p.status === "accepted").length;
    const closed = proposals.filter(
      (p) => p.status === "accepted" || p.status === "declined",
    ).length;
    const winRate = closed > 0 ? Math.round((accepted / closed) * 100) : 0;
    const sentProposals = proposals.filter((p) => p.status === "sent");
    const pipelinePhase1 = sentProposals.reduce(
      (sum, p) => sum + proposalPhase1Net(p),
      0,
    );
    const pipelinePhase2 = sentProposals.reduce(
      (sum, p) => sum + proposalPhase2Net(p),
      0,
    );
    return {
      total,
      sent,
      winRate,
      pipelinePhase1,
      pipelinePhase2,
    };
  }, [proposals]);

  const counts = useMemo<Record<TabFilter, number>>(
    () => ({
      all: proposals.length,
      awaiting: proposals.filter((p) => p.status === "sent").length,
      accepted: proposals.filter((p) => p.status === "accepted").length,
      declined: proposals.filter((p) => p.status === "declined").length,
    }),
    [proposals],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return proposals;
    if (filter === "awaiting") {
      // Sent proposals, longest wait first (nulls treated as freshest).
      return proposals
        .filter((p) => p.status === "sent")
        .sort((a, b) => (daysSince(b.sent_at) ?? -1) - (daysSince(a.sent_at) ?? -1));
    }
    return proposals.filter((p) => p.status === filter);
  }, [proposals, filter]);

  function startNew() {
    setEditing(emptyDraft(nextProposalNumber(proposals)));
    setEditingPrev({
      status: null,
      sent_at: null,
      accepted_at: null,
      declined_at: null,
    });
  }

  function startEdit(p: Proposal) {
    const rawItems = Array.isArray(p.p1_items) ? p.p1_items : [];
    const p1Items: LineItemDraft[] =
      rawItems.length > 0
        ? rawItems.map((it) => toLineItemDraft(it))
        : [{ ...EMPTY_LINE }];
    const rawP2Items = Array.isArray(p.p2_items) ? p.p2_items : [];
    const p2RateStored = Number(p.p2_rate ?? 0) || 0;
    const p2RateFallback = Number(p.p2_total ?? 0) || 0;
    const p2LegacyRate =
      p2RateStored > 0 ? p2RateStored : p2RateFallback;
    const p2Items: LineItemDraft[] =
      rawP2Items.length > 0
        ? rawP2Items.map((it) => toLineItemDraft(it))
        : p2LegacyRate > 0
          ? [
              {
                service_id: "",
                title: p.phase2_title ?? "Monthly Retainer",
                description: "",
                qty: "1",
                rate: String(p2LegacyRate),
              },
            ]
          : [{ ...EMPTY_LINE }];
    const p2Subtotal = lineSubtotal(
      p2Items.map((it) => ({
        qty: Number(it.qty) || 1,
        rate: Number(it.rate) || 0,
      })),
    );

    const p1Subtotal = lineSubtotal(
      Array.isArray(p.p1_items) ? p.p1_items : [],
    );
    const p1DiscountAmountStored = Number(p.p1_discount_amount ?? 0) || 0;
    const p1DiscountPctLegacy = Number(p.p1_discount ?? 0) || 0;
    const p1DiscountAmount =
      p1DiscountAmountStored > 0
        ? p1DiscountAmountStored
        : p1Subtotal > 0 && p1DiscountPctLegacy > 0
          ? (p1Subtotal * p1DiscountPctLegacy) / 100
          : 0;
    const p1DiscountAmountStr = p1DiscountAmount > 0 ? String(p1DiscountAmount) : "";

    const p2DiscountAmountStored = Number(p.p2_discount_amount ?? 0) || 0;
    const p2DiscountPctLegacy = Number(p.p2_discount ?? 0) || 0;
    const p2DiscountAmount =
      p2DiscountAmountStored > 0
        ? p2DiscountAmountStored
        : p2Subtotal > 0 && p2DiscountPctLegacy > 0
          ? (p2Subtotal * p2DiscountPctLegacy) / 100
          : 0;
    const p2DiscountAmountStr = p2DiscountAmount > 0 ? String(p2DiscountAmount) : "";

    setEditing({
      id: p.id,
      number: p.number ?? nextProposalNumber(proposals),
      date: p.date ?? dateISO(),
      valid_until: p.valid_until ?? dateISO(addDays(new Date(), 30)),
      status: p.status ?? "draft",
      decline_reason: p.decline_reason ?? "",
      client_id: p.client_id ?? "",
      client_name: p.client_name ?? "",
      client_email: p.client_email ?? "",
      client_company: p.client_company ?? "",
      intro: p.intro ?? "",
      notes: p.notes ?? "",
      p1_items: p1Items,
      p1_discount_amount: p1DiscountAmountStr,
      phase1_compare: p.phase1_compare ?? "",
      phase1_note: p.phase1_note ?? "",
      phase1_timeline: p.phase1_timeline ?? "",
      phase1_payment: p.phase1_payment ?? "",
      p2_items: p2Items,
      phase2_title: p.phase2_title ?? "",
      p2_discount_amount: p2DiscountAmountStr,
      phase2_compare: p.phase2_compare ?? "",
      phase2_note: p.phase2_note ?? "",
      phase2_commitment: p.phase2_commitment ?? "",
    });
    setEditingPrev({
      status: p.status ?? null,
      sent_at: p.sent_at ?? null,
      accepted_at: p.accepted_at ?? null,
      declined_at: p.declined_at ?? null,
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const p1Items = editing.p1_items.map((d) => fromLineItemDraft(d));
    const p1Subtotal = lineSubtotal(p1Items);
    const p1DiscountAmt =
      parseFloat(editing.p1_discount_amount || "0") || 0;
    const p1DiscountPct =
      p1Subtotal > 0 && p1DiscountAmt > 0
        ? (p1DiscountAmt / p1Subtotal) * 100
        : 0;
    const p2Items = editing.p2_items.map((d) => fromLineItemDraft(d));
    const p2Subtotal = lineSubtotal(p2Items);
    const p2DiscountAmt =
      parseFloat(editing.p2_discount_amount || "0") || 0;
    const p2DiscountPct =
      p2Subtotal > 0 && p2DiscountAmt > 0
        ? (p2DiscountAmt / p2Subtotal) * 100
        : 0;
    const computedPhase2Title =
      editing.phase2_title?.trim() ||
      (p2Items.length === 1 ? String(p2Items[0].title ?? "") : "") ||
      (p2Items.length > 1 ? "Monthly Retainer" : "");
    const payload = {
      number: editing.number,
      date: editing.date,
      valid_until: editing.valid_until || null,
      status: editing.status,
      // Keep the reason only while declined; clear it otherwise.
      decline_reason:
        editing.status === "declined" ? editing.decline_reason || null : null,
      // proposals.client_id is nullable on purpose — empty string means
      // "Open prospect", which writes NULL.
      client_id: editing.client_id || null,
      client_name: editing.client_name,
      client_email: editing.client_email,
      client_company: editing.client_company,
      intro: editing.intro,
      notes: editing.notes,
      p1_items: p1Items,
      p1_discount_amount: p1DiscountAmt,
      p1_discount: p1DiscountPct,
      p1_total: p1Subtotal,
      phase1_compare: editing.phase1_compare,
      phase1_note: editing.phase1_note,
      phase1_timeline: editing.phase1_timeline,
      phase1_payment: editing.phase1_payment,
      p2_items: p2Items,
      phase2_title: computedPhase2Title,
      p2_rate: p2Subtotal,
      p2_total: p2Subtotal,
      p2_discount_amount: p2DiscountAmt,
      p2_discount: p2DiscountPct,
      phase2_compare: editing.phase2_compare,
      phase2_note: editing.phase2_note,
      phase2_commitment: editing.phase2_commitment,
      // Safeguard: a status change made inside the form stamps here too, using
      // the same helper as the row actions.
      ...lifecycleTimestamps(editing.status, editingPrev),
    };
    const { error } = editing.id
      ? await supabase
          .from("proposals")
          .update(payload)
          .eq("id", editing.id)
      : await supabase.from("proposals").insert(payload);
    setSaving(false);
    if (error) {
      console.error("Save proposal failed:", error);
      alert(`Save failed: ${error.message}`);
      return;
    }
    // Seam 2: reflect a form-driven status change onto the linked opportunity.
    if (editing.id) {
      const linkedOppId =
        proposals.find((p) => p.id === editing.id)?.opportunity_id ?? null;
      if (linkedOppId) {
        if (editing.status === "accepted") {
          await syncOpportunityWon(linkedOppId);
        } else if (
          editing.status === "declined" &&
          editingPrev.status !== "declined"
        ) {
          // Decline sync lives in the modal; the form path can't ask, so make
          // the gap visible rather than silently leaving the opp at 'proposal'.
          setToast(
            "Opportunity still at proposal stage — update it from the pipeline.",
          );
        }
      }
    }
    setEditing(null);
    await load();
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

  async function handleDelete() {
    if (!deleting) return;
    await supabase.from("proposals").delete().eq("id", deleting.id);
    setDeleting(null);
    await load();
  }

  // Create a client from an accepted proposal, then complete the chain:
  // proposal.client_id + legacy snapshot strings, and the linked opportunity's
  // client_id if it has none yet.
  async function handleCreateClientFromProposal(draft: ClientDraft) {
    if (!creatingClient) return;
    const proposal = creatingClient;
    setSavingClient(true);
    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        name: draft.contact_name.trim() || null,
        email: draft.contact_email.trim() || null,
        company: draft.company.trim() || null,
        address: draft.address.trim() || null,
        signer_name: draft.signer_name.trim() || null,
        signer_title: draft.signer_title.trim() || null,
        ap_email: draft.billing_email.trim() || null,
        ops_email: draft.ops_email.trim() || null,
        status: "active",
        emails: [],
        monthly_value: 0,
        proposal_id: proposal.id,
        opportunity_id: proposal.opportunity_id ?? null,
      })
      .select()
      .single();
    if (error || !client) {
      setSavingClient(false);
      console.error("Create client failed:", error);
      alert(`Create client failed: ${error?.message ?? "no client returned"}`);
      return;
    }
    const c = client as Client;
    // Dual-write onto the proposal (FK + legacy snapshot strings).
    await supabase
      .from("proposals")
      .update({
        client_id: c.id,
        client_name: c.name,
        client_email: c.email,
        client_company: c.company,
      })
      .eq("id", proposal.id);
    // Complete the chain: link the opportunity if it has no client yet.
    if (proposal.opportunity_id) {
      const { data: opp } = await supabase
        .from("opportunities")
        .select("client_id")
        .eq("id", proposal.opportunity_id)
        .maybeSingle();
      if (opp && !opp.client_id) {
        await supabase
          .from("opportunities")
          .update({ client_id: c.id })
          .eq("id", proposal.opportunity_id);
      }
    }
    setSavingClient(false);
    setCreatingClient(null);
    await load();
  }

  // Seam 2: an accepted proposal wins its linked opportunity. Idempotent —
  // skips when the opp is already won so re-saves never re-stamp won_at.
  async function syncOpportunityWon(oppId: string) {
    const { data: opp } = await supabase
      .from("opportunities")
      .select("stage")
      .eq("id", oppId)
      .maybeSingle();
    if (!opp || opp.stage === "won") return;
    const now = new Date().toISOString();
    await supabase
      .from("opportunities")
      .update({ stage: "won", won_at: now, lost_at: null, last_touch_at: now })
      .eq("id", oppId);
  }

  // Row lifecycle transitions, mirroring agreements/markSigned: a targeted
  // update with timestamp stamping, then reload.
  async function markStatus(p: Proposal, next: "sent" | "accepted") {
    const { error } = await supabase
      .from("proposals")
      .update({ status: next, ...lifecycleTimestamps(next, p) })
      .eq("id", p.id);
    if (error) {
      console.error(`Mark ${next} failed:`, error);
      alert(`Mark ${next} failed: ${error.message}`);
      return;
    }
    if (next === "accepted" && p.opportunity_id) {
      await syncOpportunityWon(p.opportunity_id);
    }
    await load();
  }

  function openDecline(p: Proposal) {
    setDeclining(p);
    setDeclineReason(p.decline_reason ?? "");
  }

  // Decline the proposal, then (Seam 2) optionally sync a linked opportunity:
  // "lost" marks the opp lost; "qualified" returns the deal to conversation;
  // null = no linked opp, no sync.
  async function runDecline(oppAction: "lost" | "qualified" | null) {
    if (!declining) return;
    const { error } = await supabase
      .from("proposals")
      .update({
        status: "declined",
        ...lifecycleTimestamps("declined", declining),
        decline_reason: declineReason.trim() || null,
      })
      .eq("id", declining.id);
    if (error) {
      console.error("Mark declined failed:", error);
      alert(`Mark declined failed: ${error.message}`);
      return;
    }
    if (declining.opportunity_id && oppAction) {
      const now = new Date().toISOString();
      const patch =
        oppAction === "lost"
          ? { stage: "lost", lost_at: now, won_at: null, last_touch_at: now }
          : { stage: "qualified", last_touch_at: now };
      await supabase
        .from("opportunities")
        .update(patch)
        .eq("id", declining.opportunity_id);
    }
    setDeclining(null);
    setDeclineReason("");
    await load();
  }

  async function createAgreement(p: Proposal) {
    const { DEFAULT_KICKOFF_ITEMS } = await import(
      "@/lib/defaults/kickoff-checklist"
    );
    const { DEFAULT_LEGAL_TERMS } = await import("@/lib/defaults/legal-terms");

    const p1Items = Array.isArray(p.p1_items) ? p.p1_items : [];
    const phase1Items = p1Items
      .map((it) => {
        const name = (
          (it.title ?? it.name ?? "") as string
        ).trim();
        if (!name) return null;
        const qty = Number(it.qty ?? it.quantity ?? 1) || 1;
        const rate = Number(it.rate ?? it.price ?? 0) || 0;
        return {
          name,
          price: qty * rate,
          description: ((it.description ?? it.desc ?? "") as string) || "",
        };
      })
      .filter((x): x is { name: string; price: number; description: string } =>
        x !== null,
      );

    const p1DiscountAmt = Number(p.p1_discount_amount ?? 0) || 0;
    const p1Subtotal = phase1Items.reduce((s, it) => s + it.price, 0);

    const p2Rate =
      Number(p.p2_rate ?? 0) || Number(p.p2_total ?? 0) || 0;
    const p2DiscountAmt = Number(p.p2_discount_amount ?? 0) || 0;

    const commitmentDigits = String(p.phase2_commitment ?? "").replace(
      /[^0-9]/g,
      "",
    );
    const phase2Commitment = parseInt(commitmentDigits, 10) || 3;

    const { data: existing } = await supabase
      .from("agreements")
      .select("id, number");
    const nums = (existing ?? []).map((r) => ({
      number: r.number as string | null,
    }));
    const finalNumber = nextInvoiceNumber(nums, "ATMSA").replace(/^#/, "");

    // Resolve the client. Prefer the proposal's client_id (the FK is now
    // populated for any proposal that went through the picker). Fall back
    // to email/company match for any pre-FK proposal.
    let resolvedClientId: string | null = p.client_id ?? null;
    let clientAddress: string | null = null;
    if (resolvedClientId) {
      const { data: clientRow } = await supabase
        .from("clients")
        .select("address")
        .eq("id", resolvedClientId)
        .maybeSingle();
      clientAddress = (clientRow?.address as string | null) ?? null;
    } else {
      const emailKey = (p.client_email ?? "").trim().toLowerCase();
      const companyKey = (p.client_company ?? "").trim().toLowerCase();
      if (emailKey || companyKey) {
        const { data: clientRows } = await supabase
          .from("clients")
          .select("id, email, company, address");
        const match = (clientRows ?? []).find((c) => {
          const ce = (c.email ?? "").toLowerCase();
          const cc = (c.company ?? "").toLowerCase();
          return (
            (emailKey && ce === emailKey) || (companyKey && cc === companyKey)
          );
        });
        if (match) {
          resolvedClientId = (match.id as string) ?? null;
          clientAddress = (match.address as string | null) ?? null;
        }
      }
    }
    if (!resolvedClientId) {
      alert(
        "Couldn't link this proposal to a client — the agreement can't be created without one. Open the proposal and pick a client first.",
      );
      return;
    }

    const payload = {
      number: finalNumber,
      date: dateISO(),
      status: "draft",
      proposal_id: p.id,
      proposal_number: p.number,
      proposal_date: p.date,
      opportunity_id: p.opportunity_id,
      client_id: resolvedClientId,
      client_name: p.client_name,
      client_email: p.client_email,
      client_company: p.client_company,
      client_address: clientAddress,
      phase1_items: phase1Items,
      phase1_total: p1Subtotal,
      phase1_discount: p1DiscountAmt,
      phase1_timeline: p.phase1_timeline,
      phase1_payment:
        settings.agreement_default_phase1_payment ??
        "50% upon signing, 50% upon delivery",
      phase2_service: p.phase2_title,
      phase2_rate: p2Rate,
      phase2_discount: p2DiscountAmt,
      phase2_commitment: phase2Commitment,
      phase2_start_date: null,
      kickoff_items: DEFAULT_KICKOFF_ITEMS,
      terms: DEFAULT_LEGAL_TERMS,
      notes: p.notes,
    };

    const { data: inserted, error } = await supabase
      .from("agreements")
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      console.error("Create agreement failed:", error);
      alert(`Create agreement failed: ${error.message}`);
      return;
    }
    router.push(`/agreements?edit=${inserted?.id ?? ""}`);
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Proposals</h1>
        </div>
        <div className="flex gap-2">
          <a
            className="btn btn-secondary"
            href="/capabilities.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download Capabilities Deck
          </a>
          <button className="btn btn-primary" onClick={startNew}>
            + New proposal
          </button>
        </div>
      </header>

      <section className="grid-5">
        <Kpi label="Total" value={String(stats.total)} hint="all proposals" />
        <Kpi
          label="Open"
          value={String(stats.sent)}
          hint="sent proposals"
          accent
        />
        <Kpi
          label="Win rate"
          value={`${stats.winRate}%`}
          hint="of closed proposals"
        />
        <Kpi
          label="Phase 1 pipeline"
          value={currency(stats.pipelinePhase1, currencyCode)}
          hint="sent proposals"
        />
        <Kpi
          label="Phase 2 pipeline"
          value={`${currency(stats.pipelinePhase2, currencyCode)}/mo`}
          hint="sent proposals"
        />
      </section>

      <div className="tabs" style={{ marginBottom: "var(--sp-5)" }}>
        {TAB_FILTERS.map((t) => (
          <button
            key={t}
            className={`tab-btn ${filter === t ? "active" : ""}`}
            onClick={() => setFilter(t)}
          >
            {TAB_LABEL[t]}
            <span className="tab-count">{counts[t] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="table-wrapper">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Client</th>
                <th>Date</th>
                <th>Valid until</th>
                <th className="td-right">Phase 1</th>
                <th className="td-right">Phase 2</th>
                <th>Status</th>
                <th>Waiting</th>
                <th className="td-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="td-muted">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="td-muted">
                    {filter === "all"
                      ? "No proposals yet."
                      : `No proposals in "${TAB_LABEL[filter]}".`}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="td-mono td-strong">{p.number ?? "—"}</td>
                    <td>{p.client_name ?? "—"}</td>
                    <td className="td-muted">{dateShort(p.date)}</td>
                    <td className="td-muted">{dateShort(p.valid_until)}</td>
                    <td className="td-right td-mono">
                      {currency(proposalPhase1Net(p), currencyCode)}
                    </td>
                    <td className="td-right td-mono">
                      {proposalPhase2Net(p) > 0
                        ? `${currency(proposalPhase2Net(p), currencyCode)}/mo`
                        : "—"}
                    </td>
                    <td>
                      <span className={`badge status-${p.status ?? "draft"}`}>
                        {p.status ?? "draft"}
                      </span>
                    </td>
                    {(() => {
                      const days =
                        p.status === "sent" ? daysSince(p.sent_at) : null;
                      const stale = days !== null && days >= STALE_DAYS;
                      return (
                        <td
                          className="td-muted"
                          style={
                            stale
                              ? {
                                  color: "var(--danger)",
                                  fontWeight: "var(--fw-semibold)",
                                }
                              : undefined
                          }
                        >
                          {days === null ? "—" : `${days}d`}
                          {stale && (
                            <span
                              className="mono"
                              style={{
                                marginLeft: "var(--sp-2)",
                                fontSize: "var(--fs-11)",
                                color: "var(--danger)",
                              }}
                            >
                              stale
                            </span>
                          )}
                        </td>
                      );
                    })()}
                    <td
                      className="td-right"
                      style={{ minWidth: 180, whiteSpace: "nowrap" }}
                    >
                      <div
                        className="flex gap-1"
                        style={{
                          justifyContent: "flex-end",
                          alignItems: "center",
                        }}
                      >
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => setPreviewing(p)}
                          aria-label="Preview"
                          title="Preview"
                        >
                          <Eye size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => startEdit(p)}
                          aria-label="Edit"
                          title="Edit"
                        >
                          <Pencil size={15} strokeWidth={1.75} />
                        </button>
                        {(p.status === "draft" || !p.status) && (
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => markStatus(p, "sent")}
                            aria-label="Mark sent"
                            title="Mark sent"
                          >
                            <Send size={15} strokeWidth={1.75} />
                          </button>
                        )}
                        {p.status === "sent" && (
                          <>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => markStatus(p, "accepted")}
                              aria-label="Mark accepted"
                              title="Mark accepted"
                            >
                              <Check size={15} strokeWidth={1.75} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => openDecline(p)}
                              aria-label="Mark declined"
                              title="Mark declined"
                            >
                              <X size={15} strokeWidth={1.75} />
                            </button>
                          </>
                        )}
                        {p.status === "accepted" && (
                          <>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => setRequestingDetails(p)}
                              aria-label="Request details"
                              title="Request company details"
                            >
                              <Mail size={15} strokeWidth={1.75} />
                            </button>
                            {p.client_id ? (
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() =>
                                  router.push(`/clients/${p.client_id}`)
                                }
                                aria-label="View client"
                                title="View client"
                              >
                                <Building2 size={15} strokeWidth={1.75} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => setCreatingClient(p)}
                                aria-label="Create client"
                                title="Create client"
                              >
                                <UserPlus size={15} strokeWidth={1.75} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => createAgreement(p)}
                              aria-label="Create agreement"
                              title="Create agreement"
                            >
                              <FileSignature size={15} strokeWidth={1.75} />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => setDeleting(p)}
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

      <ProposalForm
        open={!!editing}
        draft={editing}
        services={services}
        clients={clients}
        saving={saving}
        onChange={setEditing}
        onClose={() => setEditing(null)}
        onSubmit={handleSave}
        onCreateClient={handleCreateClient}
      />

      <ProposalPreview
        open={!!previewing}
        proposal={previewing}
        settings={settings}
        onClose={() => setPreviewing(null)}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Delete proposal?"
        message="This action cannot be undone."
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />

      <Modal
        open={!!declining}
        onClose={() => setDeclining(null)}
        title={`Decline ${declining?.number ?? "proposal"}?`}
        maxWidth={440}
        footer={
          declining?.opportunity_id ? (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeclining(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => runDecline("qualified")}
              >
                Keep opp open
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => runDecline("lost")}
              >
                Mark opp lost
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeclining(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => runDecline(null)}
              >
                Mark declined
              </button>
            </>
          )
        }
      >
        <div className="form-group">
          <label className="form-label">Decline reason (optional)</label>
          <textarea
            rows={3}
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Price, timing, fit, went with a competitor, …"
            autoFocus
          />
          <div className="caption" style={{ marginTop: "var(--sp-1)" }}>
            Stamps the decline date. A reason helps track why deals die.
          </div>
          {declining?.opportunity_id && (
            <div className="caption" style={{ marginTop: "var(--sp-2)" }}>
              Linked to a pipeline opportunity. <strong>Mark opp lost</strong>{" "}
              ends the deal; <strong>Keep opp open</strong> returns it to
              qualified.
            </div>
          )}
        </div>
      </Modal>

      <RequestDetailsModal
        open={!!requestingDetails}
        proposal={requestingDetails}
        onClose={() => setRequestingDetails(null)}
      />

      <CreateClientModal
        open={!!creatingClient}
        proposal={creatingClient}
        saving={savingClient}
        onClose={() => setCreatingClient(null)}
        onSubmit={handleCreateClientFromProposal}
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
