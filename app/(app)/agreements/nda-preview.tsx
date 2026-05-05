"use client";

import { Modal } from "@/components/modal";
import PDFDownloadButton from "@/components/pdf-download-button";
import { dateShort } from "@/lib/format";
import { renderNDATerms, DEFAULT_NDA_TERMS } from "@/lib/defaults/nda-terms";
import type { Agreement, SettingsMap } from "@/lib/types";

export default function NDAPreview({
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

  const rendered = renderNDATerms(agreement.terms || DEFAULT_NDA_TERMS, {
    client_legal_name: agreement.client_company || agreement.client_name,
    client_address: agreement.client_address,
    effective_date: dateShort(agreement.date),
    purpose: agreement.nda_purpose,
    term_years: agreement.nda_term_years,
    legal_entity: settings.agreement_legal_entity,
  });

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
            type="nda"
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
            <div className="caption">Mutual NDA</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="label mono">NDA</div>
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
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--sp-5)",
            padding: "var(--sp-4) 0",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
            marginBottom: "var(--sp-5)",
          }}
        >
          <div>
            <div className="label mono">Between</div>
            <div
              style={{
                fontWeight: "var(--fw-semibold)",
                marginTop: "var(--sp-1)",
              }}
            >
              {settings.agreement_legal_entity ?? "Attomik, LLC"}
            </div>
            <div className="caption">169 Madison Ave, STE 2733</div>
            <div className="caption">New York, NY 10016</div>
          </div>
          <div>
            <div className="label mono">And</div>
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

        <Section title="Purpose">
          <p
            className="caption"
            style={{ whiteSpace: "pre-line", fontSize: "var(--text-sm)" }}
          >
            {agreement.nda_purpose ||
              "—  Provide a purpose in the form to render this section."}
          </p>
        </Section>

        <Section title="Confidentiality Term">
          <p className="caption" style={{ fontSize: "var(--text-sm)" }}>
            {agreement.nda_term_years ?? 2} years from the date of disclosure
            of any Confidential Information.
          </p>
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
