import { jsPDF } from "jspdf";
import { LOGO_BLACK_B64, LOGO_WHITE_B64 } from "./logos";
import { dateShort, lineSubtotal } from "@/lib/format";

type LineItemLike = {
  service_id?: string | null;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  desc?: string | null;
  qty?: number | string | null;
  quantity?: number | string | null;
  rate?: number | string | null;
  price?: number | string | null;
};

type Proposal = {
  number: string | null;
  date: string | null;
  valid_until: string | null;
  client_name: string | null;
  client_email: string | null;
  client_company: string | null;
  intro: string | null;
  notes?: string | null;
  phase1_title?: string | null;
  phase1_price?: string | null;
  phase1_compare: string | null;
  phase1_note: string | null;
  phase1_timeline: string | null;
  phase1_payment: string | null;
  phase2_title: string | null;
  phase2_monthly?: string | null;
  phase2_compare: string | null;
  phase2_note: string | null;
  phase2_commitment: string | null;
  p1_items?: LineItemLike[] | null;
  p1_total?: number | null;
  p1_discount?: number | null;
  p2_rate?: number | null;
  p2_total?: number | null;
  p2_discount?: number | null;
};

const DEFAULT_P1_TITLE = "DTC Strategy + Store Build";
const DEFAULT_P1_INTRO =
  "A ground-up strategic build — not just a redesign. This phase lays the commercial, technical, and retention infrastructure needed to scale.";
const DEFAULT_P2_TITLE = "Growth + Ads Bundle";

type P1Tile = {
  title: string;
  description?: string;
  bullets?: string[];
};

const DEFAULT_P1_SCOPE_IN: string[] = [
  "Ecommerce store (one domain)",
  "Full product catalog setup",
  "Pricing strategy & shipping model",
  "Email flows: welcome, abandoned cart, reviews",
  "Subscription app setup",
  "Third-party app integrations (Klaviyo, etc.)",
  "SEO + AI SEO + Google Search Console",
  "GA4 + store analytics",
];

const DEFAULT_P1_SCOPE_OUT: string[] = [
  "Paid advertising (Phase 2)",
  "Third-party app subscription fees",
  "Theme or template license (~$350, billed separately)",
  "Product photography or video",
  "Custom-coded development",
];

const DEFAULT_P2_ITEMS: [string, string][] = [
  [
    "Meta Ads — Full Funnel",
    "Weekly strategy, creative briefing, audience testing, budget allocation, and weekly optimization.",
  ],
  [
    "DTC Management",
    "DTC store UX improvements, email flow optimization, app integrations, and metric tracking.",
  ],
  [
    "Performance Reporting",
    "CAC, AOV, LTV, and ROAS tracked weekly. You always know what's working.",
  ],
  [
    "Email & Retention",
    "Ongoing flows, campaigns, and segmentation to maximize repeat revenue.",
  ],
];

const DEFAULT_P2_SCOPE_IN: string[] = [
  "Meta ads — full funnel",
  "Weekly creative direction",
  "CAC/AOV/LTV tracking",
  "Email campaigns + flow optimization",
  "DTC store UX improvements",
  "Monthly performance reporting",
];

const DEFAULT_P2_SCOPE_OUT: string[] = [
  "Google Ads (add-on)",
  "Amazon management",
  "TikTok Shop management",
  "Product photography",
  "Influencer or PR",
  "Brand identity or packaging",
];

function itemsToTiles(items: LineItemLike[]): P1Tile[] {
  return items.map((it) => {
    const title = (it.title ?? it.name ?? "Service") as string;
    const descRaw = (it.description ?? it.desc ?? "") as string;
    const desc = String(descRaw).trim();
    if (!desc) {
      return { title, description: "" };
    }
    const bulletLines = desc
      .split(/\r?\n/)
      .map((line) => line.replace(/^[•·\-\s]+/, "").trim())
      .filter((line) => line.length > 0);
    if (bulletLines.length > 1) {
      return { title, bullets: bulletLines.slice(0, 4) };
    }
    return { title, description: desc };
  });
}

