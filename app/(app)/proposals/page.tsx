"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  currency,
  dateShort,
  dateISO,
  addDays,
  proposalTotal,
  nextInvoiceNumber,
} from "@/lib/format";
import { ConfirmDialog } from "@/components/modal";
import {
  type Invoice,
  type Proposal,
  type SettingsMap,
} from "@/lib/types";
import ProposalForm, {
  type ProposalDraft,
  type P1Type,
  type P2Bundle,
  P1_ADDONS,
  P2_BUNDLES,
  p1TypeMeta,
  p2BundleMeta,
} from "./proposal-form";
import ProposalPreview from "./proposal-preview";

function nextProposalNumber(existing: { number: string | null }[]) {
  return nextInvoiceNumber(existing, "PROP");
}

function emptyDraft(number: string): ProposalDraft {
  const today = dateISO();
  const valid = dateISO(addDays(new Date(), 30));
  const meta = p1TypeMeta("new_build");
  return {
    number,
    date: today,
    valid_until: valid,
    status: "draft",
    client_name: "",
    client_email: "",
    client_company: "",
    intro: "",
    notes: "",
    p1_type: "new_build",
    phase1_title: meta.title,
    phase1_price: `$${meta.price.toLocaleString("en-US")}`,
    phase1_compare: "",
    phase1_note: "",
    phase1_timeline: meta.timeline,
    phase1_payment: meta.payment,
    p1_second_store: false,
    p1_amazon: false,
    p1_tiktok: false,
    p1_email_template: false,
    p1_total: meta.price,
    p1_discount: 0,
    p2_bundle: "growth_ads",
    phase2_title: p2BundleMeta("growth_ads").label,
    phase2_monthly: `$${p2BundleMeta("growth_ads").monthly.toLocaleString(
      "en-US",
    )} / mo`,
    phase2_compare: "",
    phase2_note: "",
    phase2_commitment: "3",
    p2_total: p2BundleMeta("growth_ads").monthly,
    p2_discount: 0,
    p2_second_store: false,
  };
}

