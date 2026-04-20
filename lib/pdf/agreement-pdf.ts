import { jsPDF } from "jspdf";
import { LOGO_BLACK_B64 } from "./logos";
import { dateShort } from "@/lib/format";
import { renderTerms, DEFAULT_LEGAL_TERMS } from "@/lib/defaults/legal-terms";
import type { Agreement } from "@/lib/types";

type Settings = {
  brand_name?: string;
  legal_name?: string;
  agreement_legal_entity?: string;
  agreement_governing_law?: string;
};

type RGB = [number, number, number];

export function generateAgreementPDF(
  agreement: Agreement,
  settings: Settings = {},
): void {
  const legalEntity = settings.agreement_legal_entity || "Attomik, LLC";
  const governingLaw =
    settings.agreement_governing_law || "State of Delaware, United States";
  const clientName =
    agreement.client_company || agreement.client_name || "Client";

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612;
  const H = 792;
  const margin = 48;
  const contentW = W - margin * 2;

  const INK: RGB = [0, 0, 0];
  const ACCENT: RGB = [0, 150, 85];
  const MUTED: RGB = [110, 110, 110];
  const BORDER: RGB = [220, 220, 220];

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setStroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  const bottomLimit = H - 54;

  function ensureSpace(
    lineHeight: number,
    y: number,
  ): { y: number; didBreak: boolean } {
    if (y + lineHeight > bottomLimit) {
      doc.addPage();
      return { y: 56, didBreak: true };
    }
    return { y, didBreak: false };
  }

  // ── HEADER (top of page 1) ───────────────────────────────────────
  let y = 48;
  try {
    doc.addImage(LOGO_BLACK_B64, "PNG", margin, y, 70, 70 * (909 / 3162));
  } catch {
    /* ignore */
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(MUTED);
  doc.text("SERVICES AGREEMENT", W - margin, y + 6, {
    align: "right",
    charSpace: 1.4,
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setColor(INK);
  doc.text(agreement.number, W - margin, y + 22, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor(MUTED);
  doc.text(`Effective ${dateShort(agreement.date)}`, W - margin, y + 36, {
    align: "right",
  });

  y += 56;
  setStroke(BORDER);
  doc.setLineWidth(0.6);
  doc.line(margin, y, W - margin, y);
  y += 14;

  // Parties
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text("BETWEEN", margin, y, { charSpace: 1 });
  doc.text("AND", margin + contentW / 2, y, { charSpace: 1 });
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(INK);
  doc.text(legalEntity, margin, y);
  doc.text(clientName, margin + contentW / 2, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor(MUTED);
  doc.text(
    `${governingLaw}`,
    margin,
    y,
    { maxWidth: contentW / 2 - 10 },
  );
  if (agreement.client_email) {
    doc.text(agreement.client_email, margin + contentW / 2, y);
  }
  y += 16;

  // ── PROPOSAL REFERENCE ──────────────────────────────────────────
  const proposalNumber = (agreement.proposal_number ?? "").trim();
  const proposalDate = agreement.proposal_date
    ? dateShort(agreement.proposal_date)
    : "";
  const refText = proposalNumber
    ? `This Agreement attaches to and incorporates by reference Proposal ${proposalNumber}${
        proposalDate ? ` dated ${proposalDate}` : ""
      }, which sets out the scope, deliverables, and commercial terms agreed between the parties. In the event of any conflict between this Agreement and the referenced Proposal, the terms of this Agreement govern.`
    : "This Agreement attaches to and incorporates by reference the services proposal shared with the Client, which sets out the scope, deliverables, and commercial terms agreed between the parties. In the event of any conflict between this Agreement and the referenced Proposal, the terms of this Agreement govern.";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text("REFERENCED PROPOSAL", margin, y, { charSpace: 1 });
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor([70, 70, 70]);
  const refLines = doc.splitTextToSize(refText, contentW) as string[];
  refLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 11;
  });
  y += 8;

  // ── TERMS & CONDITIONS ──────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setColor(ACCENT);
  doc.text("TERMS & CONDITIONS", margin, y, { charSpace: 1.2 });
  y += 14;

  const termsTemplate = agreement.terms || DEFAULT_LEGAL_TERMS;
  const renderedTerms = renderTerms(termsTemplate, {
    client_company: agreement.client_company,
    phase2_commitment: agreement.phase2_commitment,
    governing_law: governingLaw,
    legal_entity: legalEntity,
  });

  const paragraphs = renderedTerms.split(/\n\s*\n/);
  const paraLH = 10.5;
  for (const para of paragraphs) {
    const isHeading = /^\d+\.\s+[A-Z]/.test(para);
    if (isHeading) {
      const checked = ensureSpace(14, y);
      y = checked.y;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setColor(INK);
      doc.text(para, margin, y, { maxWidth: contentW, charSpace: 0.3 });
      y += 12;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setColor([70, 70, 70]);
      const wrapped = doc.splitTextToSize(para, contentW) as string[];
      for (const line of wrapped) {
        const checked = ensureSpace(paraLH, y);
        y = checked.y;
        doc.text(line, margin, y);
        y += paraLH;
      }
      y += 4;
    }
  }

  // ── SIGNATURE BLOCK ─────────────────────────────────────────────
  y += 8;
  // Ensure signatures aren't orphaned from the preceding paragraph — if < 80pt left, push to next page
  if (y + 84 > bottomLimit) {
    doc.addPage();
    y = 56;
  }
  setStroke(BORDER);
  doc.setLineWidth(0.4);
  doc.line(margin, y, W - margin, y);
  y += 14;

  const sigColW = contentW / 2 - 10;
  // Attomik
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(MUTED);
  doc.text(`FOR ${legalEntity.toUpperCase()}`, margin, y, { charSpace: 1 });
  setStroke(INK);
  doc.setLineWidth(0.6);
  doc.line(margin, y + 28, margin + sigColW, y + 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor(INK);
  doc.text("Pablo Rivera, Founder", margin, y + 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text(`Date: ${dateShort(agreement.date)}`, margin, y + 52);

  // Client
  const rightX = margin + contentW / 2 + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(MUTED);
  doc.text(`FOR ${clientName.toUpperCase()}`, rightX, y, { charSpace: 1 });
  setStroke(INK);
  doc.setLineWidth(0.6);
  doc.line(rightX, y + 28, rightX + sigColW, y + 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor(INK);
  const signer = agreement.signed_by_name
    ? `${agreement.signed_by_name}${
        agreement.signed_by_title ? `, ${agreement.signed_by_title}` : ""
      }`
    : "Name & title";
  doc.text(signer, rightX, y + 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text(
    `Date: ${
      agreement.signed_date ? dateShort(agreement.signed_date) : "________________"
    }`,
    rightX,
    y + 52,
  );

  // Page chrome on all pages
  const totalPages = doc.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    setStroke(BORDER);
    doc.setLineWidth(0.4);
    doc.line(margin, H - 30, W - margin, H - 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setColor(MUTED);
    doc.text(
      `${legalEntity} · Services Agreement ${agreement.number}`,
      margin,
      H - 18,
    );
    doc.text(`Page ${pg} of ${totalPages}`, W - margin, H - 18, {
      align: "right",
    });
  }

  const now = new Date();
  const filename = `Attomik_Agreement_${clientName.replace(/\s+/g, "_")}_${now.getFullYear()}.pdf`;
  doc.save(filename);
}