function itemsToScopeIn(items: LineItemLike[]): string[] {
  const titles = items
    .map((it) => ((it.title ?? it.name ?? "") as string).trim())
    .filter((t) => t.length > 0);
  return titles.length > 0 ? titles : DEFAULT_P1_SCOPE_IN;
}

function fmtMoney(n: number): string {
  return `$${(Number(n) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}


type Settings = {
  brand_name?: string;
  legal_name?: string;
};

type RGB = [number, number, number];

export function generateProposalPDF(prop: Proposal, settings: Settings = {}): void {
  const brand =
    settings.brand_name || (settings.legal_name ?? "").split(" ")[0] || "Attomik";
  const clientName = prop.client_company || prop.client_name || "Client";

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

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setStroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  function drawArrow(x: number, y: number, color: RGB) {
    setStroke(color);
    doc.setLineWidth(0.8);
    doc.line(x, y, x + 10, y);
    doc.line(x + 7, y - 2.5, x + 10, y);
    doc.line(x + 7, y + 2.5, x + 10, y);
  }

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
    const isPhase = /^phase/i.test(lbl);
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

  function scopeSection(inItems: string[], outItems: string[], y: number): number {
    const colW = contentW / 2 - 6;
    const topPad = 32;
    const botPad = 16;
    const availH = H - y - 60;

    const measure = (items: string[], fontSize: number) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);
      const rowH = fontSize <= 7.35 ? 10 : 12;
      const wrapped = items.map(
        (item) => doc.splitTextToSize(item, colW - 28) as string[],
      );
      const total = wrapped.reduce((sum, l) => sum + l.length * rowH, 0);
      return { wrapped, total, rowH };
    };

    let fontSize = 9.45;
    let ins = measure(inItems, fontSize);
    let outs = measure(outItems, fontSize);
    let boxH = Math.max(ins.total, outs.total) + topPad + botPad;
    if (boxH > availH) {
      fontSize = 7.35;
      ins = measure(inItems, fontSize);
      outs = measure(outItems, fontSize);
      boxH = Math.max(ins.total, outs.total) + topPad + botPad;
    }

    // IN box
    setFill([245, 255, 250]);
    setStroke([0, 200, 120]);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, colW, boxH, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setColor([0, 160, 90]);
    doc.text("INCLUDED", margin + 12, y + 18, { charSpace: 0.8 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    setColor(INK);
    let iy = y + topPad;
    ins.wrapped.forEach((lines) => {
      setFill([0, 200, 120]);
      doc.circle(margin + 12, iy - 3, 2, "F");
      doc.text(lines, margin + 20, iy);
      iy += lines.length * ins.rowH;
    });

    // OUT box
    const ox = margin + colW + 12;
    setFill([255, 252, 252]);
    setStroke(BORDER);
    doc.setLineWidth(0.5);
    doc.rect(ox, y, colW, boxH, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setColor(MUTED);
    doc.text("NOT INCLUDED", ox + 12, y + 18, { charSpace: 0.8 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    setColor(MUTED);
    iy = y + topPad;
    outs.wrapped.forEach((lines) => {
      setFill(BORDER);
      doc.circle(ox + 12, iy - 3, 2, "F");
      doc.text(lines, ox + 20, iy);
      iy += lines.length * outs.rowH;
    });

    return y + boxH + 16;
  }

  const now = new Date();

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
  const issuedStr = prop.date ? dateShort(prop.date) : "";
  const validStr = prop.valid_until ? dateShort(prop.valid_until) : "";
  doc.text("CONFIDENTIAL — FOR REVIEW ONLY", margin, H - 20);
  doc.text(
    `Issued: ${issuedStr}${validStr ? ` · Valid Until: ${validStr}` : ""}`,
    W - margin,
    H - 20,
    { align: "right" },
  );

  try {
    doc.addImage(LOGO_WHITE_B64, "PNG", margin, H * 0.32, 140, 140 * (909 / 3162));
  } catch {
    /* ignore */
  }

  const titleY = H * 0.44;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  setColor(PAPER);
  doc.text("Ecommerce Growth", margin, titleY);
  setColor(ACCENT);
  doc.text("Proposal.", margin, titleY + 50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(MUTED);
  doc.text("PREPARED FOR", margin, titleY + 84, { charSpace: 1.2 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setColor(PAPER);
  doc.text(clientName, margin, titleY + 104);

  // ── PAGE 2: OUR APPROACH ─────────────────────────────────────────
  doc.addPage();
  let y = 80;
  y = sectionHeader(
    "Our Approach",
    "Where every channel compounds into growth.",
    y,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(INK);
  doc.text("Built by operators. Powered by AI.", margin, y);
  y += 18;
  y = bodyText(
    "Attomik is an AI-powered CPG growth studio built by founders who've scaled brands from zero to market leadership. We build, operate, and partner with consumer brands across multiple CPG categories — so every strategy we recommend has already been battle-tested with real revenue at stake. We're not advisors. We're operators.",
    margin,
    y,
    contentW,
  );
  y += 16;

  const cardW = (contentW - 16) / 3;
  const cardH = 130;
  const cards: [string, string][] = [
    [
      "OPERATORS, NOT ADVISORS",
      "We build and operate our own CPG brands. Every recommendation comes from experience with real revenue and real risk — not case studies from other people's work.",
    ],
    [
      "5 PROPRIETARY AI TOOLS",
      "Purpose-built for CPG: AI Search & Discovery, Creative Testing, Market Intelligence, Content at Scale, and Conversion Optimization. Not off-the-shelf plugins.",
    ],
    [
      "10× SPEED",
      "AI-driven processes compress what used to take months into days. Creative testing, content production, market analysis — all running at a pace traditional teams can't match.",
    ],
  ];
  cards.forEach((card, i) => {
    const cx = margin + i * (cardW + 8);
    setFill(INK);
    doc.roundedRect(cx, y, cardW, cardH, 4, 4, "F");
    setFill(ACCENT);
    doc.rect(cx, y, cardW, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setColor(ACCENT);
    doc.text(card[0], cx + 14, y + 18, { charSpace: 0.8 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setColor([170, 170, 170]);
    const cl = doc.splitTextToSize(card[1], cardW - 28) as string[];
    doc.text(cl, cx + 14, y + 32);
  });
  y += cardH + 18;

  y = bodyText(
    "Every client gets access to Attomik OS — our proprietary marketing intelligence platform. It connects every channel into a single dashboard: real-time ad performance, email revenue attribution, SEO movement, and margin analysis — all in one place. Our AI layer surfaces what's working, flags what isn't, and recommends where to allocate next.",
    margin,
    y,
    contentW,
  );
  y += 14;

  // Portfolio bar
  setFill(CREAM);
  setStroke(BORDER);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, contentW, 32, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text("OUR PORTFOLIO", margin + 12, y + 12, { charSpace: 0.8 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor(INK);
  doc.text(
    "Coffee · Beverages · Wine · Spirits · Skincare · Food · Powders · Non-Alc",
    margin + 12,
    y + 24,
  );
  y += 46;

  // Callout
  const calloutText =
    prop.intro ||
    "Built in two phases. You only commit to Phase 1 — Phase 2 starts after launch and runs month-by-month with no commitment, so you can cancel after Phase 1 or stop anytime once it's running.";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const calloutLines = doc.splitTextToSize(calloutText, contentW - 24) as string[];
  const calloutH = calloutLines.length * 14 + 20;
  setFill([245, 255, 250]);
  setStroke(ACCENT);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, contentW, calloutH, "FD");
  setFill(ACCENT);
  doc.rect(margin, y, 3, calloutH, "F");
  setColor(INK);
  doc.text(
    calloutLines,
    margin + 14,
    y + (calloutH - calloutLines.length * 14) / 2 + 10,
  );
  y += calloutH + 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor(MUTED);
  doc.text("Learn more about how we work at attomik.co", margin, y);

  // ── PAGE 3: PHASE ONE (skipped when there are no items) ─────────
  const p1Items: LineItemLike[] = Array.isArray(prop.p1_items)
    ? prop.p1_items
    : [];
  const p1ItemsSubtotal = lineSubtotal(p1Items);
  const p1Base =
    p1ItemsSubtotal > 0
      ? p1ItemsSubtotal
      : Number(prop.p1_total ?? 0) || 0;
  const hasPhase1 = p1Base > 0;
  const ACCENT_DARK: RGB = [0, 150, 85];

  if (hasPhase1) {
    doc.addPage();
    y = 80;
    const firstItemTitle = p1Items
      .map((it) => ((it.title ?? it.name ?? "") as string).trim())
      .find((t) => t.length > 0);
    const p1title =
      prop.phase1_title || firstItemTitle || DEFAULT_P1_TITLE;
    const p1Intro = DEFAULT_P1_INTRO;
    const p1DiscountPct = Number(prop.p1_discount ?? 0) || 0;
    const p1HasDiscount = p1Base > 0 && p1DiscountPct > 0;
    const p1Net = p1HasDiscount
      ? Math.max(0, p1Base - p1Base * (p1DiscountPct / 100))
      : p1Base;
    const p1price = p1Base > 0 ? fmtMoney(p1Net) : "—";
    const p1BaseFmt = fmtMoney(p1Base);
    const p1timeline = prop.phase1_timeline || "20 – 45 days";
    const p1payment = prop.phase1_payment || "$5k to start · $3k on launch";

    y = sectionHeader("Phase One", p1title, y);
    y = bodyText(p1Intro, margin, y, contentW);
    y += 16;

    const tiles: P1Tile[] =
      p1Items.length > 0 ? itemsToTiles(p1Items) : [];

    const tileW = contentW / 2 - 6;
    const tileH = 82;
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
      if (d.bullets && d.bullets.length > 0) {
        d.bullets.forEach((b) => {
          doc.text(`· ${b}`, tx + 12, by);
          by += 11;
        });
      } else if (d.description) {
        const desc = doc.splitTextToSize(d.description, tileW - 24) as string[];
        desc.forEach((line) => {
          doc.text(line, tx + 12, by);
          by += 11;
        });
      }
    });
    y += Math.ceil(tiles.length / 2) * (tileH + 8) + 12;

    // Pricing card
    const hasP1Note = !!String(prop.phase1_note ?? "").trim();
    const p1CompareRaw = parseFloat(
      String(prop.phase1_compare ?? "").replace(/[^0-9.]/g, ""),
    );
    const p1CompareAmt =
      !isNaN(p1CompareRaw) && p1CompareRaw > 0 && p1CompareRaw !== p1Net
        ? p1CompareRaw
        : p1HasDiscount
          ? p1Base
          : 0;
    const p1ShowStrike = p1CompareAmt > 0 && p1Base > 0;
    const p1cardH =
      78 + (p1ShowStrike ? 16 : 0) + (hasP1Note ? 14 : 0);
    setStroke(BORDER);
    doc.setLineWidth(0.5);
    setFill(CREAM);
    doc.rect(margin, y, contentW, p1cardH, "FD");
    setFill(ACCENT);
    doc.rect(margin, y, contentW, 4, "F");
    const pcols: [number, string, string][] = [
      [margin, "INVESTMENT", p1price],
      [margin + contentW / 3, "TIMELINE", p1timeline],
      [margin + (contentW * 2) / 3, "PAYMENT TERMS", p1payment],
    ];
    pcols.forEach((pc, i) => {
      if (i > 0) {
        setStroke(BORDER);
        doc.setLineWidth(0.5);
        doc.line(pc[0], y + 4, pc[0], y + p1cardH);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      setColor(MUTED);
      doc.text(pc[1], pc[0] + 16, y + 20, { charSpace: 0.8 });
      const fSz = i === 0 ? 18 : i === 1 ? 16 : 11;

      if (i === 0 && p1ShowStrike) {
        const strikeY = y + 34;
        const cx = pc[0] + 16;
        const strikeFmt = fmtMoney(p1CompareAmt);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        setColor(MUTED);
        doc.text(strikeFmt, cx, strikeY);
        const w = doc.getTextWidth(strikeFmt);
        setStroke(MUTED);
        doc.setLineWidth(0.6);
        doc.line(cx, strikeY - 2.5, cx + w, strikeY - 2.5);
        if (p1HasDiscount) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          setColor(ACCENT_DARK);
          doc.text(`· ${p1DiscountPct}% off`, cx + w + 8, strikeY);
        }
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(fSz);
      setColor(INK);
      const valY = y + (p1ShowStrike ? 45 : 31) + fSz * 0.72;
      const vl = doc.splitTextToSize(pc[2], contentW / 3 - 32) as string[];
      doc.text(vl, pc[0] + 16, valY);

      if (i === 0 && hasP1Note) {
        const noteY = valY + 14;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        setColor(ACCENT_DARK);
        doc.text(`· ${prop.phase1_note}`, pc[0] + 16, noteY);
      }
    });
    y += p1cardH + 18;

    // Scope
    const scopeIn = itemsToScopeIn(p1Items);
    const scopeOut = DEFAULT_P1_SCOPE_OUT;

    label("SCOPE OF WORK", margin, y);
    y += 14;
    y = scopeSection(scopeIn, scopeOut, y);
  }

  // ── PAGE 4: PHASE TWO ───────────────────────────────────────────
  const p2RateStored = Number(prop.p2_rate ?? 0) || 0;
  const p2RateFallback = Number(prop.p2_total ?? 0) || 0;
  const p2BaseAmt = p2RateStored > 0 ? p2RateStored : p2RateFallback;
  const hasPhase2 = p2BaseAmt > 0;
  const p2title = prop.phase2_title || DEFAULT_P2_TITLE;
  const p2BaseFmt = `${fmtMoney(p2BaseAmt)} / mo`;
  const p2DiscountPct = Number(prop.p2_discount ?? 0) || 0;
  const p2HasDiscount = p2BaseAmt > 0 && p2DiscountPct > 0;
  const p2NetAmt = p2HasDiscount
    ? Math.max(0, p2BaseAmt - p2BaseAmt * (p2DiscountPct / 100))
    : p2BaseAmt;
  const p2monthly = `${fmtMoney(p2NetAmt)} / mo`;

  if (hasPhase2) {
    doc.addPage();
    y = 80;
    y = sectionHeader("Phase Two", p2title, y);
    y = bodyText(
      "Once the site is live, we take full ownership of ecom channel performance. No handoffs, no gaps — just a clear view of what's working and continuous improvement.",
      margin,
      y,
      contentW,
    );
    y += 20;

    const p2items: [string, string][] = DEFAULT_P2_ITEMS;
  p2items.forEach((item) => {
    drawArrow(margin, y - 3, MUTED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    setColor(INK);
    doc.text(item[0], margin + 20, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(MUTED);
    const il = doc.splitTextToSize(item[1], contentW - 20) as string[];
    doc.text(il, margin + 20, y);
    y += il.length * 13 + 16;
  });
  y += 8;
  setStroke(BORDER);
  doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 20;

  // Phase 2 pricing card
  const hasP2Note = !!String(prop.phase2_note ?? "").trim();
  const p2cardH =
    78 + (p2HasDiscount ? 16 : 0) + (hasP2Note ? 14 : 0);
  const ACCENT_DARK2: RGB = [0, 150, 85];
  setFill(CREAM);
  setStroke(BORDER);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, contentW, p2cardH, "FD");
  setFill(ACCENT);
  doc.rect(margin, y, contentW, 4, "F");
  const p2cols: [number, string, string, string][] = [
    [margin, "MONTHLY RETAINER", p2monthly, ""],
    [margin + contentW / 3, "SCOPE", "Channel Ownership", ""],
    [
      margin + (contentW * 2) / 3,
      "TERMS",
      "Month-by-month",
      "Cancel anytime.",
    ],
  ];
  p2cols.forEach((pc, i) => {
    if (i > 0) {
      setStroke(BORDER);
      doc.setLineWidth(0.5);
      doc.line(pc[0], y + 4, pc[0], y + p2cardH);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setColor(MUTED);
    doc.text(pc[1], pc[0] + 16, y + 20, { charSpace: 0.8 });
    const vSz = i === 0 ? 16 : 12;

    if (i === 0 && p2HasDiscount) {
      const strikeY = y + 34;
      const cx = pc[0] + 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      setColor(MUTED);
      doc.text(p2BaseFmt, cx, strikeY);
      const w = doc.getTextWidth(p2BaseFmt);
      setStroke(MUTED);
      doc.setLineWidth(0.6);
      doc.line(cx, strikeY - 2.5, cx + w, strikeY - 2.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setColor(ACCENT_DARK2);
      doc.text(`· ${p2DiscountPct}% off`, cx + w + 8, strikeY);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(vSz);
    setColor(INK);
    const valY2 = y + (p2HasDiscount ? 45 : 30) + vSz * 0.72;
    const vl = doc.splitTextToSize(pc[2], contentW / 3 - 32) as string[];
    doc.text(vl, pc[0] + 16, valY2);

    if (i === 0 && hasP2Note) {
      const noteY = valY2 + 14;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      setColor(ACCENT_DARK2);
      doc.text(`· ${prop.phase2_note}`, pc[0] + 16, noteY);
    }

    if (i !== 0 && pc[3]) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setColor(MUTED);
      const nl = doc.splitTextToSize(pc[3], contentW / 3 - 32) as string[];
      doc.text(nl, pc[0] + 16, valY2 + 18);
    }
  });
  y += p2cardH + 10;

  if (
    p2HasDiscount ||
    (prop.phase2_note && prop.phase2_note.trim())
  ) {
    const commitmentN = parseInt(
      String(prop.phase2_commitment ?? "").replace(/[^0-9]/g, ""),
      10,
    );
    const introMonths =
      isNaN(commitmentN) || commitmentN <= 0 ? 3 : commitmentN;
    const introText = `Introductory rate for the first ${introMonths} months. At month ${introMonths + 1} we review performance together and align on the right rate and commitment going forward.`;
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setColor(MUTED);
    const il = doc.splitTextToSize(introText, contentW) as string[];
    il.forEach((line) => {
      doc.text(line, margin, y);
      y += 12;
    });
    y += 6;
  }

  if (prop.notes && prop.notes.trim()) {
    y += 10;
    label("NOTES", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(MUTED);
    const noteLines = doc.splitTextToSize(
      prop.notes.trim(),
      contentW,
    ) as string[];
    doc.text(noteLines, margin, y);
    y += noteLines.length * 12 + 6;
  }

    const p2ScopeIn = DEFAULT_P2_SCOPE_IN;
    const p2ScopeOut = DEFAULT_P2_SCOPE_OUT;
    label("SCOPE OF WORK", margin, y);
    y += 14;
    y = scopeSection(p2ScopeIn, p2ScopeOut, y);
  }

  // ── PAGE 5: PARTNERSHIP ─────────────────────────────────────────
  doc.addPage();
  y = 80;
  y = sectionHeader(
    "The Partnership",
    "We don't hand things over. We stay in it.",
    y,
  );
  y = bodyText(
    "Phase 1 builds the foundation. Phase 2 is where we take ownership of growth — continuously testing, optimizing, and compounding results across every channel. We're here for as long as it's working. No lock-ins, no pressure — just a team that stays accountable to your numbers.",
    margin,
    y,
    contentW,
  );
  y += 20;

  const colW2 = contentW / 2 - 4;
  const p1list: P1Tile[] = !hasPhase1
    ? [
        {
          title: "No setup phase",
          description:
            "Engagement begins directly with the ongoing retainer below.",
        },
      ]
    : itemsToTiles(p1Items);
  const p2list: [string, string][] = DEFAULT_P2_ITEMS;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const p1Body = p1list.reduce((sum, item) => {
    let lines = 0;
    if (item.bullets && item.bullets.length > 0) {
      lines = item.bullets.length;
    } else if (item.description) {
      lines = (
        doc.splitTextToSize(item.description, colW2 - 28) as string[]
      ).length;
    }
    return sum + 13 + lines * 10 + 8;
  }, 0);
  const p2Body = p2list.reduce((sum, item) => {
    const lines = (doc.splitTextToSize(item[1], colW2 - 28) as string[]).length;
    return sum + 13 + lines * 10 + 8;
  }, 0);
  const colH = 52 + Math.max(p1Body, p2Body) + 20;

  setFill(CREAM);
  setStroke(BORDER);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, colW2, colH, "FD");
  setFill(BORDER);
  doc.rect(margin, y, colW2, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setColor(INK);
  doc.text("Phase 1", margin + 14, y + 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setColor(MUTED);
  doc.text("What we build together", margin + 14, y + 34);
  let iy = y + 52;
  p1list.forEach((item) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setColor(INK);
    doc.text(item.title, margin + 14, iy);
    iy += 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setColor(MUTED);
    if (item.bullets && item.bullets.length > 0) {
      item.bullets.forEach((b) => {
        doc.text(`· ${b}`, margin + 14, iy);
        iy += 10;
      });
    } else if (item.description) {
      const ls = doc.splitTextToSize(item.description, colW2 - 28) as string[];
      ls.forEach((line) => {
        doc.text(line, margin + 14, iy);
        iy += 10;
      });
    }
    iy += 8;
  });

  const rx = margin + colW2 + 8;
  setFill(INK);
  doc.rect(rx, y, colW2, colH, "F");
  setFill(ACCENT);
  doc.rect(rx, y, colW2, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setColor(PAPER);
  doc.text("Ongoing", rx + 14, y + 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setColor([120, 120, 120]);
  doc.text("How we drive growth", rx + 14, y + 34);
  iy = y + 52;
  p2list.forEach((item) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setColor(PAPER);
    doc.text(item[0], rx + 14, iy);
    iy += 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setColor([160, 160, 160]);
    const ls = doc.splitTextToSize(item[1], colW2 - 28) as string[];
    ls.forEach((line) => {
      doc.text(line, rx + 14, iy);
      iy += 10;
    });
    iy += 8;
  });
  y += colH + 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(INK);
  const closing = `${clientName} has real potential in this channel — the product is strong and the timing is right. We'd love to be the team that helps build it properly.`;
  const closingLines = doc.splitTextToSize(closing, contentW) as string[];
  doc.text(closingLines, margin, y);
  y += closingLines.length * 16 + 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setColor(MUTED);
  doc.text("Let's talk — happy to walk through everything on a call.", margin, y);

  // Page chrome (2..N)
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
    doc.text(`Confidential — Prepared by ${brand}`, margin, H - 24);
    doc.text(`Page ${pg}`, W - margin, H - 24, { align: "right" });
  }

  const filename = `Attomik_Proposal_${clientName.replace(/\s+/g, "_")}_${now.getFullYear()}.pdf`;
  doc.save(filename);
}
