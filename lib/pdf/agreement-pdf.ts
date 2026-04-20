import { jsPDF } from "jspdf";
import { LOGO_BLACK_B64, LOGO_WHITE_B64 } from "./logos";
import { dateShort } from "@/lib/format";
import { renderTerms, DEFAULT_LEGAL_TERMS } from "@/lib/defaults/legal-terms";
import { KICKOFF_CATEGORIES } from "@/lib/defaults/kickoff-checklist";
import type { Agreement, KickoffItem, Phase1Item } from "@/lib/types";

type Settings = {
  brand_name?: string;
  legal_name?: string;
  agreement_legal_entity?: string;
  agreement_governing_law?: string;
  agreement_default_phase1_payment?: string;
  agreement_default_phase2_payment?: string;
  agreement_default_late_fee?: string;
};

type RGB = [number, number, number];

const FIXED_P1_TILES: { title: string; bullets: string[] }[] = [
  {
    title: "Commercial Strategy",
    bullets: [
      "Pricing architecture",
      "Bundle & offer structure",
      "P&L built for AOV + LTV",
    ],
  },
  {
    title: "Conversion-Optimized Store",
    bullets: [
      "Full website build, conversion-optimized",
      "Speed, SEO & mobile performance",
      "Clear path to purchase on every page",
    ],
  },
  {
    title: "Retention & Email",
    bullets: [
      "Welcome to win-back automations",
      "Subscription setup",
      "Post-purchase sequences",
    ],
  },
  {
    title: "Technical Foundation",
    bullets: [
      "SEO & AI SEO setup",
      "Analytics & Search Console",
      "Performance optimized",
    ],
  },
  {
    title: "Attomik AI Tools Access",
    bullets: [
      "AI dashboard & insights platform",
      "Marketing OS — all channels in one view",
      "Real-time performance intelligence",
    ],
  },
];

