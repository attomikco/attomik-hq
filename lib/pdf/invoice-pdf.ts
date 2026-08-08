import { jsPDF } from "jspdf";
import { LOGO_BLACK_B64 } from "./logos";
import {
  currency,
  currencyLabeled,
  dateShort,
  formatServicePeriod,
  lineSubtotal,
  type LineItem,
} from "@/lib/format";
import { amountInWords } from "@/lib/number-to-words";
import { isMexicanClient, type InvoiceFiscalClient } from "@/lib/types";

type Invoice = {
  number: string | null;
  date: string | null;
  due: string | null;
  service_start_date?: string | null;
  service_end_date?: string | null;
  status: string | null;
  client_name: string | null;
  client_email: string | null;
  client_company: string | null;
  client_address: string | null;
  items: LineItem[] | null;
  discount: number | null;
  notes: string | null;
};

type Settings = {
  brand_name?: string;
  legal_name?: string;
  address?: string;
  email?: string;
  phone?: string;
  currency?: string;
  default_payment_terms?: string;
  payment_instructions?: string;
  issuer_ein?: string;
  place_of_issuance?: string;
};

type ServiceRef = {
  id?: string;
  name?: string | null;
  description?: string | null;
  desc?: string | null;
};

export function buildInvoiceDoc(
  inv: Invoice,
  settings: Settings = {},
  services: ServiceRef[] = [],
  client: InvoiceFiscalClient = null,
): { doc: jsPDF; filename: string } {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612;
  const H = 792;
  const margin = 54;
  const contentW = W - margin * 2;
  const code = settings.currency || "USD";

  // Country branch. Everything MX-specific below is guarded by this flag, and
  // the US path keeps its original expressions untouched, so a US invoice
  // renders byte-for-byte identically to before country support existed.
  const isMX = isMexicanClient(client);

  // MX invoices label every amount with its currency (USD 3,000.00) instead of
  // using the symbol ($3,000.00).
  const money = (n: number) =>
    isMX ? currencyLabeled(n, code) : currency(n, code);

  const INK: [number, number, number] = [0, 0, 0];
  const MUTED: [number, number, number] = [102, 102, 102];
  const SUBTLE: [number, number, number] = [153, 153, 153];
  const BORDER: [number, number, number] = [235, 235, 235];
  const ACCENT: [number, number, number] = [0, 255, 151];

  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setStroke = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
  const setColor = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);

  // Logo top-left (100pt wide to match original spacing)
  try {
    doc.addImage(LOGO_BLACK_B64, "PNG", margin, margin, 110, 110 * (909 / 3162));
  } catch {
    /* ignore if image fails */
  }

  // Invoice number badge — accent green pill, top-right
  const num = inv.number ?? "—";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const numW = doc.getTextWidth(num) + 20;
  const badgeX = W - margin - numW;
  const badgeY = margin;
  setFill(ACCENT);
  doc.roundedRect(badgeX, badgeY, numW, 22, 3, 3, "F");
  setColor(INK);
  doc.text(num, badgeX + 10, badgeY + 15);

  // Issued / Due dates under the badge
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor(MUTED);
  // metaY walks the header lines down. On US invoices it lands on exactly the
  // original offsets (38, 50, 62); on MX invoices the place of issuance takes
  // the first slot and pushes the rest down by one line.
  let metaY = badgeY + 38;
  if (isMX && settings.place_of_issuance) {
    doc.text(
      `Place of issuance: ${settings.place_of_issuance}`,
      W - margin,
      metaY,
      { align: "right" },
    );
    metaY += 12;
  }
  doc.text(`Issued: ${dateShort(inv.date)}`, W - margin, metaY, {
    align: "right",
  });
  metaY += 12;
  doc.text(`Due: ${dateShort(inv.due)}`, W - margin, metaY, {
    align: "right",
  });
  metaY += 12;
  // Service Period — only when a window is defined (font/color inherited from
  // the Issued/Due lines above: helvetica normal 8.5, MUTED).
  const servicePeriod = formatServicePeriod(
    inv.service_start_date,
    inv.service_end_date,
  );
  if (servicePeriod) {
    doc.text(`Service Period: ${servicePeriod}`, W - margin, metaY, {
      align: "right",
    });
  }

  // FROM / BILL TO sections
  let y = margin + 110;
  const colW = contentW / 2 - 16;

  const fromLines: string[] = [];
  const brand = settings.brand_name || "Attomik";
  const legal = settings.legal_name && settings.legal_name !== brand ? settings.legal_name : "";
  if (legal) fromLines.push(legal);
  if (settings.address) settings.address.split("\n").forEach((l) => fromLines.push(l));
  if (settings.email) fromLines.push(settings.email);
  // The issuer's US tax ID is what lets a Mexican client deduct the expense.
  if (isMX && settings.issuer_ein) {
    fromLines.push(`EIN (US Tax ID): ${settings.issuer_ein}`);
  }

  const billLines: string[] = [];
  // MX bills the legal entity that pays and deducts, which is often not the
  // relationship name on the invoice. Falls back to the invoice's client name.
  const billName = isMX
    ? client?.legal_name || inv.client_name || "—"
    : inv.client_name || "—";
  if (isMX) {
    if (client?.rfc) billLines.push(`RFC: ${client.rfc}`);
    const fiscalAddress = client?.fiscal_address || inv.client_address;
    if (fiscalAddress) fiscalAddress.split("\n").forEach((l) => billLines.push(l));
    if (client?.billing_contact) billLines.push(client.billing_contact);
  } else {
    if (inv.client_company) billLines.push(inv.client_company);
    if (inv.client_address) inv.client_address.split("\n").forEach((l) => billLines.push(l));
    if (inv.client_email) billLines.push(inv.client_email);
  }

  // Labels
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(MUTED);
  doc.text("FROM", margin, y, { charSpace: 1.2 });
  doc.text("BILL TO", margin + contentW / 2, y, { charSpace: 1.2 });
  y += 14;

  // Primary names
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setColor(INK);
  doc.text(brand, margin, y);
  // MX legal names ("Abastecedora de Productos Naturales, S.A. de C.V.") are
  // long enough to overrun the column, so they wrap. US names are left on the
  // original single-line call.
  const billNameLines = isMX ? doc.splitTextToSize(billName, colW) : null;
  if (billNameLines) {
    doc.text(billNameLines, margin + contentW / 2, y);
  } else {
    doc.text(billName, margin + contentW / 2, y);
  }
  y += 14 + (billNameLines ? (billNameLines.length - 1) * 14 : 0);

  // Detail bodies
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(MUTED);
  const fromWrapped: string[] = [];
  fromLines.forEach((l) => doc.splitTextToSize(l, colW).forEach((x: string) => fromWrapped.push(x)));
  const billWrapped: string[] = [];
  billLines.forEach((l) => doc.splitTextToSize(l, colW).forEach((x: string) => billWrapped.push(x)));
  const lineH = 12;
  fromWrapped.forEach((l, i) => doc.text(l, margin, y + i * lineH));
  billWrapped.forEach((l, i) => doc.text(l, margin + contentW / 2, y + i * lineH));
  y += Math.max(fromWrapped.length, billWrapped.length) * lineH + 20;

  // Service table header
  setStroke(INK);
  doc.setLineWidth(1.5);
  doc.line(margin, y, W - margin, y);
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(SUBTLE);
  const colTitleX = margin;
  const colQtyX = W - margin - contentW * 0.4;
  const colRateX = W - margin - contentW * 0.22;
  const colTotalX = W - margin;
  // MX adds a UNIT column between the service and the quantity, so the title
  // column has to give up some width. US keeps its original 0.55.
  const colUnitX = W - margin - contentW * 0.52;
  const titleW = isMX ? contentW * 0.4 : contentW * 0.55;
  doc.text("SERVICE", colTitleX, y, { charSpace: 1.2 });
  if (isMX) doc.text("UNIT", colUnitX, y, { align: "right", charSpace: 1.2 });
  doc.text("QTY", colQtyX, y, { align: "right", charSpace: 1.2 });
  doc.text("RATE", colRateX, y, { align: "right", charSpace: 1.2 });
  doc.text("TOTAL", colTotalX, y, { align: "right", charSpace: 1.2 });
  y += 10;

  const items = inv.items ?? [];
  items.forEach((it, idx) => {
    const qty = Number(it.qty ?? it.quantity ?? 1) || 0;
    const rate = Number(it.rate ?? it.price ?? 0) || 0;
    const total = qty * rate;
    const title = String(it.title ?? it.name ?? "").trim();
    const matchedSvc =
      (it.service_id &&
        services.find((s) => s.id === it.service_id)) ||
      services.find(
        (s) => (s.name ?? "").toLowerCase() === title.toLowerCase(),
      ) ||
      null;
    const desc = String(
      it.description ??
        it.desc ??
        matchedSvc?.description ??
        matchedSvc?.desc ??
        "",
    ).trim();
    const useDesc = desc && desc !== title;

    // Row top separator
    setStroke(BORDER);
    doc.setLineWidth(0.5);
    doc.line(margin, y, W - margin, y);
    y += 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setColor(INK);
    const titleLines = doc.splitTextToSize(title || "—", titleW);
    doc.text(titleLines, colTitleX, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setColor(INK);
    // Every line we bill is a service, so the unit of measure is constant.
    if (isMX) doc.text("Service", colUnitX, y, { align: "right" });
    doc.text(String(qty), colQtyX, y, { align: "right" });
    doc.text(money(rate), colRateX, y, { align: "right" });
    doc.text(money(total), colTotalX, y, { align: "right" });

    let rowY = y + titleLines.length * 12;
    if (useDesc) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setColor(SUBTLE);
      const descLines = doc.splitTextToSize(desc, titleW);
      doc.text(descLines, colTitleX, rowY + 2);
      rowY += descLines.length * 11 + 2;
    }
    y = rowY + 10;

    if (idx === items.length - 1) {
      setStroke(BORDER);
      doc.setLineWidth(0.5);
      doc.line(margin, y - 4, W - margin, y - 4);
    }
  });

  // Totals block, right-aligned
  const subtotal = lineSubtotal(items);
  const discPct = Number(inv.discount ?? 0) || 0;
  const discAmt = subtotal * (discPct / 100);
  const total = Math.max(0, subtotal - discAmt);

  y += 12;
  setStroke(INK);
  doc.setLineWidth(1.5);
  doc.line(margin, y, W - margin, y);
  y += 20;

  const totalsX = W - margin;
  const labelX = W - margin - 180;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(SUBTLE);
  doc.text("Subtotal", labelX, y);
  doc.text(money(subtotal), totalsX, y, { align: "right" });
  y += 14;
  doc.text(`Discount (${discPct}%)`, labelX, y);
  doc.text(
    discPct > 0 ? `- ${money(discAmt)}` : money(0),
    totalsX,
    y,
    { align: "right" },
  );
  y += 16;
  setStroke(INK);
  doc.setLineWidth(1.5);
  doc.line(labelX, y - 4, W - margin, y - 4);
  y += 14;

  doc.setFont("helvetica", "bold");
  // A currency-labeled total ("USD 3,000.00") is much wider at 22pt than the
  // symbol form, so on MX the label slides left until it clears the number.
  // Measuring only reads font state and emits nothing, so US is unaffected.
  const totalStr = money(total);
  const totalLabel = "TOTAL DUE";
  doc.setFontSize(22);
  const totalNumW = doc.getTextWidth(totalStr);
  doc.setFontSize(8);
  // getTextWidth ignores charSpace, so add it back for the tracked label.
  const totalLabelW =
    doc.getTextWidth(totalLabel) + totalLabel.length * 1.2;
  const totalDueX = isMX
    ? Math.min(labelX, totalsX - totalNumW - totalLabelW - 12)
    : labelX;
  setColor(MUTED);
  doc.text(totalLabel, totalDueX, y, { charSpace: 1.2 });
  doc.setFontSize(22);
  setColor(INK);
  doc.text(totalStr, totalsX, y + 6, { align: "right" });
  y += 36;

  // The total in words, required alongside the figures on a comprobante.
  if (isMX) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(MUTED);
    const wordsLines = doc.splitTextToSize(
      amountInWords(total, code),
      contentW * 0.62,
    );
    doc.text(wordsLines, totalsX, y, { align: "right" });
    y += wordsLines.length * 12 + 10;
  }

  // Footer sections — Payment Instructions, Payment Terms, Notes
  const sections: { title: string; body: string }[] = [];
  if (settings.payment_instructions)
    sections.push({ title: "PAYMENT INSTRUCTIONS", body: settings.payment_instructions });
  if (settings.default_payment_terms) {
    const dueText = inv.due ? dateShort(inv.due) : "receipt";
    const body = settings.default_payment_terms.replace(/\{due_date\}/g, dueText);
    sections.push({ title: "PAYMENT TERMS", body });
  }
  if (inv.notes) sections.push({ title: "NOTES", body: inv.notes });

  sections.forEach((sec) => {
    if (y > H - margin - 80) {
      doc.addPage();
      y = margin;
    }
    setStroke(BORDER);
    doc.setLineWidth(0.5);
    doc.line(margin, y, W - margin, y);
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setColor(MUTED);
    doc.text(sec.title, margin, y, { charSpace: 1.2 });
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor([51, 51, 51]);
    const bodyLines = doc.splitTextToSize(sec.body, contentW);
    doc.text(bodyLines, margin, y);
    y += bodyLines.length * 12 + 14;
  });

  const clientName = inv.client_name || inv.client_company || "";
  const mmYY = /^(\d{4})-(\d{2})-\d{2}$/.exec(inv.date ?? "");
  const mm = mmYY ? mmYY[2] : "";
  const yy = mmYY ? mmYY[1].slice(-2) : "";
  const stamp = mm && yy ? ` ${mm}-${yy}` : "";
  const safeClient = clientName.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  const filename = `${num}${safeClient ? ` - ${safeClient}` : ""}${stamp}.pdf`;
  return { doc, filename };
}

/**
 * Browser: build and trigger a local download. Pass the linked client to get
 * the country-aware layout; omitting it renders the standard US invoice.
 */
export function generateInvoicePDF(
  inv: Invoice,
  settings: Settings = {},
  services: ServiceRef[] = [],
  client: InvoiceFiscalClient = null,
): void {
  const { doc, filename } = buildInvoiceDoc(inv, settings, services, client);
  doc.save(filename);
}

/** Server (Node): build and return the PDF bytes for emailing/storage. */
export function renderInvoicePDF(
  inv: Invoice,
  settings: Settings = {},
  services: ServiceRef[] = [],
  client: InvoiceFiscalClient = null,
): { bytes: Buffer; filename: string } {
  const { doc, filename } = buildInvoiceDoc(inv, settings, services, client);
  const bytes = Buffer.from(doc.output("arraybuffer"));
  return { bytes, filename };
}
