"use client";

import { currencyCompact, dateShort, lineSubtotal } from "@/lib/format";
import { Modal } from "@/components/modal";
import PDFDownloadButton from "@/components/pdf-download-button";
import type { Proposal, SettingsMap } from "@/lib/types";

export default function ProposalPreview({
  open,
  proposal,
  settings,
  onClose,
}: {
  open: boolean;
  proposal: Proposal | null;
  settings: SettingsMap;
  onClose: () => void;
}) {
  if (!proposal) return null;

  const p1Items = Array.isArray(proposal.p1_items) ? proposal.p1_items : [];
  const hasNewItems = p1Items.length > 0 && lineSubtotal(p1Items) > 0;
  const p1Base = hasNewItems
    ? lineSubtotal(p1Items)
    : Number(proposal.p1_total ?? 0) || 0;
  const p1Discount = Number(proposal.p1_discount ?? 0) || 0;
  const p1HasDiscount = p1Base > 0 && p1Discount > 0;
  const p1Net = p1HasDiscount
    ? Math.max(0, p1Base - p1Base * (p1Discount / 100))
    : p1Base;

  const p1CompareNum = parseFloat(
    String(proposal.phase1_compare ?? "").replace(/[^0-9.]/g, ""),
  );
  const showP1Compare =
    !isNaN(p1CompareNum) && p1CompareNum > 0 && p1CompareNum !== p1Net;

  const p2RateStored = Number(proposal.p2_rate ?? 0) || 0;
  const p2RateFallback = Number(proposal.p2_total ?? 0) || 0;
  const p2Base = p2RateStored > 0 ? p2RateStored : p2RateFallback;
  const p2Discount = Number(proposal.p2_discount ?? 0) || 0;
  const p2HasDiscount = p2Base > 0 && p2Discount > 0;
  const p2Net = p2HasDiscount
    ? Math.max(0, p2Base - p2Base * (p2Discount / 100))
    : p2Base;

  const p2CompareNum = parseFloat(
    String(proposal.phase2_compare ?? "").replace(/[^0-9.]/g, ""),
  );
  const showP2Compare =
    !isNaN(p2CompareNum) && p2CompareNum > 0 && p2CompareNum !== p2Net;

  const commitmentDigits = String(proposal.phase2_commitment ?? "").replace(
    /[^0-9]/g,
    "",
  );
  const commitmentN = parseInt(commitmentDigits, 10);
  const introMonths =
    isNaN(commitmentN) || commitmentN <= 0 ? 3 : commitmentN;
  const showIntroRate =
    p2HasDiscount || !!String(proposal.phase2_note ?? "").trim();

  const p1Title = hasNewItems
    ? p1Items
        .map((it) => (it.title ?? it.name ?? "") as string)
        .filter(Boolean)
        .join(" · ") || "Phase 1"
    : proposal.phase1_title ?? "Phase 1";
  const p2Title = proposal.phase2_title || "Phase 2 Retainer";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Preview · ${proposal.number ?? "Proposal"}`}
      maxWidth={720}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} type="button">
            Close
          </button>
          <PDFDownloadButton
            type="proposal"
            data={proposal}
            settings={settings as Record<string, string | undefined>}
            label="Download PDF"
          />
        </>
      }
    >
      <div
        style={{
          padding: "var(--sp-7)",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--border)",
          background: "var(--paper)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "var(--sp-6)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: "var(--fw-heading)",
                letterSpacing: "var(--ls-tight)",
              }}
            >
              {settings.brand_name ?? "Attomik"}
            </div>
            {settings.legal_name && (
              <div className="caption">{settings.legal_name}</div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="label mono">Proposal</div>
            <div
              className="mono"
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: "var(--fw-bold)",
              }}
            >
              {proposal.number ?? "—"}
            </div>
            <div className="caption mono">
              {dateShort(proposal.date)} → {dateShort(proposal.valid_until)}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "var(--sp-4) 0",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
            marginBottom: "var(--sp-5)",
          }}
        >
          <div>
            <div className="label mono">Prepared for</div>
            <div
              style={{
                fontWeight: "var(--fw-semibold)",
                marginTop: "var(--sp-1)",
              }}
            >
              {proposal.client_name ?? "—"}
            </div>
            {proposal.client_company && (
              <div className="caption">{proposal.client_company}</div>
            )}
            {proposal.client_email && (
              <div className="caption mono">{proposal.client_email}</div>
            )}
          </div>
          <div>
            <span className={`badge status-${proposal.status ?? "draft"}`}>
              {proposal.status ?? "draft"}
            </span>
          </div>
        </div>

        {proposal.intro && (
          <p
            className="caption"
            style={{
              whiteSpace: "pre-line",
              marginBottom: "var(--sp-5)",
              fontSize: "var(--text-base)",
              color: "var(--ink)",
            }}
          >
            {proposal.intro}
          </p>
        )}

        {p1Base > 0 && (
          <div
            className="card"
            style={{
              marginTop: "var(--sp-6)",
              background: "var(--cream)",
              borderColor: "var(--border)",
            }}
          >
            <div className="label mono">Phase 1</div>
            <div
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: "var(--fw-bold)",
                marginTop: "var(--sp-1)",
              }}
            >
              {p1Title}
            </div>
            {hasNewItems && (
              <ul
                className="caption"
                style={{
                  marginTop: "var(--sp-2)",
                  paddingLeft: "var(--sp-5)",
                }}
              >
                {p1Items.map((it, i) => (
                  <li key={i}>
                    {(it.title ?? it.name ?? "Service") as string} ·{" "}
                    {currencyCompact(
                      (Number(it.qty ?? it.quantity ?? 1) || 0) *
                        (Number(it.rate ?? it.price ?? 0) || 0),
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div
              style={{
                marginTop: "var(--sp-2)",
                display: "flex",
                alignItems: "baseline",
                gap: "var(--sp-2)",
                flexWrap: "wrap",
              }}
            >
              {showP1Compare && (
                <span
                  className="mono"
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--muted)",
                    textDecoration: "line-through",
                  }}
                >
                  {currencyCompact(p1CompareNum)}
                </span>
              )}
              <span
                className="mono"
                style={{ fontSize: "var(--text-md)" }}
              >
                {currencyCompact(p1Net)}
              </span>
              {p1HasDiscount && (
                <span
                  className="mono"
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--brand-green-dark, var(--accent))",
                    fontWeight: "var(--fw-semibold)",
                  }}
                >
                  ({p1Discount}% off)
                </span>
              )}
              {proposal.phase1_note && (
                <span
                  className="mono"
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--brand-green-dark, var(--accent))",
                    fontWeight: "var(--fw-semibold)",
                  }}
                >
                  · {proposal.phase1_note}
                </span>
              )}
            </div>
            {proposal.phase1_timeline && (
              <div className="caption" style={{ marginTop: "var(--sp-1)" }}>
                Timeline: {proposal.phase1_timeline}
              </div>
            )}
            {proposal.phase1_payment && (
              <div className="caption">
                Payment: {proposal.phase1_payment}
              </div>
            )}
          </div>
        )}

        {p2Base > 0 && (
          <>
            <div
              className="card card-dark"
              style={{ marginTop: "var(--sp-4)" }}
            >
              <div
                className="label mono"
                style={{ color: "var(--white-a50)" }}
              >
                Phase 2
              </div>
              <div
                style={{
                  fontSize: "var(--text-lg)",
                  fontWeight: "var(--fw-bold)",
                  marginTop: "var(--sp-1)",
                  color: "var(--paper)",
                }}
              >
                {p2Title}
              </div>
              <div
                style={{
                  marginTop: "var(--sp-2)",
                  display: "flex",
                  alignItems: "baseline",
                  gap: "var(--sp-2)",
                  flexWrap: "wrap",
                }}
              >
                {(showP2Compare || p2HasDiscount) && (
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--white-a50)",
                      textDecoration: "line-through",
                    }}
                  >
                    {currencyCompact(
                      showP2Compare ? p2CompareNum : p2Base,
                    )}{" "}
                    / mo
                  </span>
                )}
                <span
                  className="mono"
                  style={{
                    fontSize: "var(--text-md)",
                    color: "var(--accent)",
                  }}
                >
                  {currencyCompact(p2Net)} / mo
                </span>
                {p2HasDiscount && (
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--accent)",
                      fontWeight: "var(--fw-semibold)",
                    }}
                  >
                    ({p2Discount}% off)
                  </span>
                )}
                {proposal.phase2_note && (
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--accent)",
                      fontWeight: "var(--fw-semibold)",
                    }}
                  >
                    · {proposal.phase2_note}
                  </span>
                )}
              </div>
              <div
                className="caption"
                style={{
                  marginTop: "var(--sp-1)",
                  color: "var(--white-a70)",
                }}
              >
                Month-by-month · Cancel anytime
              </div>
            </div>
            {showIntroRate && (
              <p
                className="caption"
                style={{
                  marginTop: "var(--sp-2)",
                  fontStyle: "italic",
                  color: "var(--muted)",
                }}
              >
                Introductory rate for the first {introMonths} months. At month{" "}
                {introMonths + 1} we review performance together and align on
                the right rate and commitment going forward.
              </p>
            )}
          </>
        )}

        {proposal.notes && (
          <div
            style={{
              marginTop: "var(--sp-5)",
              paddingTop: "var(--sp-5)",
              borderTop: "1px solid var(--border)",
            }}
          >
            <div className="label mono">Notes</div>
            <p
              className="caption"
              style={{ whiteSpace: "pre-line", marginTop: "var(--sp-2)" }}
            >
              {proposal.notes}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
