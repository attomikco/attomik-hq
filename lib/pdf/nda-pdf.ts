import { jsPDF } from "jspdf";
import { LOGO_BLACK_B64, LOGO_WHITE_B64 } from "./logos";
import { dateShort } from "@/lib/format";
import { renderNDATerms, DEFAULT_NDA_TERMS } from "@/lib/defaults/nda-terms";
import type { Agreement } from "@/lib/types";

type Settings = {
  brand_name?: string;
  legal_name?: string;
  agreement_legal_entity?: string;
};

type RGB = [number, number, number];

export function generateNDAPDF(
  agreement: Agreement,
  settings: Settings = {},
): void {
  const legalEntity = settings.agreement_legal_entity || "Attomik, LLC";
  const clientName =
    agreement.client_company || agreement.client_name || "Counterparty";

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612;
  const H = 792;
  const margin = 54;
  const contentW = W - margin * 2;
  const pageTop = 72;

  const INK: RGB = [0, 0, 0];
  const PAPER: RGB = [255, 255, 255];
  const ACCENT: RGB = [0, 255, 151];
  const MUTED: RGB = [110, 110, 110];
  const BORDER: RGB = [229, 229, 229];
  const GREY_LINE: RGB = [40, 40, 40];

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setStroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  const bottomLimit = H - 68;

  // ── PAGE 1: COVER ────────────────────────────────────────────────
  setFill(INK);
  doc.rect(0, 0, W, H, "F");
  doc.setLineWidth(0.3);
  setStroke(GREY_LINE);
  for (let gx = 0; gx < W; gx += 60) doc.line(gx, 50, gx, H);
  for (let gy = 50; gy < H; gy += 60) doc.line(0, gy, W, gy);
  setFill(ACCENT);
  doc.rect(0, 0, W, 5, "F");
  setFill([17, 17, 17]);
  doc.rect(0, H - 50, W, 50, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor([100, 100, 100]);
  const issuedStr = agreement.date ? dateShort(agreement.date) : "";
  doc.text("CONFIDENTIAL", margin, H - 20);
  doc.text(
    `Effective: ${issuedStr}`,
    W - margin,
    H - 20,
    { align: "right" },
  );

  try {
    doc.addImage(
      LOGO_WHITE_B64,
      "PNG",
      margin,
      H * 0.32,
      140,
      140 * (909 / 3162),
    );
  } catch {
    /* ignore */
  }

  const titleY = H * 0.44;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  setColor(PAPER);
  doc.text("Mutual", margin, titleY);
  setColor(ACCENT);
  doc.text("NDA.", margin, titleY + 50);

  // NDA number — DM Mono is not loaded into jsPDF; the closest equivalent
  // in the built-in font set is courier, used consistently in invoice/agreement
  // PDFs for ID strings.
  doc.setFont("courier", "bold");
  doc.setFontSize(11);
  setColor(MUTED);
  doc.text(`#${agreement.number}`, margin, titleY + 78, { charSpace: 1 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(MUTED);
  doc.text("BETWEEN", margin, titleY + 110, { charSpace: 1.2 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setColor(PAPER);
  doc.text(legalEntity, margin, titleY + 128);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(MUTED);
  doc.text("AND", margin, titleY + 156, { charSpace: 1.2 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setColor(PAPER);
  doc.text(clientName, margin, titleY + 174);

  // ── PAGE 2: TERMS ────────────────────────────────────────────────
  doc.addPage();
  let y = pageTop;

  // Header
  const logoW = 60;
  const logoH = logoW * (909 / 3162);
  try {
    doc.addImage(LOGO_BLACK_B64, "PNG", margin, y - 18, logoW, logoH);
  } catch {
    /* ignore */
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(MUTED);
  const labelText = "MUTUAL NON-DISCLOSURE AGREEMENT";
  doc.text(labelText, W - margin, y - 8, { align: "right", charSpace: 1.2 });
  doc.setFont("courier", "bold");
  doc.setFontSize(9);
  setColor(INK);
  doc.text(`#${agreement.number}`, W - margin, y + 6, {
    align: "right",
  });
  y += 30;

  // Two-column parties block
  const gutter = 18;
  const colW = (contentW - gutter) / 2;
  const col1X = margin;
  const col2X = margin + colW + gutter;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(MUTED);
  doc.text("BETWEEN", col1X, y, { charSpace: 1 });
  doc.text("AND", col2X, y, { charSpace: 1 });
  y += 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  setColor(INK);
  doc.text(legalEntity, col1X, y);
  doc.text(clientName, col2X, y);
  y += 11;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setColor(MUTED);
  const attomikLines = ["169 Madison Ave, STE 2733", "New York, NY 10016"];
  const rawClientAddress = (agreement.client_address ?? "").trim();
  const addrLH = 9;
  const clientLines: string[] = rawClientAddress
    ? rawClientAddress
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .flatMap((line) => doc.splitTextToSize(line, colW) as string[])
    : ["Address on file"];
  attomikLines.forEach((line, i) => doc.text(line, col1X, y + i * addrLH));
  clientLines.forEach((line, i) => doc.text(line, col2X, y + i * addrLH));
  const addrRows = Math.max(attomikLines.length, clientLines.length, 1);
  y += addrRows * addrLH + 14;

  // Terms render
  const termsTemplate = agreement.terms || DEFAULT_NDA_TERMS;
  const renderedTerms = renderNDATerms(termsTemplate, {
    client_legal_name: clientName,
    client_address: agreement.client_address,
    effective_date: dateShort(agreement.date),
    purpose: agreement.nda_purpose,
    term_years: agreement.nda_term_years,
    legal_entity: legalEntity,
  });

  // Strip the first ALL-CAPS title line ("MUTUAL NON-DISCLOSURE AGREEMENT")
  // since we already render it in the page header — keeps the body tighter.
  const bodyText = renderedTerms.replace(
    /^MUTUAL NON-DISCLOSURE AGREEMENT\s*\n+/i,
    "",
  );
  const paragraphs = bodyText.split(/\n\s*\n/);

  // Tight spacing to fit 12 clauses + parties paragraph + signature block
  // on a single page where possible. Sized to match the visual density of
  // the services agreement clause body.
  const bodySize = 7.5;
  const paraLH = 9.5;
  const headingSize = 8;
  const headingSpaceAbove = 8;
  const headingSpaceBelow = 4;
  const paraGap = 3;

  function ensureSpace(lineH: number): boolean {
    if (y + lineH > bottomLimit) {
      doc.addPage();
      y = pageTop;
      return true;
    }
    return false;
  }

  function renderBodyPara(para: string): void {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodySize);
    setColor([70, 70, 70]);
    const wrapped = doc.splitTextToSize(para, contentW) as string[];
    for (const line of wrapped) {
      ensureSpace(paraLH);
      doc.text(line, margin, y);
      y += paraLH;
    }
    y += paraGap;
  }

  function measureBodyParaHeight(para: string): number {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodySize);
    const wrapped = doc.splitTextToSize(para, contentW) as string[];
    return wrapped.length * paraLH + paraGap;
  }

  let firstHeading = true;
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();
    if (!para) continue;
    const isHeading = /^\d+\.\s+[A-Z]/.test(para);

    if (isHeading) {
      const advance = firstHeading ? 0 : headingSpaceAbove;
      const headingBlock = headingSize + headingSpaceBelow;
      const nextBody = paragraphs[i + 1];
      const nextHeight = nextBody ? measureBodyParaHeight(nextBody) : 0;
      if (y + advance + headingBlock + nextHeight > bottomLimit) {
        doc.addPage();
        y = pageTop;
      } else {
        y += advance;
      }
      firstHeading = false;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(headingSize);
      setColor(INK);
      doc.text(para, margin, y, { maxWidth: contentW, charSpace: 0.4 });
      y += headingSize + headingSpaceBelow;
    } else {
      const paraHeight = measureBodyParaHeight(para);
      if (y + paraHeight > bottomLimit) {
        doc.addPage();
        y = pageTop;
      }
      renderBodyPara(para);
    }
  }

  // ── SIGNATURE BLOCK ─────────────────────────────────────────────
  // Reserve room. If it doesn't fit, push to the next page so it stays
  // visually intact.
  const sigBlockH = 200;
  if (y + sigBlockH > bottomLimit) {
    doc.addPage();
    y = pageTop;
  } else {
    y += 14;
  }

  setStroke(BORDER);
  doc.setLineWidth(0.4);
  doc.line(margin, y, W - margin, y);
  y += 22;

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
    doc.line(margin, startY + 30, margin + sigLineW, startY + 30);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(INK);
    doc.text(name, margin, startY + 44);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(MUTED);
    doc.text(`Date: ${dateText}`, margin, startY + 60);
  };

  drawSignerBlock(
    `FOR ${legalEntity.toUpperCase()}`,
    "Pablo Rivera, Founder",
    dateShort(agreement.date),
    y,
  );
  y += 92;

  drawSignerBlock(
    `FOR ${clientName.toUpperCase()}`,
    clientSigner,
    clientDate,
    y,
  );

  // Page chrome on every page except the cover.
  const totalPages = doc.getNumberOfPages();
  for (let pg = 2; pg <= totalPages; pg++) {
    doc.setPage(pg);
    setStroke(BORDER);
    doc.setLineWidth(0.4);
    doc.line(margin, H - 42, W - margin, H - 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setColor(MUTED);
    doc.text(
      `${legalEntity} · Mutual NDA ${agreement.number}`,
      margin,
      H - 26,
    );
    doc.text(
      `Page ${pg - 1} of ${totalPages - 1}`,
      W - margin,
      H - 26,
      { align: "right" },
    );
  }

  const now = new Date();
  const filename = `Attomik_NDA_${clientName.replace(/\s+/g, "_")}_${now.getFullYear()}.pdf`;
  doc.save(filename);
}
