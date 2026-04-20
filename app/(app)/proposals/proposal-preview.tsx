"use client";

import { currencyCompact, dateShort } from "@/lib/format";
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

  const p2Base = Number(proposal.p2_total ?? 0) || 0;
  const p2Discount = Number(proposal.p2_discount ?? 0) || 0;
  const p2HasDiscount = p2Base > 0 && p2Discount > 0;
  const p2Net = p2HasDiscount
    ? Math.max(0, p2Base - p2Base * (p2Discount / 100))
    : p2Base;

  const formatCompare = (v: string | null, suffix = "") => {
    if (!v) return "";
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
    if (isNaN(n) || n <= 0) return v;
    return `${currencyCompact(n)}${suffix}`;
  };

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

        {(proposal.phase1_title || proposal.phase1_price) && (
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
              {proposal.phase1_title ?? "—"}
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
              <span
                className="mono"
                style={{ fontSize: "var(--text-md)" }}
              >
                {proposal.phase1_price ?? "—"}
              </span>
              {proposal.phase1_compare && (
                <span
                  className="mono"
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--muted)",
                    textDecoration: "line-through",
                  }}
                >
                  {formatCompare(proposal.phase1_compare)}
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

        {(proposal.phase2_title || proposal.phase2_monthly) && (
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
              {proposal.phase2_title ?? "—"}
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
              <span
                className="mono"
                style={{
                  fontSize: "var(--text-md)",
                  color: "var(--accent)",
                }}
              >
                {p2HasDiscount
                  ? `${currencyCompact(p2Net)} / mo`
                  : proposal.phase2_monthly ?? "—"}
              </span>
              {p2HasDiscount && (
                <>
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--white-a50)",
                      textDecoration: "line-through",
                    }}
                  >
                    {currencyCompact(p2Base)}
                  </span>
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
                </>
              )}
              {proposal.phase2_compare && (
                <span
                  className="mono"
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--white-a50)",
                    textDecoration: "line-through",
                  }}
                >
                  {formatCompare(proposal.phase2_compare, " / mo")}
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
            {proposal.phase2_commitment && (
              <div
                className="caption"
                style={{
                  marginTop: "var(--sp-1)",
                  color: "var(--white-a70)",
                }}
              >
                Commitment: {proposal.phase2_commitment}
              </div>
            )}
          </div>
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
