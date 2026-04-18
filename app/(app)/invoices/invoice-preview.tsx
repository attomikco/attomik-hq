"use client";

import { useMemo } from "react";
import { currency, dateShort, lineSubtotal } from "@/lib/format";
import { Modal } from "@/components/modal";
import PDFDownloadButton from "@/components/pdf-download-button";
import type { Invoice, SettingsMap } from "@/lib/types";

export default function InvoicePreview({
  open,
  invoice,
  settings,
  onClose,
}: {
  open: boolean;
  invoice: Invoice | null;
  settings: SettingsMap;
  onClose: () => void;
}) {
  const subtotal = useMemo(
    () => lineSubtotal(invoice?.items),
    [invoice?.items],
  );
  const discountPct = Number(invoice?.discount ?? 0);
  const discountAmt = subtotal * (discountPct / 100);
  const total = Math.max(0, subtotal - discountAmt);
  const code = settings.currency ?? "USD";

  function handleGmail() {
    if (!invoice) return;
    const to = invoice.client_email ?? "";
    const subject = encodeURIComponent(
      `Invoice ${invoice.number ?? ""} · ${settings.brand_name ?? "Attomik"}`,
    );
    const body = encodeURIComponent(
      [
        `Hi${invoice.client_name ? ` ${invoice.client_name}` : ""},`,
        ``,
        `Please find attached invoice ${invoice.number ?? ""} for ${currency(total, code)}.`,
        `Due: ${dateShort(invoice.due)}`,
        ``,
        settings.payment_instructions ?? "",
        ``,
        `Thanks,`,
        settings.brand_name ?? "",
      ].join("\n"),
    );
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }

  if (!invoice) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Preview · ${invoice.number ?? "Invoice"}`}
      maxWidth={720}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} type="button">
            Close
          </button>
          <PDFDownloadButton
            type="invoice"
            data={invoice}
            settings={settings as Record<string, string | undefined>}
            label="Download PDF"
          />
          <button
            className="btn btn-primary"
            onClick={handleGmail}
            type="button"
            disabled={!invoice.client_email}
          >
            Send via email
          </button>
        </>
      }
    >
      <div
        className="card-muted"
        style={{
          padding: "var(--sp-7)",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "var(--sp-7)",
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
            {settings.address && (
              <div
                className="caption"
                style={{ whiteSpace: "pre-line", marginTop: "var(--sp-1)" }}
              >
                {settings.address}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="label mono">Invoice</div>
            <div
              className="mono"
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: "var(--fw-bold)",
              }}
            >
              {invoice.number ?? "—"}
            </div>
            <div
              className="caption mono"
              style={{ marginTop: "var(--sp-2)" }}
            >
              Issued {dateShort(invoice.date)}
            </div>
            <div className="caption mono">
              Due {dateShort(invoice.due)}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "var(--sp-6)",
            padding: "var(--sp-5) 0",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
            marginBottom: "var(--sp-5)",
          }}
        >
          <div>
            <div className="label mono">Bill to</div>
            <div
              style={{
                fontWeight: "var(--fw-semibold)",
                marginTop: "var(--sp-1)",
              }}
            >
              {invoice.client_name ?? "—"}
            </div>
            {invoice.client_company && (
              <div className="caption">{invoice.client_company}</div>
            )}
            {invoice.client_email && (
              <div className="caption mono">{invoice.client_email}</div>
            )}
            {invoice.client_address && (
              <div className="caption" style={{ whiteSpace: "pre-line" }}>
                {invoice.client_address}
              </div>
            )}
          </div>
          <div>
            <div className="label mono">Status</div>
            <span
              className={`badge status-${invoice.status ?? "draft"}`}
              style={{ marginTop: "var(--sp-1)" }}
            >
              {invoice.status ?? "draft"}
            </span>
          </div>
        </div>

        <table style={{ marginBottom: "var(--sp-5)" }}>
          <thead>
            <tr>
              <th>Item</th>
              <th className="td-right">Qty</th>
              <th className="td-right">Rate</th>
              <th className="td-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items ?? []).map((it, i) => {
              const qty = Number(it.qty ?? it.quantity ?? 1);
              const rate = Number(it.rate ?? it.price ?? 0);
              const title = (it.title ?? "").trim();
              const desc = (it.description ?? it.desc ?? "").trim();
              const showDesc = desc && desc !== title;
              return (
                <tr key={i}>
                  <td>
                    <div
                      className="td-strong"
                      style={{ fontWeight: "var(--fw-bold)" }}
                    >
                      {title || "—"}
                    </div>
                    {showDesc && (
                      <div
                        style={{
                          fontSize: "var(--text-sm)",
                          color: "var(--muted)",
                          marginTop: "var(--sp-1)",
                          lineHeight: 1.5,
                          whiteSpace: "pre-line",
                        }}
                      >
                        {desc}
                      </div>
                    )}
                  </td>
                  <td className="td-right td-mono">{qty}</td>
                  <td className="td-right td-mono">{currency(rate, code)}</td>
                  <td className="td-right td-mono">
                    {currency(qty * rate, code)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div style={{ minWidth: 240 }}>
            <Row label="Subtotal" value={currency(subtotal, code)} />
            {discountPct > 0 && (
              <Row
                label={`Discount (${discountPct}%)`}
                value={`− ${currency(discountAmt, code)}`}
              />
            )}
            <Row label="Total" value={currency(total, code)} emphasis />
          </div>
        </div>

        {invoice.notes && (
          <div
            style={{
              marginTop: "var(--sp-6)",
              paddingTop: "var(--sp-5)",
              borderTop: "1px solid var(--border)",
            }}
          >
            <div className="label mono">Notes</div>
            <p
              className="caption"
              style={{ whiteSpace: "pre-line", marginTop: "var(--sp-2)" }}
            >
              {invoice.notes}
            </p>
          </div>
        )}

        {settings.payment_instructions && (
          <div
            style={{
              marginTop: "var(--sp-5)",
              paddingTop: "var(--sp-5)",
              borderTop: "1px solid var(--border)",
            }}
          >
            <div className="label mono">Payment</div>
            <p
              className="caption"
              style={{ whiteSpace: "pre-line", marginTop: "var(--sp-2)" }}
            >
              {settings.payment_instructions}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "var(--sp-2) 0",
        fontSize: emphasis ? "var(--text-md)" : "var(--text-base)",
        fontWeight: emphasis ? "var(--fw-bold)" : "var(--fw-normal)",
        borderTop: emphasis ? "1px solid var(--border)" : "none",
        marginTop: emphasis ? "var(--sp-2)" : 0,
      }}
    >
      <span className={emphasis ? undefined : "text-muted"}>{label}</span>
      <span className="mono">{value}</span>
    </div>
  );
}
