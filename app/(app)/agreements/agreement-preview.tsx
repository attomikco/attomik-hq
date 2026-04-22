"use client";

import { Modal } from "@/components/modal";
import PDFDownloadButton from "@/components/pdf-download-button";
import { currency, dateShort } from "@/lib/format";
import { renderTerms, DEFAULT_LEGAL_TERMS } from "@/lib/defaults/legal-terms";
import { KICKOFF_CATEGORIES } from "@/lib/defaults/kickoff-checklist";
import type { Agreement, KickoffItem, SettingsMap } from "@/lib/types";

export default function AgreementPreview({
  open,
  agreement,
  settings,
  onClose,
  onMarkSigned,
  onSend,
}: {
  open: boolean;
  agreement: Agreement | null;
  settings: SettingsMap;
  onClose: () => void;
  onMarkSigned: (a: Agreement) => void;
  onSend: (a: Agreement) => void;
}) {
  if (!agreement) return null;

  const code = settings.currency ?? "USD";
  const rendered = renderTerms(agreement.terms || DEFAULT_LEGAL_TERMS, {
    client_company: agreement.client_company,
    phase2_commitment: agreement.phase2_commitment,
    governing_law: settings.agreement_governing_law,
    legal_entity: settings.agreement_legal_entity,
  });

  const grouped = new Map<string, KickoffItem[]>();
  for (const cat of KICKOFF_CATEGORIES) grouped.set(cat, []);
  for (const it of agreement.kickoff_items ?? []) {
    if (!grouped.has(it.category)) grouped.set(it.category, []);
    grouped.get(it.category)!.push(it);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Preview · ${agreement.number}`}
      maxWidth={780}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} type="button">
            Close
          </button>
          <PDFDownloadButton
            type="agreement"
            data={agreement}
            settings={settings as Record<string, string | undefined>}
            label="Download PDF"
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onSend(agreement)}
            disabled={!agreement.client_email}
          >
            Send via email
          </button>
          {agreement.status !== "signed" &&
            agreement.status !== "active" &&
            agreement.status !== "completed" && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onMarkSigned(agreement)}
              >
                Mark signed
              </button>
            )}
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
              {settings.agreement_legal_entity ?? "Attomik, LLC"}
            </div>
            <div className="caption">Services Agreement</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="label mono">Agreement</div>
            <div
              className="mono"
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: "var(--fw-bold)",
              }}
            >
              {agreement.number}
            </div>
            <div className="caption mono" style={{ marginTop: "var(--sp-2)" }}>
              Effective {dateShort(agreement.date)}
            </div>
            <div style={{ marginTop: "var(--sp-2)" }}>
              <span className={`badge status-${agreement.status}`}>
                {agreement.status}
              </span>
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
            <div className="label mono">Client</div>
            <div
              style={{
                fontWeight: "var(--fw-semibold)",
                marginTop: "var(--sp-1)",
              }}
            >
              {agreement.client_company || agreement.client_name || "—"}
            </div>
            {agreement.client_name && agreement.client_company && (
              <div className="caption">{agreement.client_name}</div>
            )}
            {agreement.client_email && (
              <div className="caption mono">{agreement.client_email}</div>
            )}
            {agreement.client_address && (
              <div className="caption" style={{ whiteSpace: "pre-line" }}>
                {agreement.client_address}
              </div>
            )}
          </div>
        </div>

        <Section title="Phase 1 · Build">
          {(agreement.phase1_items ?? []).length === 0 ? (
            <div className="caption">No line items yet.</div>
          ) : (
            <table style={{ marginBottom: "var(--sp-3)" }}>
              <thead>
                <tr>
                  <th>Service</th>
                  <th className="td-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {(agreement.phase1_items ?? []).map((it, i) => (
                  <tr key={i}>
                    <td>{it.name}</td>
                    <td className="td-right td-mono">
                      {currency(Number(it.price) || 0, code)}
                    </td>
                  </tr>
                ))}
                {Number(agreement.phase1_discount) > 0 && (
                  <>
                    <tr>
                      <td className="td-muted">Subtotal</td>
                      <td className="td-right td-mono td-muted">
                        {currency(Number(agreement.phase1_total) || 0, code)}
                      </td>
                    </tr>
                    <tr>
                      <td className="td-muted">Discount</td>
                      <td className="td-right td-mono td-muted">
                        −{currency(Number(agreement.phase1_discount) || 0, code)}
                      </td>
                    </tr>
                  </>
                )}
                <tr>
                  <td className="td-strong">Total</td>
                  <td className="td-right td-mono td-strong">
                    {currency(
                      Math.max(
                        0,
                        (Number(agreement.phase1_total) || 0) -
                          (Number(agreement.phase1_discount) || 0),
                      ),
                      code,
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          <div className="caption">
            Timeline: {agreement.phase1_timeline || "—"}
          </div>
          <div className="caption">
            Payment: {agreement.phase1_payment || "—"}
          </div>
        </Section>

        <Section title="Phase 2 · Growth Partnership">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "var(--sp-3)",
            }}
          >
            <Cell
              label="SERVICE"
              value={agreement.phase2_service || "—"}
            />
            <Cell
              label="MONTHLY RATE"
              value={
                Number(agreement.phase2_discount) > 0
                  ? `${currency(
                      Math.max(
                        0,
                        (Number(agreement.phase2_rate) || 0) -
                          (Number(agreement.phase2_discount) || 0),
                      ),
                      code,
                    )} / mo (${currency(
                      Number(agreement.phase2_rate) || 0,
                      code,
                    )} − ${currency(
                      Number(agreement.phase2_discount) || 0,
                      code,
                    )})`
                  : `${currency(Number(agreement.phase2_rate) || 0, code)} / mo`
              }
            />
            <Cell
              label="INTRODUCTORY RATE"
              value={`First ${agreement.phase2_commitment ?? 3} months`}
            />
          </div>
          <div className="caption" style={{ marginTop: "var(--sp-2)" }}>
            Start date:{" "}
            {agreement.phase2_start_date
              ? dateShort(agreement.phase2_start_date)
              : "Upon Phase 1 launch"}
          </div>
        </Section>

        <Section title="Kickoff Requirements">
          {Array.from(grouped.entries())
            .filter(([, items]) => items.length > 0)
            .map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: "var(--sp-3)" }}>
                <div className="label mono">{cat}</div>
                <ul
                  className="caption"
                  style={{
                    marginTop: "var(--sp-1)",
                    paddingLeft: "var(--sp-5)",
                  }}
                >
                  {items.map((it, i) => (
                    <li key={i}>
                      {it.provided ? "✓ " : it.required ? "● " : "○ "}
                      {it.item}
                      {it.notes ? (
                        <span style={{ color: "var(--muted)" }}>
                          {" "}
                          — {it.notes}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </Section>

        <Section title="Terms & Conditions">
          <p
            className="caption"
            style={{ whiteSpace: "pre-line", fontSize: "var(--text-sm)" }}
          >
            {rendered}
          </p>
        </Section>

        {agreement.notes && (
          <Section title="Internal Notes">
            <p className="caption" style={{ whiteSpace: "pre-line" }}>
              {agreement.notes}
            </p>
          </Section>
        )}
      </div>
    </Modal>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: "var(--sp-5)" }}>
      <div className="label mono" style={{ marginBottom: "var(--sp-2)" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label mono">{label}</div>
      <div className="mono" style={{ fontWeight: "var(--fw-semibold)" }}>
        {value}
      </div>
    </div>
  );
}
