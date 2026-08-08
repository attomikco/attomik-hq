"use client";

import { useMemo, useState } from "react";
import {
  currency,
  currencyLabeled,
  dateShort,
  formatServicePeriod,
  invoiceStatusLabel,
  lineSubtotal,
} from "@/lib/format";
import { amountInWords } from "@/lib/number-to-words";
import { Modal } from "@/components/modal";
import PDFDownloadButton from "@/components/pdf-download-button";
import {
  isMexicanClient,
  type Invoice,
  type InvoiceFiscalClient,
  type Service,
  type SettingsMap,
} from "@/lib/types";

export default function InvoicePreview({
  open,
  invoice,
  client,
  settings,
  services,
  onClose,
  onSent,
}: {
  open: boolean;
  invoice: Invoice | null;
  /** The linked client, joined in for the country-aware layout. */
  client?: InvoiceFiscalClient;
  settings: SettingsMap;
  services: Service[];
  onClose: () => void;
  onSent?: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const subtotal = useMemo(
    () => lineSubtotal(invoice?.items),
    [invoice?.items],
  );
  const discountPct = Number(invoice?.discount ?? 0);
  const discountAmt = subtotal * (discountPct / 100);
  const total = Math.max(0, subtotal - discountAmt);
  const code = settings.currency ?? "USD";
  // Mirrors the branch in lib/pdf/invoice-pdf.ts so the preview and the PDF
  // never disagree about what the client receives.
  const isMX = isMexicanClient(client ?? null);
  const money = (n: number) =>
    isMX ? currencyLabeled(n, code) : currency(n, code);

  async function handleSend() {
    if (!invoice || sending) return;
    setSending(true);
    setSendMsg(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to send invoice.");
      }
      setSendMsg({
        kind: "ok",
        text: `Sent to ${data.to ?? invoice.client_email}.`,
      });
      onSent?.();
    } catch (err) {
      setSendMsg({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to send invoice.",
      });
    } finally {
      setSending(false);
    }
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
          {sendMsg && (
            <span
              className="caption"
              style={{
                marginRight: "auto",
                color:
                  sendMsg.kind === "ok" ? "var(--success)" : "var(--danger)",
              }}
            >
              {sendMsg.text}
            </span>
          )}
          <button className="btn btn-ghost" onClick={onClose} type="button">
            Close
          </button>
          <PDFDownloadButton
            type="invoice"
            data={invoice}
            settings={settings as Record<string, string | undefined>}
            services={services}
            client={client ?? null}
            label="Download PDF"
          />
          <button
            className="btn btn-primary"
            onClick={handleSend}
            type="button"
            disabled={!invoice.client_email || sending}
            title={
              invoice.client_email
                ? `Email to ${invoice.client_email}`
                : "No client email on this invoice"
            }
          >
            {sending ? "Sending…" : "Send via email"}
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
            {isMX && settings.issuer_ein && (
              <div className="caption mono" style={{ marginTop: "var(--sp-1)" }}>
                EIN (US Tax ID): {settings.issuer_ein}
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
            {isMX && settings.place_of_issuance && (
              <div
                className="caption mono"
                style={{ marginTop: "var(--sp-2)" }}
              >
                Issued at {settings.place_of_issuance}
              </div>
            )}
            <div
              className="caption mono"
              style={{ marginTop: "var(--sp-2)" }}
            >
              Issued {dateShort(invoice.date)}
            </div>
            <div className="caption mono">
              Due {dateShort(invoice.due)}
            </div>
            {formatServicePeriod(
              invoice.service_start_date,
              invoice.service_end_date,
            ) && (
              <div className="caption mono" style={{ marginTop: "var(--sp-2)" }}>
                Service Period{" "}
                {formatServicePeriod(
                  invoice.service_start_date,
                  invoice.service_end_date,
                )}
              </div>
            )}
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
              {isMX
                ? (client?.legal_name || invoice.client_name || "—")
                : (invoice.client_name ?? "—")}
            </div>
            {isMX ? (
              <>
                {client?.rfc && (
                  <div className="caption mono">RFC: {client.rfc}</div>
                )}
                {(client?.fiscal_address || invoice.client_address) && (
                  <div className="caption" style={{ whiteSpace: "pre-line" }}>
                    {client?.fiscal_address || invoice.client_address}
                  </div>
                )}
                {client?.billing_contact && (
                  <div className="caption">{client.billing_contact}</div>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
          <div>
            <div className="label mono">Status</div>
            <span
              className={`badge status-${invoice.status ?? "draft"}`}
              style={{ marginTop: "var(--sp-1)" }}
            >
              {invoiceStatusLabel(invoice.status)}
            </span>
          </div>
        </div>

        <table style={{ marginBottom: "var(--sp-5)" }}>
          <thead>
            <tr>
              <th>Item</th>
              {isMX && <th className="td-right">Unit</th>}
              <th className="td-right">Qty</th>
              <th className="td-right">Rate</th>
              <th className="td-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items ?? []).map((it, i) => {
              const qty = Number(it.qty ?? it.quantity ?? 1);
              const rate = Number(it.rate ?? it.price ?? 0);
              const title = (it.title ?? it.name ?? "").trim();
              const matchedSvc =
                (it.service_id &&
                  services.find((s) => s.id === it.service_id)) ||
                services.find(
                  (s) => (s.name ?? "").toLowerCase() === title.toLowerCase(),
                ) ||
                null;
              const desc = (
                it.description ??
                it.desc ??
                matchedSvc?.description ??
                matchedSvc?.desc ??
                ""
              ).trim();
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
                  {isMX && <td className="td-right td-mono">Service</td>}
                  <td className="td-right td-mono">{qty}</td>
                  <td className="td-right td-mono">{money(rate)}</td>
                  <td className="td-right td-mono">{money(qty * rate)}</td>
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
            <Row label="Subtotal" value={money(subtotal)} />
            {discountPct > 0 && (
              <Row
                label={`Discount (${discountPct}%)`}
                value={`− ${money(discountAmt)}`}
              />
            )}
            <Row label="Total" value={money(total)} emphasis />
            {isMX && (
              <div
                className="caption"
                style={{
                  marginTop: "var(--sp-2)",
                  textAlign: "right",
                  lineHeight: 1.5,
                }}
              >
                {amountInWords(total, code)}
              </div>
            )}
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
