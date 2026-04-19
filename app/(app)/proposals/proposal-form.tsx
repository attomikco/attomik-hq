"use client";

import { Modal } from "@/components/modal";
import { currencyCompact } from "@/lib/format";

export type P1Type = "new_build" | "growth_layer" | "retainer_only";

export type P1TypeMeta = {
  key: P1Type;
  label: string;
  subtitle: string;
  price: number;
  title: string;
  timeline: string;
  payment: string;
};

export const P1_TYPES: P1TypeMeta[] = [
  {
    key: "new_build",
    label: "New Build",
    subtitle: "DTC Strategy + Store Build",
    price: 8000,
    title: "DTC Strategy + Store Build",
    timeline: "20 – 45 days",
    payment: "$5k to start · $3k on launch",
  },
  {
    key: "growth_layer",
    label: "Growth Layer",
    subtitle: "Existing Store Optimization",
    price: 6000,
    title: "Growth Layer — Existing Store",
    timeline: "10 – 20 days",
    payment: "$3k to start · $3k on completion",
  },
  {
    key: "retainer_only",
    label: "Retainer Only",
    subtitle: "No setup phase",
    price: 0,
    title: "",
    timeline: "—",
    payment: "—",
  },
];

export type P1AddonKey =
  | "p1_second_store"
  | "p1_amazon"
  | "p1_tiktok"
  | "p1_email_template";

export const P1_ADDONS: { key: P1AddonKey; label: string; price: number }[] = [
  { key: "p1_second_store", label: "Second store", price: 2000 },
  { key: "p1_amazon", label: "Amazon channel setup", price: 1000 },
  { key: "p1_tiktok", label: "TikTok Shop setup", price: 1000 },
  { key: "p1_email_template", label: "Email master template", price: 1000 },
];

export type P2Bundle =
  | "dtc_meta"
  | "dtc_amazon"
  | "dtc_meta_amazon"
  | "dtc_meta_amazon_tiktok"
  | "full_scale"
  | "full_creative"
  | "fractional"
  | "custom";

export const P2_BUNDLES: { key: P2Bundle; label: string; monthly: number }[] = [
  { key: "dtc_meta", label: "DTC + Meta Bundle", monthly: 4000 },
  { key: "dtc_amazon", label: "DTC + Amazon Bundle", monthly: 5000 },
  { key: "dtc_meta_amazon", label: "DTC + Meta + Amazon Bundle", monthly: 6000 },
  {
    key: "dtc_meta_amazon_tiktok",
    label: "DTC + Meta + Amazon + TikTok Bundle",
    monthly: 7000,
  },
  { key: "full_scale", label: "Full-Scale Ecom Growth Bundle", monthly: 8000 },
  { key: "full_creative", label: "Full Creative Growth Bundle", monthly: 8000 },
  { key: "fractional", label: "Fractional Ecom Director", monthly: 10000 },
  { key: "custom", label: "Custom", monthly: 0 },
];

export function p1TypeMeta(t: P1Type): P1TypeMeta {
  return P1_TYPES.find((x) => x.key === t) ?? P1_TYPES[0];
}

export function p2BundleMeta(k: P2Bundle) {
  return P2_BUNDLES.find((x) => x.key === k) ?? P2_BUNDLES[0];
}

export function formatMoney(n: number) {
  return currencyCompact(n);
}

export type ProposalDraft = {
  id?: string;
  number: string;
  date: string;
  valid_until: string;
  status: string;
  client_name: string;
  client_email: string;
  client_company: string;
  intro: string;
  notes: string;
  p1_type: P1Type;
  phase1_title: string;
  phase1_price: string;
  phase1_compare: string;
  phase1_note: string;
  phase1_timeline: string;
  phase1_payment: string;
  p1_second_store: boolean;
  p1_amazon: boolean;
  p1_tiktok: boolean;
  p1_email_template: boolean;
  p1_total: number;
  p2_bundle: P2Bundle;
  phase2_title: string;
  phase2_monthly: string;
  phase2_compare: string;
  phase2_note: string;
  phase2_commitment: string;
  p2_total: number;
};

function computeP1Total(draft: ProposalDraft): number {
  const base = p1TypeMeta(draft.p1_type).price;
  let extras = 0;
  for (const addon of P1_ADDONS) {
    if (draft[addon.key]) extras += addon.price;
  }
  return base + extras;
}

