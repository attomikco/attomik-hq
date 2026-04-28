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
  const headerTop = 56;
  const logoW = 70;
  const logoH = logoW * (909 / 3162);
  const logoMid = headerTop + logoH / 2;
  try {
    doc.addImage(LOGO_BLACK_B64, "PNG", margin, headerTop, logoW, logoH);
  } catch {
    /* ignore */
  }

  // Right-side title + effective date, vertically centered against the logo.
  const labelText = "SERVICES AGREEMENT";
  const labelCS = 1.4;
  const labelSize = 7;
  const effectiveText = `Effective ${dateShort(agreement.date)}`;
  const effectiveSize = 8.5;
  const headerLineGap = 6;
  const headerBlockH = labelSize + headerLineGap + effectiveSize;
  const labelBaseline = logoMid - headerBlockH / 2 + labelSize;
  const effectiveBaseline = labelBaseline + headerLineGap + effectiveSize;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(labelSize);
  setColor(MUTED);
  // jsPDF's right-alignment doesn't account for charSpace, so measure manually.
  const labelW =
    doc.getTextWidth(labelText) + (labelText.length - 1) * labelCS;
  doc.text(labelText, W - margin - labelW, labelBaseline, {
    charSpace: labelCS,
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(effectiveSize);
  setColor(MUTED);
  doc.text(effectiveText, W - margin, effectiveBaseline, { align: "right" });

  // Two-column grid for the parties block: exactly 50/50 with an explicit gutter.
  const partiesBlockPadding = 22;
  const gutter = 18;
  const colW = (contentW - gutter) / 2;
  const col1X = margin;
  const col2X = margin + colW + gutter; // mirrored across page center
  let y = headerTop + logoH + partiesBlockPadding * 2;

  // Column labels
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text("BETWEEN", col1X, y, { charSpace: 1 });
  doc.text("AND", col2X, y, { charSpace: 1 });
  y += 16;

  // Legal names
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(INK);
  doc.text(legalEntity, col1X, y);
  doc.text(clientName, col2X, y);
  y += 14;

  // Addresses
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor(MUTED);
  const attomikLines = ["169 Madison Ave, STE 2733", "New York, NY 10016"];
  const rawClientAddress = (agreement.client_address ?? "").trim();
  const addrLH = 11;
  const clientLines: string[] = rawClientAddress
    ? rawClientAddress
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .flatMap((line) => doc.splitTextToSize(line, colW) as string[])
    : ["Address on file"];
  attomikLines.forEach((line, i) => doc.text(line, col1X, y + i * addrLH));
  clientLines.forEach((line, i) =>
    doc.text(line, col2X, y + i * addrLH),
  );
  const addrRows = Math.max(attomikLines.length, clientLines.length, 1);
  // Generous breathing room between the parties block and the TERMS heading.
  y += (addrRows - 1) * addrLH + 52;

  // ── TERMS & CONDITIONS ──────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setColor(ACCENT);
  doc.text("TERMS & CONDITIONS", margin, y, { charSpace: 1.2 });
  y += 20;

  const termsTemplate = agreement.terms || DEFAULT_LEGAL_TERMS;
  const renderedTerms = renderTerms(termsTemplate, {
    client_company: agreement.client_company,
    phase2_commitment: agreement.phase2_commitment,
    governing_law: governingLaw,
    legal_entity: legalEntity,
    proposal_number: agreement.proposal_number,
    proposal_date: agreement.proposal_date
      ? dateShort(agreement.proposal_date)
      : null,
  });

  const paragraphs = renderedTerms.split(/\n\s*\n/);
  // Readable but tight enough to fit the 17-clause body in 3 pages with
  // minimal whitespace. Per-paragraph orphan control below ensures no
  // single paragraph gets split across a page; headings always stay with
  // their first body paragraph.
  const bodySize = 7.5;
  const paraLH = 10;
  const headingSpaceAbove = 12;
  const headingSpaceBelow = 7;
  const paraGap = 4;
  const headingSize = 8.5;
  const inlineBoldGap = 3; // px between inline-bold prefix and normal text
  const BOLD_PREFIX_RE = /^\*\*([^*]+?)\*\*\s*/;

  // Render a body paragraph that may start with a `**Bold prefix.**` marker.
  // The bold portion sits inline at the start of the first line; subsequent
  // wrapped lines reset to the left margin in normal weight.
  function renderBodyPara(para: string): void {
    setColor([70, 70, 70]);
    const boldMatch = BOLD_PREFIX_RE.exec(para);
    if (!boldMatch) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(bodySize);
      const wrapped = doc.splitTextToSize(para, contentW) as string[];
      for (const line of wrapped) {
        const checked = ensureSpace(paraLH, y);
        y = checked.y;
        doc.text(line, margin, y);
        y += paraLH;
      }
      y += paraGap;
      return;
    }

    const boldText = boldMatch[1];
    const restText = para.slice(boldMatch[0].length);

    // Reserve a line so we don't orphan the bold prefix at the bottom of
    // a page with no body following it.
    const checked = ensureSpace(paraLH, y);
    y = checked.y;

    // Bold prefix in ink color
    doc.setFont("helvetica", "bold");
    doc.setFontSize(bodySize);
    setColor(INK);
    doc.text(boldText, margin, y);
    const boldWidth = doc.getTextWidth(boldText);

    // Greedy fit as much normal text as possible on the same line
    doc.setFont("helvetica", "normal");
    setColor([70, 70, 70]);
    const firstLineMax = contentW - boldWidth - inlineBoldGap;
    const words = restText.split(/\s+/).filter(Boolean);
    let firstLineStr = "";
    let consumed = 0;
    while (consumed < words.length) {
      const candidate = firstLineStr
        ? `${firstLineStr} ${words[consumed]}`
        : words[consumed];
      if (doc.getTextWidth(candidate) > firstLineMax) break;
      firstLineStr = candidate;
      consumed += 1;
    }
    if (firstLineStr) {
      doc.text(firstLineStr, margin + boldWidth + inlineBoldGap, y);
    }
    y += paraLH;

    // Continuation wraps at full content width
    if (consumed < words.length) {
      const remaining = words.slice(consumed).join(" ");
      const wrapped = doc.splitTextToSize(remaining, contentW) as string[];
      for (const line of wrapped) {
        const c = ensureSpace(paraLH, y);
        y = c.y;
        doc.text(line, margin, y);
        y += paraLH;
      }
    }
    y += paraGap;
  }

  // Measure the rendered height of a body paragraph (handles inline-bold
  // prefix). Used by the clause-level keep-together logic below.
  function measureBodyParaHeight(para: string): number {
    const boldMatch = BOLD_PREFIX_RE.exec(para);
    if (!boldMatch) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(bodySize);
      const wrapped = doc.splitTextToSize(para, contentW) as string[];
      return wrapped.length * paraLH + paraGap;
    }
    const boldText = boldMatch[1];
    const restText = para.slice(boldMatch[0].length);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(bodySize);
    const boldWidth = doc.getTextWidth(boldText);
    doc.setFont("helvetica", "normal");
    const firstLineMax = contentW - boldWidth - inlineBoldGap;
    const words = restText.split(/\s+/).filter(Boolean);
    let consumed = 0;
    let firstLineStr = "";
    while (consumed < words.length) {
      const candidate = firstLineStr
        ? `${firstLineStr} ${words[consumed]}`
        : words[consumed];
      if (doc.getTextWidth(candidate) > firstLineMax) break;
      firstLineStr = candidate;
      consumed += 1;
    }
    let lines = 1;
    if (consumed < words.length) {
      const remaining = words.slice(consumed).join(" ");
      lines += (doc.splitTextToSize(remaining, contentW) as string[]).length;
    }
    return lines * paraLH + paraGap;
  }

  function pageBreak(): void {
    doc.addPage();
    y = pageTop;
  }

  // Per-paragraph orphan control: each body paragraph is pre-measured and
  // page-broken before render if it wouldn't fit on the current page. A
  // numbered heading additionally checks that its first body paragraph
  // fits on the same page so a heading never gets stranded at the bottom.
  let firstHeading = true;
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const isHeading = /^\d+\.\s+[A-Z]/.test(para);

    if (isHeading) {
      const advance = firstHeading ? 0 : headingSpaceAbove;
      const headingBlock = headingSize + headingSpaceBelow;
      const nextBody = paragraphs[i + 1];
      const nextHeight = nextBody ? measureBodyParaHeight(nextBody) : 0;
      if (y + advance + headingBlock + nextHeight > bottomLimit) {
        pageBreak();
      } else {
        y += advance;
      }
      firstHeading = false;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(headingSize);
      setColor(INK);
      doc.text(para, margin, y, { maxWidth: contentW, charSpace: 0.4 });
      y += 6 + headingSpaceBelow;
    } else {
      const paraHeight = measureBodyParaHeight(para);
      if (y + paraHeight > bottomLimit) pageBreak();
      renderBodyPara(para);
    }
  }

  // ── SIGNATURE BLOCK ─────────────────────────────────────────────
  // More room between the last clause and the signature block so it doesn't
  // feel crammed against the body text.
  y += 40;
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
