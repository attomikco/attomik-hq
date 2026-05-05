"use client";

import { useState } from "react";

type Settings = Record<string, string | undefined>;

type ServiceRef = {
  id?: string;
  name?: string | null;
  description?: string | null;
  desc?: string | null;
};

type InvoiceProps = {
  type: "invoice";
  data: Parameters<
    typeof import("@/lib/pdf/invoice-pdf").generateInvoicePDF
  >[0];
  settings: Settings;
  services?: ServiceRef[];
  label?: string;
  className?: string;
};

type ProposalProps = {
  type: "proposal";
  data: Parameters<
    typeof import("@/lib/pdf/proposal-pdf").generateProposalPDF
  >[0];
  settings: Settings;
  label?: string;
  className?: string;
};

type AgreementProps = {
  type: "agreement";
  data: Parameters<
    typeof import("@/lib/pdf/agreement-pdf").generateAgreementPDF
  >[0];
  settings: Settings;
  label?: string;
  className?: string;
};

export default function PDFDownloadButton(
  props: InvoiceProps | ProposalProps | AgreementProps,
) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      if (props.type === "invoice") {
        const { generateInvoicePDF } = await import("@/lib/pdf/invoice-pdf");
        generateInvoicePDF(props.data, props.settings, props.services ?? []);
      } else if (props.type === "proposal") {
        const { generateProposalPDF } = await import("@/lib/pdf/proposal-pdf");
        generateProposalPDF(props.data, props.settings);
      } else {
        const { generateAgreementPDF } = await import(
          "@/lib/pdf/agreement-pdf"
        );
        generateAgreementPDF(props.data, props.settings);
      }
    } catch (e) {
      console.error("PDF generation failed:", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={props.className ?? "btn btn-secondary"}
      onClick={handleClick}
      disabled={busy}
    >
      {busy ? "Generating…" : (props.label ?? "Download PDF")}
    </button>
  );
}