export function applyP1TypeChange(
  draft: ProposalDraft,
  type: P1Type,
): ProposalDraft {
  const meta = p1TypeMeta(type);
  const next: ProposalDraft = {
    ...draft,
    p1_type: type,
    phase1_title: meta.title,
    phase1_timeline: meta.timeline,
    phase1_payment: meta.payment,
    p1_second_store:
      type === "retainer_only" ? false : draft.p1_second_store,
    p1_amazon: type === "retainer_only" ? false : draft.p1_amazon,
    p1_tiktok: type === "retainer_only" ? false : draft.p1_tiktok,
    p1_email_template:
      type === "retainer_only" ? false : draft.p1_email_template,
  };
  const total = computeP1Total(next);
  next.p1_total = total;
  next.phase1_price = total > 0 ? formatMoney(total) : "";
  return next;
}

export function applyP1AddonChange(
  draft: ProposalDraft,
  key: P1AddonKey,
  value: boolean,
): ProposalDraft {
  const next = { ...draft, [key]: value } as ProposalDraft;
  const total = computeP1Total(next);
  next.p1_total = total;
  next.phase1_price = total > 0 ? formatMoney(total) : "";
  return next;
}

export function applyP2BundleChange(
  draft: ProposalDraft,
  bundle: P2Bundle,
): ProposalDraft {
  if (bundle === "custom") {
    return { ...draft, p2_bundle: bundle };
  }
  const meta = p2BundleMeta(bundle);
  return {
    ...draft,
    p2_bundle: bundle,
    phase2_title: meta.label,
    phase2_monthly: `${formatMoney(meta.monthly)} / mo`,
    p2_total: meta.monthly,
  };
}

