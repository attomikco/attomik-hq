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
  const margin = 64;
  const contentW = W - margin * 2;
  const pageTop = 56;

  const INK: RGB = [0, 0, 0];
  const ACCENT: RGB = [0, 150, 85];
  const MUTED: RGB = [110, 110, 110];
  const BORDER: RGB = [229, 229, 229];

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setStroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  const bottomLimit = H - 68;

  function ensureSpace(
    lineHeight: number,
    y: number,
  ): { y: number; didBreak: boolean } {
    if (y + lineHeight > bottomLimit) {
      doc.addPage();
      return { y: pageTop, didBreak: true };
    }
    return { y, didBreak: false };
  }

  // ── HEADER (top of page 1) ───────────────────────────────────────
  let y = 56;
  try {
    doc.addImage(LOGO_BLACK_B64, "PNG", margin, y, 70, 70 * (909 / 3162));
  } catch {
    /* ignore */
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(MUTED);
  // jsPDF's right-alignment doesn't account for charSpace, which leaves the
  // tracked label visually floating off the margin. Measure manually.
  const labelText = "SERVICES AGREEMENT";
  const labelCS = 1.4;
  const labelW =
    doc.getTextWidth(labelText) + (labelText.length - 1) * labelCS;
  doc.text(labelText, W - margin - labelW, y + 6, { charSpace: labelCS });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor(MUTED);
  doc.text(`Effective ${dateShort(agreement.date)}`, W - margin, y + 22, {
    align: "right",
  });

  y += 72;
  setStroke(BORDER);
  doc.setLineWidth(0.6);
  doc.line(margin, y, W - margin, y);
  y += 20;

  // Parties
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text("BETWEEN", margin, y, { charSpace: 1 });
  doc.text("AND", margin + contentW / 2, y, { charSpace: 1 });
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(INK);
  doc.text(legalEntity, margin, y);
  doc.text(clientName, margin + contentW / 2, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor(MUTED);
  const attomikAddress =
    "1111B S Governors Ave STE 7239, Dover, DE 19904, United States";
  const clientAddress =
    (agreement.client_address ?? "").trim() || "Address on file";
  const addrMaxW = contentW / 2 - 10;
  const addrLH = 11;
  const attomikLines = (doc.splitTextToSize(attomikAddress, addrMaxW) as string[]).slice(
    0,
    2,
  );
  const clientLines = (doc.splitTextToSize(clientAddress, addrMaxW) as string[]).slice(
    0,
    2,
  );
  attomikLines.forEach((line, i) => doc.text(line, margin, y + i * addrLH));
  clientLines.forEach((line, i) =>
    doc.text(line, margin + contentW / 2, y + i * addrLH),
  );
  const addrRows = Math.max(attomikLines.length, clientLines.length, 1);
  y += (addrRows - 1) * addrLH + 20;
  setStroke(BORDER);
  doc.setLineWidth(0.4);
  doc.line(margin, y, W - margin, y);
  y += 22;

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
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor([70, 70, 70]);
  const refLines = doc.splitTextToSize(refText, contentW) as string[];
  const refLH = 13.5;
  refLines.forEach((line) => {
    doc.text(line, margin, y);
    y += refLH;
  });
  y += 20;

  // ── TERMS & CONDITIONS ──────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setColor(ACCENT);
  doc.text("TERMS & CONDITIONS", margin, y, { charSpace: 1.2 });
  y += 6;
  setStroke(BORDER);
  doc.setLineWidth(0.4);
  doc.line(margin, y, W - margin, y);
  y += 18;

  const termsTemplate = agreement.terms || DEFAULT_LEGAL_TERMS;
  const renderedTerms = renderTerms(termsTemplate, {
    client_company: agreement.client_company,
    phase2_commitment: agreement.phase2_commitment,
    governing_law: governingLaw,
    legal_entity: legalEntity,
  });

  const paragraphs = renderedTerms.split(/\n\s*\n/);
  const paraLH = 11.5; // ~1.44 line-height on 8pt body (tightened to fit 2pp)
  const headingSpaceAbove = 22;
  const headingSpaceBelow = 7;
  const paraGap = 7;
  let firstHeading = true;
  for (const para of paragraphs) {
    const isHeading = /^\d+\.\s+[A-Z]/.test(para);
    if (isHeading) {
      if (!firstHeading) y += headingSpaceAbove;
      firstHeading = false;
      // Keep the heading with its own underline and first line of body.
      const keepWith = 14 + 6 + paraLH;
      const checked = ensureSpace(keepWith, y);
      y = checked.y;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      setColor(INK);
      doc.text(para, margin, y, { maxWidth: contentW, charSpace: 0.4 });
      y += 6;
      setStroke(BORDER);
      doc.setLineWidth(0.3);
      doc.line(margin, y, W - margin, y);
      y += headingSpaceBelow;
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
      y += paraGap;
    }
  }

  // ── SIGNATURE BLOCK ─────────────────────────────────────────────
  y += 24;
  // Stack both signer blocks on one page. Height ≈ 2 × 80 + 32 gap = ~192pt.
  if (y + 200 > bottomLimit) {
    doc.addPage();
    y = pageTop;
  }
  setStroke(BORDER);
  doc.setLineWidth(0.4);
  doc.line(margin, y, W - margin, y);
  y += 26;

  const sigLineW = contentW * 0.7;
  const clientSigner = agreement.signed_by_name
    ? `${agreement.signed_by_name}${
        agreement.signed_by_title ? `, ${agreement.signed_by_title}` : ""
      }`
    : "Name & title";
  const clientDate = agreement.signed_date
    ? dateShort(agreement.signed_date)
    : "________________";

  const drawSignerBlock = (
    label: string,
    name: string,
    dateText: string,
    startY: number,
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setColor(MUTED);
    doc.text(label, margin, startY, { charSpace: 1 });

    setStroke(INK);
    doc.setLineWidth(0.6);
    doc.line(margin, startY + 36, margin + sigLineW, startY + 36);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(INK);
    doc.text(name, margin, startY + 52);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(MUTED);
    doc.text(`Date: ${dateText}`, margin, startY + 72);
  };

  drawSignerBlock(
    `FOR ${legalEntity.toUpperCase()}`,
    "Pablo Rivera, Founder",
    dateShort(agreement.date),
    y,
  );
  y += 112;

  drawSignerBlock(
    `FOR ${clientName.toUpperCase()}`,
    clientSigner,
    clientDate,
    y,
  );

  // Page chrome on all pages
  const totalPages = doc.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    setStroke(BORDER);
    doc.setLineWidth(0.4);
    doc.line(margin, H - 42, W - margin, H - 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setColor(MUTED);
    doc.text(
      `${legalEntity} · Services Agreement ${agreement.number}`,
      margin,
      H - 26,
    );
    doc.text(`Page ${pg} of ${totalPages}`, W - margin, H - 26, {
      align: "right",
    });
  }

  const now = new Date();
  const filename = `Attomik_Agreement_${clientName.replace(/\s+/g, "_")}_${now.getFullYear()}.pdf`;
  doc.save(filename);
}