export default function ProposalsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProposalDraft | null>(null);
  const [previewing, setPreviewing] = useState<Proposal | null>(null);
  const [deleting, setDeleting] = useState<Proposal | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: props }, { data: invs }, { data: stg }] = await Promise.all([
      supabase
        .from("proposals")
        .select("*")
        .order("date", { ascending: false }),
      supabase
        .from("invoices")
        .select("id, number")
        .order("date", { ascending: false })
        .limit(500),
      supabase.from("settings").select("key, value"),
    ]);
    setProposals((props as Proposal[] | null) ?? []);
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

  const currencyCode = settings.currency ?? "USD";

  const stats = useMemo(() => {
    const total = proposals.length;
    const sent = proposals.filter((p) => p.status === "sent").length;
    const accepted = proposals.filter((p) => p.status === "accepted").length;
    const closed = proposals.filter(
      (p) => p.status === "accepted" || p.status === "declined",
    ).length;
    const winRate = closed > 0 ? Math.round((accepted / closed) * 100) : 0;
    const pipelineValue = proposals
      .filter((p) => p.status === "sent")
      .reduce((sum, p) => sum + proposalTotal(p), 0);
    return { total, sent, winRate, pipelineValue };
  }, [proposals]);

  function startNew() {
    setEditing(emptyDraft(nextProposalNumber(proposals)));
  }

  function startEdit(p: Proposal) {
    const p1Type = (p.p1_type as P1Type | null) ?? "new_build";
    const knownBundleKeys = P2_BUNDLES.map((b) => b.key) as string[];
    const rawBundle = p.p2_bundle ?? "";
    const isKnownBundle = knownBundleKeys.includes(rawBundle);
    const p2Bundle: P2Bundle = isKnownBundle
      ? (rawBundle as P2Bundle)
      : "growth_ads";
    const p2Meta = p2BundleMeta(p2Bundle);
    const phase2Title = isKnownBundle
      ? p.phase2_title ?? ""
      : p2Meta.label;
    const phase2Monthly = isKnownBundle
      ? p.phase2_monthly ?? ""
      : `$${p2Meta.monthly.toLocaleString("en-US")} / mo`;
    const p2Total = isKnownBundle ? Number(p.p2_total ?? 0) : p2Meta.monthly;
    setEditing({
      id: p.id,
      number: p.number ?? nextProposalNumber(proposals),
      date: p.date ?? dateISO(),
      valid_until: p.valid_until ?? dateISO(addDays(new Date(), 30)),
      status: p.status ?? "draft",
      client_name: p.client_name ?? "",
      client_email: p.client_email ?? "",
      client_company: p.client_company ?? "",
      intro: p.intro ?? "",
      notes: p.notes ?? "",
      p1_type: p1Type,
      phase1_title: p.phase1_title ?? "",
      phase1_price: p.phase1_price ?? "",
      phase1_compare: p.phase1_compare ?? "",
      phase1_note: p.phase1_note ?? "",
      phase1_timeline: p.phase1_timeline ?? "",
      phase1_payment: p.phase1_payment ?? "",
      p1_second_store: !!p.p1_second_store,
      p1_amazon: !!p.p1_amazon,
      p1_tiktok: !!p.p1_tiktok,
      p1_email_template: !!p.p1_email_template,
      p1_total: Number(p.p1_total ?? 0),
      p1_discount: Number(p.p1_discount ?? 0),
      p2_bundle: p2Bundle,
      phase2_title: phase2Title,
      phase2_monthly: phase2Monthly,
      phase2_compare: p.phase2_compare ?? "",
      phase2_note: p.phase2_note ?? "",
      phase2_commitment: p.phase2_commitment ?? "",
      p2_total: p2Total,
      p2_discount: Number(p.p2_discount ?? 0),
      p2_second_store: !!p.p2_second_store,
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const payload = {
      number: editing.number,
      date: editing.date,
      valid_until: editing.valid_until || null,
      status: editing.status,
      client_name: editing.client_name,
      client_email: editing.client_email,
      client_company: editing.client_company,
      intro: editing.intro,
      notes: editing.notes,
      p1_type: editing.p1_type,
      phase1_title: editing.phase1_title,
      phase1_price: editing.phase1_price,
      phase1_compare: editing.phase1_compare,
      phase1_note: editing.phase1_note,
      phase1_timeline: editing.phase1_timeline,
      phase1_payment: editing.phase1_payment,
      p1_second_store: editing.p1_second_store,
      p1_amazon: editing.p1_amazon,
      p1_tiktok: editing.p1_tiktok,
      p1_email_template: editing.p1_email_template,
      p1_total: editing.p1_total,
      p1_discount: editing.p1_discount ?? 0,
      p2_bundle: editing.p2_bundle,
      phase2_title: editing.phase2_title,
      phase2_monthly: editing.phase2_monthly,
      phase2_compare: editing.phase2_compare,
      phase2_note: editing.phase2_note,
      phase2_commitment: editing.phase2_commitment,
      p2_total: editing.p2_total,
      p2_discount: editing.p2_discount ?? 0,
      p2_second_store: editing.p2_second_store,
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
    setEditing(null);
    await load();
  }

  async function handleDelete() {
    if (!deleting) return;
    await supabase.from("proposals").delete().eq("id", deleting.id);
    setDeleting(null);
    await load();
  }

  async function convertToInvoice(p: Proposal) {
    const today = dateISO();
    const due = dateISO(addDays(new Date(), 15));
    const clientFields = {
      client_name: p.client_name,
      client_email: p.client_email,
      client_company: p.client_company,
      client_address: null,
    };
    const p1Type = (p.p1_type as P1Type | null) ?? "new_build";

    if (p1Type === "retainer_only") {
      const bundleKey = (p.p2_bundle as P2Bundle | null) ?? "custom";
      const bundleTitle =
        bundleKey === "custom"
          ? p.phase2_title ?? "Monthly retainer"
          : p2BundleMeta(bundleKey).label;
      const monthlyBase = Number(p.p2_total ?? 0);
      const discount = Number(p.p2_discount ?? 0) || 0;
      const monthlyNet = Math.max(
        0,
        monthlyBase - monthlyBase * (discount / 100),
      );
      const monthly = monthlyNet + (p.p2_second_store ? 1500 : 0);
      const number = nextInvoiceNumber(invoices);
      await supabase.from("invoices").insert({
        number,
        date: today,
        due,
        status: "draft",
        ...clientFields,
        items: [
          {
            service_id: null,
            title: bundleTitle,
            description: "First month retainer",
            qty: 1,
            rate: monthly,
          },
        ],
        discount: 0,
        notes: p.notes,
      });
    } else {
      const base = p1TypeMeta(p1Type).price;
      const depositAmount = Math.round(base * 0.6);
      const finalAmount = base - depositAmount;
      const p1DiscountPct = Number(p.p1_discount ?? 0) || 0;
      const isNewBuild = p1Type === "new_build";
      const depositTitle = isNewBuild
        ? "DTC Strategy + Store Build — Deposit"
        : "Growth Layer — Existing Store - Deposit";
      const finalTitle = isNewBuild
        ? "DTC Strategy + Store Build — Final Payment"
        : "Growth Layer — Existing Store - Final Payment";

      const addonItems = P1_ADDONS.filter(
        (a) => !!(p as unknown as Record<string, unknown>)[a.key],
      ).map((a) => ({
        service_id: null,
        title: a.label,
        description: "",
        qty: 1,
        rate: a.price,
      }));

      const depositNumber = nextInvoiceNumber(invoices);
      await supabase.from("invoices").insert({
        number: depositNumber,
        date: today,
        due,
        status: "draft",
        ...clientFields,
        items: [
          {
            service_id: null,
            title: depositTitle,
            description: "",
            qty: 1,
            rate: depositAmount,
          },
          ...addonItems,
        ],
        discount: p1DiscountPct,
        notes: "Deposit — due to start",
      });

      const finalNumber = nextInvoiceNumber([
        ...invoices,
        { id: "tmp", number: depositNumber } as Invoice,
      ]);
      await supabase.from("invoices").insert({
        number: finalNumber,
        date: today,
        due,
        status: "draft",
        ...clientFields,
        items: [
          {
            service_id: null,
            title: finalTitle,
            description: "",
            qty: 1,
            rate: finalAmount,
          },
        ],
        discount: p1DiscountPct,
        notes: "Final payment — due on launch",
      });
    }

    await supabase
      .from("proposals")
      .update({ status: "accepted" })
      .eq("id", p.id);
    router.push("/invoices");
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

      <section className="grid-4">
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
          label="Pipeline value"
          value={currency(stats.pipelineValue, currencyCode)}
          hint="sent proposals"
        />
      </section>

      <div className="section-header">
        <div className="section-header-bar" />
        <div className="section-header-title">All proposals</div>
        <div className="section-header-line" />
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
                <th className="td-right">Amount</th>
                <th>Status</th>
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
              ) : proposals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="td-muted">
                    No proposals yet.
                  </td>
                </tr>
              ) : (
                proposals.map((p) => (
                  <tr key={p.id}>
                    <td className="td-mono td-strong">{p.number ?? "—"}</td>
                    <td>{p.client_name ?? "—"}</td>
                    <td className="td-muted">{dateShort(p.date)}</td>
                    <td className="td-muted">{dateShort(p.valid_until)}</td>
                    <td className="td-right td-mono">
                      {currency(proposalTotal(p), currencyCode)}
                    </td>
                    <td>
                      <span className={`badge status-${p.status ?? "draft"}`}>
                        {p.status ?? "draft"}
                      </span>
                    </td>
                    <td className="td-right">
                      <div
                        className="flex gap-2"
                        style={{ justifyContent: "flex-end", flexWrap: "wrap" }}
                      >
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => setPreviewing(p)}
                        >
                          Preview
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => startEdit(p)}
                        >
                          Edit
                        </button>
                        {p.status === "accepted" && (
                          <button
                            className="btn btn-dark btn-xs"
                            onClick={() => convertToInvoice(p)}
                          >
                            → Invoice
                          </button>
                        )}
                        <button
                          className="btn btn-danger btn-xs"
                          onClick={() => setDeleting(p)}
                        >
                          Delete
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
        saving={saving}
        onChange={setEditing}
        onClose={() => setEditing(null)}
        onSubmit={handleSave}
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