export default function ProposalForm({
  open,
  draft,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  draft: ProposalDraft | null;
  saving: boolean;
  onChange: (d: ProposalDraft) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  if (!draft) return null;

  const isRetainerOnly = draft.p1_type === "retainer_only";
  const isCustomBundle = draft.p2_bundle === "custom";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={draft.id ? `Edit ${draft.number}` : "New proposal"}
      maxWidth={780}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="proposal-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save proposal"}
          </button>
        </>
      }
    >
      <form
        id="proposal-form"
        onSubmit={onSubmit}
        className="flex-col"
        style={{ gap: "var(--sp-5)" }}
      >
        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Number</label>
            <input
              className="mono"
              required
              value={draft.number}
              onChange={(e) => onChange({ ...draft, number: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input
              type="date"
              required
              value={draft.date}
              onChange={(e) => onChange({ ...draft, date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Valid until</label>
            <input
              type="date"
              value={draft.valid_until}
              onChange={(e) =>
                onChange({ ...draft, valid_until: e.target.value })
              }
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Status</label>
          <select
            value={draft.status}
            onChange={(e) => onChange({ ...draft, status: e.target.value })}
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
          </select>
        </div>

        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Client name</label>
            <input
              value={draft.client_name}
              onChange={(e) =>
                onChange({ ...draft, client_name: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Client email</label>
            <input
              type="email"
              value={draft.client_email}
              onChange={(e) =>
                onChange({ ...draft, client_email: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Company</label>
            <input
              value={draft.client_company}
              onChange={(e) =>
                onChange({ ...draft, client_company: e.target.value })
              }
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Intro message</label>
          <textarea
            rows={4}
            value={draft.intro}
            onChange={(e) => onChange({ ...draft, intro: e.target.value })}
          />
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Phase 1 · delivery</div>
          <div className="section-header-line" />
        </div>

        <div className="form-group">
          <label className="form-label">Type</label>
          <div
            className="flex-col"
            style={{ gap: "var(--sp-2)", marginTop: "var(--sp-1)" }}
          >
            {P1_TYPES.map((t) => {
              const selected = draft.p1_type === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onChange(applyP1TypeChange(draft, t.key))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--sp-3)",
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    padding: "var(--sp-3) var(--sp-4)",
                    background: "var(--paper)",
                    borderColor: selected ? "var(--accent)" : "var(--border)",
                    borderWidth: selected ? 2 : 1,
                    borderStyle: "solid",
                    borderRadius: "var(--r-md)",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      border: `2px solid ${
                        selected ? "var(--accent)" : "var(--border)"
                      }`,
                      background: selected ? "var(--accent)" : "transparent",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: "var(--fw-semibold)" }}>
                    {t.label}
                  </span>
                  <span className="caption" style={{ flex: 1 }}>
                    {t.subtitle}
                  </span>
                  <span
                    className="mono"
                    style={{ fontWeight: "var(--fw-semibold)" }}
                  >
                    {t.price > 0 ? formatMoney(t.price) : "$0"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {!isRetainerOnly && (
          <div className="form-group">
            <label className="form-label">Add-ons</label>
            <div
              className="flex-col"
              style={{ gap: "var(--sp-1)", marginTop: "var(--sp-1)" }}
            >
              {P1_ADDONS.map((a) => (
                <div
                  key={a.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--sp-2) 0",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--sp-2)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!draft[a.key]}
                      onChange={(e) =>
                        onChange(
                          applyP1AddonChange(draft, a.key, e.target.checked),
                        )
                      }
                    />
                    <span>{a.label}</span>
                  </label>
                  <span className="mono" style={{ color: "var(--muted)" }}>
                    +{formatMoney(a.price)}
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "baseline",
                gap: "var(--sp-2)",
                marginTop: "var(--sp-2)",
                paddingTop: "var(--sp-2)",
                borderTop: "1px solid var(--border)",
                fontWeight: "var(--fw-bold)",
              }}
            >
              <span>Phase 1 total:</span>
              <span className="mono" style={{ color: "var(--accent)" }}>
                {formatMoney(draft.p1_total || 0)}
              </span>
            </div>
          </div>
        )}

        {isRetainerOnly && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "baseline",
              gap: "var(--sp-2)",
              paddingTop: "var(--sp-2)",
              borderTop: "1px solid var(--border)",
              fontWeight: "var(--fw-bold)",
            }}
          >
            <span>Phase 1 total:</span>
            <span className="mono" style={{ color: "var(--accent)" }}>
              {formatMoney(draft.p1_total || 0)}
            </span>
          </div>
        )}

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Timeline</label>
            <input
              value={draft.phase1_timeline}
              onChange={(e) =>
                onChange({ ...draft, phase1_timeline: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Payment terms</label>
            <input
              value={draft.phase1_payment}
              onChange={(e) =>
                onChange({ ...draft, phase1_payment: e.target.value })
              }
            />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Standard Rate</label>
            <input
              value={draft.phase1_compare}
              onChange={(e) =>
                onChange({ ...draft, phase1_compare: e.target.value })
              }
              placeholder="e.g. $10,000"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Note</label>
            <input
              value={draft.phase1_note}
              onChange={(e) =>
                onChange({ ...draft, phase1_note: e.target.value })
              }
              placeholder="e.g. Early Stage Rate"
            />
          </div>
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Phase 2 · partnership</div>
          <div className="section-header-line" />
        </div>

        <div className="form-group">
          <label className="form-label">Bundle</label>
          <select
            value={draft.p2_bundle}
            onChange={(e) =>
              onChange(applyP2BundleChange(draft, e.target.value as P2Bundle))
            }
          >
            {P2_BUNDLES.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
                {b.key !== "custom" ? ` — ${formatMoney(b.monthly)}/mo` : ""}
              </option>
            ))}
          </select>
        </div>

        {isCustomBundle && (
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Title</label>
              <input
                value={draft.phase2_title}
                onChange={(e) =>
                  onChange({ ...draft, phase2_title: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Monthly rate</label>
              <input
                value={draft.phase2_monthly}
                onChange={(e) => {
                  const money =
                    parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0;
                  onChange({
                    ...draft,
                    phase2_monthly: e.target.value,
                    p2_total: money,
                  });
                }}
                placeholder="e.g. $3,500 / mo"
              />
            </div>
          </div>
        )}

        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Commitment</label>
            <input
              value={draft.phase2_commitment}
              onChange={(e) =>
                onChange({ ...draft, phase2_commitment: e.target.value })
              }
              placeholder="e.g. 6 months"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Standard Rate</label>
            <input
              value={draft.phase2_compare}
              onChange={(e) =>
                onChange({ ...draft, phase2_compare: e.target.value })
              }
              placeholder="e.g. $5,000 / mo"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Note</label>
            <input
              value={draft.phase2_note}
              onChange={(e) =>
                onChange({ ...draft, phase2_note: e.target.value })
              }
              placeholder="e.g. Early Stage Rate"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            rows={3}
            value={draft.notes}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          />
        </div>
      </form>
    </Modal>
  );
}