function fmtMoney(n: number): string {
  return `$${(Number(n) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function generateAgreementPDF(
  agreement: Agreement,
  settings: Settings = {},
): void {
  const brand = settings.brand_name || "Attomik";
  const legalEntity = settings.agreement_legal_entity || "Attomik, LLC";
  const governingLaw =
    settings.agreement_governing_law || "State of Delaware, United States";
  const clientName =
    agreement.client_company || agreement.client_name || "Client";

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612;
  const H = 792;
  const margin = 54;
  const contentW = W - margin * 2;

  const INK: RGB = [0, 0, 0];
  const PAPER: RGB = [255, 255, 255];
  const CREAM: RGB = [242, 242, 242];
  const ACCENT: RGB = [0, 255, 151];
  const MUTED: RGB = [102, 102, 102];
  const BORDER: RGB = [224, 224, 224];
  const GREY_LINE: RGB = [40, 40, 40];
  const ACCENT_DARK: RGB = [0, 150, 85];

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setStroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  function label(text: string, x: number, y: number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setColor(MUTED);
    doc.text(text.toUpperCase(), x, y, { charSpace: 1.2 });
  }

  function accentBar(y: number, w?: number, x?: number) {
    const bx = x ?? margin;
    const bw = w ?? contentW;
    setFill(ACCENT);
    doc.rect(bx, y, bw, 4, "F");
  }

  function sectionHeader(lbl: string, headline: string, y: number): number {
    accentBar(y);
    y += 20;
    const isPhase = /^phase|section|kickoff|terms|commercial/i.test(lbl);
    if (isPhase) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      setColor(ACCENT);
      doc.text(lbl.toUpperCase(), margin, y, { charSpace: 2 });
      y += 30;
    } else {
      label(lbl, margin, y);
      y += 26;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    setColor(INK);
    const hl = doc.splitTextToSize(headline, contentW) as string[];
    doc.text(hl, margin, y);
    return y + hl.length * 28;
  }

  function bodyText(
    text: string,
    x: number,
    y: number,
    maxW?: number,
    sz?: number,
  ): number {
    const size = sz ?? 9.5;
    const width = maxW ?? contentW;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    setColor(MUTED);
    const lines = doc.splitTextToSize(text, width) as string[];
    doc.text(lines, x, y);
    return y + lines.length * (size * 1.5);
  }

  const now = new Date();

  // ── PAGE 1: COVER ────────────────────────────────────────────────
  setFill(INK);
  doc.rect(0, 0, W, H, "F");
  doc.setLineWidth(0.3);
  setStroke(GREY_LINE);
  for (let gx = 0; gx < W; gx += 40) doc.line(gx, 0, gx, H);
  for (let gy = 0; gy < H; gy += 40) doc.line(0, gy, W, gy);
  setFill(ACCENT);
  doc.rect(0, 0, W, 5, "F");
  setFill([17, 17, 17]);
  doc.rect(0, H - 50, W, 50, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor([100, 100, 100]);
  doc.text("CONFIDENTIAL — SERVICES AGREEMENT", margin, H - 20);
  doc.text(
    `${legalEntity} · ${now.getFullYear()}`,
    W - margin,
    H - 20,
    { align: "right" },
  );

  try {
    doc.addImage(
      LOGO_WHITE_B64,
      "PNG",
      margin,
      H * 0.22,
      140,
      140 * (909 / 3162),
    );
  } catch {
    /* ignore */
  }

  const titleY = H * 0.42;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  setColor(PAPER);
  doc.text("Services", margin, titleY);
  setColor(ACCENT);
  doc.text("Agreement.", margin, titleY + 50);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(MUTED);
  doc.text("AGREEMENT NUMBER", margin, titleY + 90, { charSpace: 1.2 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setColor(PAPER);
  doc.text(agreement.number || "—", margin, titleY + 108);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(MUTED);
  doc.text("BETWEEN", margin, titleY + 140, { charSpace: 1.2 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setColor(PAPER);
  doc.text(legalEntity, margin, titleY + 160);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setColor([170, 170, 170]);
  doc.text("and", margin, titleY + 178);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setColor(PAPER);
  doc.text(clientName, margin, titleY + 198);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(MUTED);
  doc.text("EFFECTIVE DATE", margin, titleY + 230, { charSpace: 1.2 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setColor(PAPER);
  doc.text(dateShort(agreement.date), margin, titleY + 248);

  // ── PAGE 2: TERMS & CONDITIONS ───────────────────────────────────
  doc.addPage();
  let y = 80;
  y = sectionHeader("Terms", "Terms & Conditions.", y);
  y += 4;

  const termsTemplate = agreement.terms || DEFAULT_LEGAL_TERMS;
  const renderedTerms = renderTerms(termsTemplate, {
    client_company: agreement.client_company,
    phase2_commitment: agreement.phase2_commitment,
    governing_law: governingLaw,
    legal_entity: legalEntity,
  });

  // Paginate terms content — hand-flowing so long terms don't overflow.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(INK);
  const paragraphs = renderedTerms.split(/\n\s*\n/);
  const lineHeight = 12;
  const bottomLimit = H - 60;
  for (const para of paragraphs) {
    const isHeading = /^\d+\.\s+[A-Z]/.test(para);
    if (isHeading) {
      if (y + 18 > bottomLimit) {
        doc.addPage();
        y = 80;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setColor(INK);
      doc.text(para, margin, y, { maxWidth: contentW });
      y += 14;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      setColor([60, 60, 60]);
      const wrapped = doc.splitTextToSize(para, contentW) as string[];
      for (const line of wrapped) {
        if (y + lineHeight > bottomLimit) {
          doc.addPage();
          y = 80;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      }
      y += 6;
    }
  }

  // ── PAGE 3: SCOPE & DELIVERABLES ─────────────────────────────────
  doc.addPage();
  y = 80;
  y = sectionHeader("Scope", "Scope & Deliverables.", y);
  y = bodyText(
    "This Agreement covers two phases: a one-time strategic build (Phase 1) followed by an ongoing growth partnership (Phase 2).",
    margin,
    y,
    contentW,
  );
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(ACCENT_DARK);
  doc.text("PHASE 1 — BUILD", margin, y, { charSpace: 1.4 });
  y += 18;

  const tiles = FIXED_P1_TILES;
  const tileW = contentW / 2 - 6;
  const tileH = 80;
  tiles.forEach((d, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const tx = margin + col * (tileW + 12);
    const ty = y + row * (tileH + 8);
    setFill(CREAM);
    setStroke(BORDER);
    doc.setLineWidth(0.5);
    doc.rect(tx, ty, tileW, tileH, "FD");
    setFill(ACCENT);
    doc.rect(tx, ty, tileW, 2.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setColor(INK);
    doc.text(d.title, tx + 12, ty + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(MUTED);
    let by = ty + 33;
    d.bullets.forEach((b) => {
      doc.text(`· ${b}`, tx + 12, by);
      by += 11;
    });
  });
  y += Math.ceil(tiles.length / 2) * (tileH + 8) + 6;

  // Phase 1 line items as selected services block
  const p1Items: Phase1Item[] = Array.isArray(agreement.phase1_items)
    ? agreement.phase1_items
    : [];
  if (p1Items.length > 0) {
    const itemsText = p1Items
      .map((it) => `· ${it.name}`)
      .join("\n");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setColor(MUTED);
    doc.text("SERVICES INCLUDED", margin, y + 14, { charSpace: 0.8 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(INK);
    const lines = doc.splitTextToSize(itemsText, contentW) as string[];
    doc.text(lines, margin, y + 28);
    y += 28 + lines.length * 12;
  }

  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(ACCENT_DARK);
  doc.text("PHASE 2 — GROWTH PARTNERSHIP", margin, y, { charSpace: 1.4 });
  y += 16;

  setFill(INK);
  doc.rect(margin, y, contentW, 100, "F");
  setFill(ACCENT);
  doc.rect(margin, y, contentW, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(ACCENT);
  doc.text("ONGOING SERVICE", margin + 14, y + 20, { charSpace: 1.2 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setColor(PAPER);
  const p2Title = agreement.phase2_service || "Monthly Retainer";
  const titleLines = doc.splitTextToSize(p2Title, contentW - 28) as string[];
  doc.text(titleLines, margin + 14, y + 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor([170, 170, 170]);
  doc.text(
    "Channel ownership: Attomik manages execution, reporting, and continuous improvement across the agreed channels for the duration of the engagement.",
    margin + 14,
    y + 42 + titleLines.length * 16 + 6,
    { maxWidth: contentW - 28 },
  );

  // ── PAGE 4: COMMERCIAL TERMS ─────────────────────────────────────
  doc.addPage();
  y = 80;
  y = sectionHeader("Commercial", "Commercial Terms.", y);
  y += 6;

  // Phase 1 card
  const p1Total = Number(agreement.phase1_total ?? 0) || 0;
  const p1Timeline = agreement.phase1_timeline || "—";
  const p1Payment =
    agreement.phase1_payment ||
    settings.agreement_default_phase1_payment ||
    "50% upon signing, 50% upon delivery";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(INK);
  doc.text("Phase 1 — Build", margin, y);
  y += 14;

  setFill(CREAM);
  setStroke(BORDER);
  doc.setLineWidth(0.5);
  const p1Rows = Math.max(1, p1Items.length);
  const p1CardH = 46 + p1Rows * 16 + 58;
  doc.rect(margin, y, contentW, p1CardH, "FD");
  setFill(ACCENT);
  doc.rect(margin, y, contentW, 3, "F");

  label("SCOPE LINE ITEMS", margin + 14, y + 22);
  let ry = y + 40;
  if (p1Items.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(MUTED);
    doc.text("No line items", margin + 14, ry);
    ry += 16;
  } else {
    p1Items.forEach((it) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      setColor(INK);
      doc.text(`· ${it.name}`, margin + 14, ry);
      doc.setFont("helvetica", "bold");
      setColor(INK);
      doc.text(fmtMoney(Number(it.price) || 0), W - margin - 14, ry, {
        align: "right",
      });
      ry += 16;
    });
  }

  // Totals row
  ry += 4;
  setStroke(BORDER);
  doc.setLineWidth(0.5);
  doc.line(margin + 14, ry, W - margin - 14, ry);
  ry += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(INK);
  doc.text("Total", margin + 14, ry);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setColor(ACCENT_DARK);
  doc.text(fmtMoney(p1Total), W - margin - 14, ry, { align: "right" });
  ry += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(MUTED);
  doc.text(
    `Timeline: ${p1Timeline}   ·   Payment: ${p1Payment}`,
    margin + 14,
    ry,
  );

  y += p1CardH + 20;

  // Phase 2 card
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(INK);
  doc.text("Phase 2 — Growth Partnership", margin, y);
  y += 14;

  const p2Rate = Number(agreement.phase2_rate ?? 0) || 0;
  const p2Commitment = Number(agreement.phase2_commitment ?? 6) || 6;
  const p2Start = agreement.phase2_start_date
    ? dateShort(agreement.phase2_start_date)
    : "Upon Phase 1 launch";
  const p2Billing =
    settings.agreement_default_phase2_payment ||
    "Invoiced monthly on the 1st, due net 15";

  const p2CardH = 128;
  setFill(CREAM);
  setStroke(BORDER);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, contentW, p2CardH, "FD");
  setFill(ACCENT);
  doc.rect(margin, y, contentW, 3, "F");

  const p2cols: [number, string, string][] = [
    [margin, "MONTHLY RATE", `${fmtMoney(p2Rate)} / mo`],
    [margin + contentW / 3, "COMMITMENT", `${p2Commitment} months`],
    [margin + (contentW * 2) / 3, "START DATE", p2Start],
  ];
  p2cols.forEach((pc, i) => {
    if (i > 0) {
      setStroke(BORDER);
      doc.setLineWidth(0.5);
      doc.line(pc[0], y + 4, pc[0], y + 84);
    }
    label(pc[1], pc[0] + 14, y + 22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(i === 0 ? 16 : 13);
    setColor(INK);
    doc.text(pc[2], pc[0] + 14, y + 54, { maxWidth: contentW / 3 - 24 });
  });

  // Billing cadence under the 3 cols
  setStroke(BORDER);
  doc.setLineWidth(0.5);
  doc.line(margin + 14, y + 90, W - margin - 14, y + 90);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(MUTED);
  doc.text(`Billing: ${p2Billing}`, margin + 14, y + 108);

  y += p2CardH + 20;

  // Late fee + tax note
  const lateFee =
    settings.agreement_default_late_fee ||
    "1.5% per month on overdue balances";
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  setColor(MUTED);
  const footLines = doc.splitTextToSize(
    `Late payments accrue ${lateFee}. All fees exclusive of applicable taxes.`,
    contentW,
  ) as string[];
  doc.text(footLines, margin, y);

  // ── PAGE 5: KICKOFF & ACCEPTANCE ────────────────────────────────
  doc.addPage();
  y = 80;
  y = sectionHeader("Kickoff", "To Get Started.", y);
  y = bodyText(
    "To hit the ground running on Day 1, we'll need the following from your team. Items marked required are needed to start; the rest can come in during the first week.",
    margin,
    y,
    contentW,
  );
  y += 14;

  const kickoffItems: KickoffItem[] = Array.isArray(agreement.kickoff_items)
    ? agreement.kickoff_items
    : [];

  const grouped = new Map<string, KickoffItem[]>();
  for (const cat of KICKOFF_CATEGORIES) grouped.set(cat, []);
  for (const it of kickoffItems) {
    if (!grouped.has(it.category)) grouped.set(it.category, []);
    grouped.get(it.category)!.push(it);
  }

  const leftColX = margin;
  const colWidth = contentW / 2 - 8;
  let colLeftY = y;
  let colRightY = y;
  let useRight = false;

  const cats = Array.from(grouped.entries()).filter(
    ([, items]) => items.length > 0,
  );

  for (const [cat, items] of cats) {
    const blockH = 20 + items.length * 12 + 6;
    const colY = useRight ? colRightY : colLeftY;
    const colX = useRight ? margin + contentW / 2 + 8 : leftColX;
    if (colY + blockH > H - 180) {
      // hard bottom reserve for the signature section
      useRight = !useRight;
    }
    const drawX = useRight ? margin + contentW / 2 + 8 : leftColX;
    const drawY = useRight ? colRightY : colLeftY;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setColor(MUTED);
    doc.text(cat.toUpperCase(), drawX, drawY, { charSpace: 0.8 });
    let iy = drawY + 14;
    items.forEach((it) => {
      // indicator
      if (it.provided) {
        setColor(ACCENT_DARK);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("✓", drawX, iy);
      } else if (it.required) {
        setFill(ACCENT);
        doc.circle(drawX + 3, iy - 3, 2, "F");
      } else {
        setStroke(BORDER);
        doc.setLineWidth(0.5);
        doc.circle(drawX + 3, iy - 3, 2, "S");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setColor([60, 60, 60]);
      const wrapped = doc.splitTextToSize(it.item, colWidth - 14) as string[];
      doc.text(wrapped, drawX + 10, iy);
      iy += wrapped.length * 11;
    });
    if (useRight) colRightY = iy + 10;
    else colLeftY = iy + 10;
    useRight = !useRight;
  }

  // What happens next + signature block at bottom
  const bottomY = Math.max(colLeftY, colRightY, H - 190);
  let ny = Math.max(bottomY, H - 190);

  setStroke(BORDER);
  doc.setLineWidth(0.5);
  doc.line(margin, ny, W - margin, ny);
  ny += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text("WHAT HAPPENS NEXT", margin, ny, { charSpace: 0.8 });
  ny += 14;
  const steps = [
    "1. Sign this agreement (reply \"I accept\" or return signed)",
    "2. Schedule the kickoff call (within 5 business days)",
    "3. Send over access and materials from the list above",
    "4. Work begins on the Phase 1 start date",
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(INK);
  steps.forEach((s) => {
    doc.text(s, margin, ny);
    ny += 12;
  });

  // Signature block
  const sigY = H - 110;
  setStroke(BORDER);
  doc.setLineWidth(0.5);
  doc.line(margin, sigY - 16, W - margin, sigY - 16);

  const sigColW = contentW / 2 - 12;
  const leftSigX = margin;
  const rightSigX = margin + contentW / 2 + 12;

  // Left — Attomik
  label("FOR ATTOMIK, LLC", leftSigX, sigY);
  setStroke(INK);
  doc.setLineWidth(0.6);
  doc.line(leftSigX, sigY + 30, leftSigX + sigColW, sigY + 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(INK);
  doc.text("Pablo Rivera, Founder", leftSigX, sigY + 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text(`Date: ${dateShort(agreement.date)}`, leftSigX, sigY + 56);

  // Right — Client
  label(`FOR ${clientName.toUpperCase()}`, rightSigX, sigY);
  setStroke(INK);
  doc.setLineWidth(0.6);
  doc.line(rightSigX, sigY + 30, rightSigX + sigColW, sigY + 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(INK);
  const signer = agreement.signed_by_name
    ? `${agreement.signed_by_name}${
        agreement.signed_by_title ? `, ${agreement.signed_by_title}` : ""
      }`
    : "Name & title";
  doc.text(signer, rightSigX, sigY + 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text(
    `Date: ${agreement.signed_date ? dateShort(agreement.signed_date) : "________________"}`,
    rightSigX,
    sigY + 56,
  );

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  setColor(MUTED);
  doc.text(
    'Reply to the agreement email with "I accept" to confirm electronically.',
    margin,
    H - 30,
  );

  // ── Page chrome 2..N ─────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let pg = 2; pg <= totalPages; pg++) {
    doc.setPage(pg);
    try {
      doc.addImage(LOGO_BLACK_B64, "PNG", margin, 40, 100, 100 * (909 / 3162));
    } catch {
      /* ignore */
    }
    setStroke(BORDER);
    doc.setLineWidth(0.5);
    doc.line(margin, H - 36, W - margin, H - 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setColor([153, 153, 153]);
    doc.text(
      `${legalEntity} · Services Agreement ${agreement.number ?? ""}`,
      margin,
      H - 24,
    );
    doc.text(`Page ${pg} of ${totalPages}`, W - margin, H - 24, {
      align: "right",
    });
  }

  const filename = `Attomik_Agreement_${clientName.replace(/\s+/g, "_")}_${now.getFullYear()}.pdf`;
  doc.save(filename);
  // brand is part of the file metadata; use a no-op reference to keep strict
  void brand;
}
