import { createClient } from "@/lib/supabase/server";
import {
  currency,
  dateShort,
  invoiceTotal,
  type LineItem,
} from "@/lib/format";
import type { Client } from "@/lib/types";
import MRRChart from "./mrr-chart";
import YearSelector from "./year-selector";

const YEAR_OPTIONS = [2024, 2025, 2026];

type Invoice = {
  id: string;
  number: string | null;
  date: string | null;
  due: string | null;
  status: string | null;
  client_name: string | null;
  client_email: string | null;
  items: LineItem[] | null;
  discount: number | null;
};

type Settings = {
  currency?: string;
};

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function invoiceNumberInt(n: string | null): number {
  if (!n) return 0;
  const m = /\d+/.exec(n);
  return m ? parseInt(m[0], 10) : 0;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { year?: string };
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const parsed = parseInt(searchParams?.year ?? "", 10);
  const selectedYear = YEAR_OPTIONS.includes(parsed) ? parsed : currentYear;

  const supabase = createClient();

  const [{ data: invData }, { data: stgData }, { data: clientsData }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, number, date, due, status, client_name, client_email, items, discount",
        )
        .order("date", { ascending: false })
        .limit(500),
      supabase.from("settings").select("key, value"),
      supabase
        .from("clients")
        .select("*")
        .order("monthly_value", { ascending: false }),
    ]);

  const invoices: Invoice[] = (invData as Invoice[] | null) ?? [];
  const clients: Client[] = (clientsData as Client[] | null) ?? [];
  const activeClients = clients.filter(
    (c) => (c.status ?? "active") === "active",
  );
  const pausedClients = clients.filter((c) => c.status === "paused");
  const activeMonthlyTotal = activeClients.reduce(
    (s, c) => s + Number(c.monthly_value ?? 0),
    0,
  );
  const pausedMonthlyTotal = pausedClients.reduce(
    (s, c) => s + Number(c.monthly_value ?? 0),
    0,
  );

  const settings: Settings = {};
  for (const row of (stgData as { key: string; value: string }[] | null) ??
    []) {
    (settings as Record<string, string>)[row.key] = row.value;
  }
  const currencyCode = settings.currency || "USD";

  const yearInvoices = invoices.filter((i) => {
    const d = parseDate(i.date);
    return d && d.getFullYear() === selectedYear;
  });

  const paidInv = yearInvoices.filter((i) => i.status === "paid");
  const outstandingInv = yearInvoices.filter(
    (i) => i.status === "sent" || i.status === "overdue",
  );
  const draftInv = yearInvoices.filter((i) => i.status === "draft");

  const total = (list: Invoice[]) =>
    list.reduce((s, i) => s + invoiceTotal(i.items, i.discount), 0);

  const statInvoiced = total([...paidInv, ...outstandingInv]);
  const statPaid = total(paidInv);
  const statOutstanding = total(outstandingInv);
  const statPipeline = total(draftInv);

  // ── Previous-year paid invoices (for YoY chart overlay) ────────────
  const prevYear = selectedYear - 1;
  const prevYearPaid = invoices.filter((i) => {
    if (i.status !== "paid") return false;
    const d = parseDate(i.date);
    return !!d && d.getFullYear() === prevYear;
  });

  // ── MRR by month — Jan–Dec of selected year, paid + draft stacked ─
  const paidByMonth = new Map<string, number>();
  const draftByMonth = new Map<string, number>();
  const prevByMonthIdx = new Array<number>(12).fill(0);
  for (let m = 0; m < 12; m++) {
    const key = `${selectedYear}-${String(m + 1).padStart(2, "0")}`;
    paidByMonth.set(key, 0);
    draftByMonth.set(key, 0);
  }
  for (const inv of yearInvoices) {
    const d = parseDate(inv.date);
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const amt = invoiceTotal(inv.items, inv.discount);
    if (inv.status === "draft") {
      if (draftByMonth.has(key))
        draftByMonth.set(key, (draftByMonth.get(key) ?? 0) + amt);
    } else {
      if (paidByMonth.has(key))
        paidByMonth.set(key, (paidByMonth.get(key) ?? 0) + amt);
    }
  }
  for (const inv of prevYearPaid) {
    const d = parseDate(inv.date);
    if (!d) continue;
    prevByMonthIdx[d.getMonth()] += invoiceTotal(inv.items, inv.discount);
  }
  const mrrData = Array.from(paidByMonth.keys()).map((month, idx) => ({
    month,
    paid: paidByMonth.get(month) ?? 0,
    draft: draftByMonth.get(month) ?? 0,
    prev: prevByMonthIdx[idx] ?? 0,
  }));
  const activeMonths = mrrData.filter((d) => d.paid + d.draft > 0);
  const mrrAvg =
    activeMonths.length > 0
      ? activeMonths.reduce((s, d) => s + d.paid + d.draft, 0) /
        activeMonths.length
      : 0;
  const prevActiveMonths = mrrData.filter((d) => d.prev > 0);
  const prevAvg =
    prevActiveMonths.length > 0
      ? prevActiveMonths.reduce((s, d) => s + d.prev, 0) /
        prevActiveMonths.length
      : 0;

  // ── Aging ─────────────────────────────────────────────────────────
  type Bucket = { key: string; label: string; amount: number; count: number };
  const buckets: Bucket[] = [
    { key: "current", label: "Current", amount: 0, count: 0 },
    { key: "d30", label: "1–30 days", amount: 0, count: 0 },
    { key: "d60", label: "31–60 days", amount: 0, count: 0 },
    { key: "d90", label: "60+ days", amount: 0, count: 0 },
  ];
  for (const inv of outstandingInv) {
    const due = parseDate(inv.due);
    if (!due) continue;
    const days = Math.floor((now.getTime() - due.getTime()) / 86_400_000);
    const amt = invoiceTotal(inv.items, inv.discount);
    const b =
      days <= 0 ? buckets[0] : days <= 30 ? buckets[1] : days <= 60 ? buckets[2] : buckets[3];
    b.amount += amt;
    b.count += 1;
  }
  const agingTotal = buckets.reduce((s, b) => s + b.amount, 0);

  // ── Revenue by client (non-draft, this year) ──────────────────────
  const clientTotals = new Map<string, number>();
  for (const inv of yearInvoices) {
    if (inv.status === "draft") continue;
    const name = inv.client_name || "Unknown";
    clientTotals.set(
      name,
      (clientTotals.get(name) ?? 0) + invoiceTotal(inv.items, inv.discount),
    );
  }
  const topClients = Array.from(clientTotals, ([name, value]) => ({
    name,
    value,
  }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // ── Revenue by service line item (non-draft, this year) ───────────
  const serviceTotals = new Map<string, number>();
  for (const inv of yearInvoices) {
    if (inv.status === "draft") continue;
    for (const it of inv.items ?? []) {
      let name = String(it.title ?? it.description ?? "Other");
      if (name.length > 30) name = `${name.slice(0, 30)}…`;
      const qty = Number(it.qty ?? it.quantity ?? 1) || 0;
      const rate = Number(it.rate ?? it.price ?? 0) || 0;
      serviceTotals.set(name, (serviceTotals.get(name) ?? 0) + qty * rate);
    }
  }
  const topServices = Array.from(serviceTotals, ([name, value]) => ({
    name,
    value,
  }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // ── Draft pipeline (drafts dated within selected year) ───────────
  const drafts = yearInvoices
    .filter((i) => i.status === "draft")
    .sort((a, b) => invoiceNumberInt(b.number) - invoiceNumberInt(a.number));

  // ── Open invoices (sent or overdue), sorted by due date asc ──────
  const openInvoices = [...outstandingInv].sort((a, b) => {
    const da = parseDate(a.due)?.getTime() ?? Infinity;
    const db = parseDate(b.due)?.getTime() ?? Infinity;
    return da - db;
  });

  // ── Recent: last 10 invoices in selected year by date ────────────
  const recent = [...yearInvoices]
    .sort((a, b) => {
      const da = parseDate(a.date)?.getTime() ?? 0;
      const db = parseDate(b.date)?.getTime() ?? 0;
      return db - da;
    })
    .slice(0, 10);

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <div
            className="mono"
            style={{
              marginTop: "var(--sp-2)",
              color: "var(--muted)",
              fontSize: "var(--text-sm)",
            }}
          >
            {now.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
        <YearSelector years={YEAR_OPTIONS} selected={selectedYear} />
      </header>

      <section className="grid-4">
        <Kpi
          label="Invoiced"
          value={currency(statInvoiced, currencyCode)}
          hint={`${paidInv.length + outstandingInv.length} invoices · ${selectedYear}`}
          accent
        />
        <Kpi
          label="Paid"
          value={currency(statPaid, currencyCode)}
          hint={`${paidInv.length} paid`}
        />
        <Kpi
          label="Outstanding"
          value={currency(statOutstanding, currencyCode)}
          hint={`${outstandingInv.length} unpaid`}
        />
        <Kpi
          label="Pipeline"
          value={currency(statPipeline, currencyCode)}
          hint={`${draftInv.length} drafts`}
        />
      </section>

      <div className="section-header">
        <div className="section-header-bar" />
        <div className="section-header-title">Revenue intelligence</div>
        <div className="section-header-line" />
      </div>

      <section className="grid-2">
        <DashboardCard
          eyebrow="Revenue"
          title={`Monthly Revenue · ${selectedYear} vs ${prevYear}`}
        >
          <MRRChart
            data={mrrData}
            prevYear={prevYear}
            currentYear={selectedYear}
            avg={mrrAvg}
            prevAvg={prevAvg}
          />
        </DashboardCard>

        <DashboardCard
          eyebrow="Outstanding"
          title="Aging"
        >
          <div className="flex-col" style={{ gap: "var(--sp-3)" }}>
            {buckets.map((b, i) => (
              <AgingRow
                key={b.key}
                label={b.label}
                amount={b.amount}
                count={b.count}
                pct={agingTotal > 0 ? (b.amount / agingTotal) * 100 : 0}
                severity={i}
                currencyCode={currencyCode}
              />
            ))}
          </div>
        </DashboardCard>

        <DashboardCard
          eyebrow="Ranked"
          title="Revenue by client"
        >
          <RankedBarList
            rows={topClients}
            color="var(--accent)"
            currencyCode={currencyCode}
            empty="No revenue yet this year"
          />
        </DashboardCard>

        <DashboardCard
          eyebrow="Ranked"
          title="Revenue by service"
        >
          <RankedBarList
            rows={topServices}
            color="var(--ink)"
            currencyCode={currencyCode}
            empty="No revenue yet this year"
          />
        </DashboardCard>
      </section>

      <div className="section-header">
        <div className="section-header-bar" />
        <div className="section-header-title">Client health</div>
        <div className="section-header-line" />
      </div>

      <ClientGroup
        label="Active"
        clients={activeClients}
        totalMonthly={activeMonthlyTotal}
        currencyCode={currencyCode}
        emptyText="No active clients."
      />
      <ClientGroup
        label="Paused"
        clients={pausedClients}
        totalMonthly={pausedMonthlyTotal}
        currencyCode={currencyCode}
        emptyText="No paused clients."
      />

      <div className="section-header">
        <div className="section-header-bar" />
        <div className="section-header-title">Pipeline · drafts</div>
        <div className="section-header-line" />
      </div>

      <section className="card">
        {drafts.length === 0 ? (
          <div className="caption mono">
            No drafts in the pipeline. New invoices appear here until sent.
          </div>
        ) : (
          <ul style={{ listStyle: "none" }}>
            {drafts.map((inv, i) => (
              <li
                key={inv.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--sp-3)",
                  padding: "var(--sp-3) 0",
                  borderBottom:
                    i < drafts.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--sp-3)",
                    flexWrap: "wrap",
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--muted)",
                    }}
                  >
                    {inv.number ?? "—"}
                  </span>
                  <span
                    style={{
                      fontWeight: "var(--fw-semibold)",
                      fontSize: "var(--text-base)",
                    }}
                  >
                    {inv.client_name ?? "—"}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--muted)",
                    }}
                  >
                    Due {dateShort(inv.due)}
                  </span>
                </div>
                <span
                  className="mono"
                  style={{
                    fontWeight: "var(--fw-bold)",
                    color: "var(--brand-green)",
                    flexShrink: 0,
                  }}
                >
                  {currency(
                    invoiceTotal(inv.items, inv.discount),
                    currencyCode,
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="section-header">
        <div className="section-header-bar" />
        <div className="section-header-title">Open invoices · awaiting payment</div>
        <div className="section-header-line" />
      </div>

      <div className="table-wrapper" style={{ marginBottom: "var(--sp-6)" }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Client</th>
                <th>Date</th>
                <th>Due</th>
                <th className="td-right">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {openInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="td-muted">
                    No open invoices — everything&rsquo;s paid or still in draft.
                  </td>
                </tr>
              ) : (
                openInvoices.map((inv) => {
                  const due = parseDate(inv.due);
                  const days = due
                    ? Math.floor((now.getTime() - due.getTime()) / 86_400_000)
                    : null;
                  const overdue = days !== null && days > 0;
                  return (
                    <tr key={inv.id}>
                      <td className="td-mono td-strong">{inv.number ?? "—"}</td>
                      <td>{inv.client_name ?? "—"}</td>
                      <td className="td-muted">{dateShort(inv.date)}</td>
                      <td
                        className="td-muted"
                        style={
                          overdue
                            ? { color: "var(--danger)", fontWeight: "var(--fw-semibold)" }
                            : undefined
                        }
                      >
                        {dateShort(inv.due)}
                        {days !== null && (
                          <span
                            className="mono"
                            style={{
                              marginLeft: "var(--sp-2)",
                              fontSize: "var(--fs-11)",
                              color: overdue ? "var(--danger)" : "var(--subtle)",
                            }}
                          >
                            {overdue
                              ? `${days}d overdue`
                              : days === 0
                                ? "due today"
                                : `in ${-days}d`}
                          </span>
                        )}
                      </td>
                      <td className="td-right td-mono">
                        {currency(
                          invoiceTotal(inv.items, inv.discount),
                          currencyCode,
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge status-${inv.status ?? "sent"}`}
                        >
                          {inv.status ?? "sent"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-header">
        <div className="section-header-bar" />
        <div className="section-header-title">Recent invoices</div>
        <div className="section-header-line" />
      </div>

      <div className="table-wrapper">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Client</th>
                <th>Date</th>
                <th className="td-right">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="td-muted">
                    No invoices yet.
                  </td>
                </tr>
              ) : (
                recent.map((inv) => (
                  <tr key={inv.id}>
                    <td className="td-mono td-strong">{inv.number ?? "—"}</td>
                    <td>{inv.client_name ?? "—"}</td>
                    <td className="td-muted">{dateShort(inv.date)}</td>
                    <td className="td-right td-mono">
                      {currency(
                        invoiceTotal(inv.items, inv.discount),
                        currencyCode,
                      )}
                    </td>
                    <td>
                      <span className={`badge status-${inv.status ?? "draft"}`}>
                        {inv.status ?? "draft"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── presentational helpers ──────────────────────────────────────────

const GROWTH_LABEL: Record<string, string> = {
  launch: "Launch",
  scale: "Scale",
  optimize: "Optimize",
};

function ClientGroup({
  label,
  clients,
  totalMonthly,
  currencyCode,
  emptyText,
}: {
  label: string;
  clients: Client[];
  totalMonthly: number;
  currencyCode: string;
  emptyText: string;
}) {
  return (
    <div style={{ marginBottom: "var(--sp-5)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-2)",
          marginBottom: "var(--sp-2)",
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: "var(--fs-11)",
            letterSpacing: "var(--ls-wide)",
            textTransform: "uppercase",
            color: "var(--muted)",
            fontWeight: "var(--fw-semibold)",
          }}
        >
          {label}
        </span>
        <span
          className="badge badge-gray mono"
          style={{ fontSize: "var(--fs-11)" }}
        >
          {clients.length}
        </span>
        {totalMonthly > 0 && (
          <span
            className="mono"
            style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}
          >
            · {currency(totalMonthly, currencyCode)} / mo
          </span>
        )}
      </div>
      {clients.length === 0 ? (
        <div
          className="card"
          style={{ padding: "var(--sp-4)", background: "var(--gray-150)" }}
        >
          <div className="caption mono">{emptyText}</div>
        </div>
      ) : (
        <div className="table-wrapper table-compact">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th className="td-right">Monthly</th>
                  <th>Growth stage</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const stageKey = (c.growth_stage ?? "").toLowerCase();
                  return (
                    <tr key={c.id}>
                      <td className="td-strong">{c.name ?? "—"}</td>
                      <td className="td-right td-mono">
                        {Number(c.monthly_value ?? 0) > 0
                          ? currency(
                              Number(c.monthly_value ?? 0),
                              currencyCode,
                            )
                          : "—"}
                      </td>
                      <td>
                        {stageKey ? (
                          <span className="badge badge-gray">
                            {GROWTH_LABEL[stageKey] ?? stageKey}
                          </span>
                        ) : (
                          <span className="td-muted">—</span>
                        )}
                      </td>
                      <td
                        className="td-muted truncate"
                        style={{ maxWidth: 320 }}
                      >
                        {c.notes?.split("\n")[0] ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`kpi-card${accent ? " accent" : ""}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-sub">{hint}</div>}
    </div>
  );
}

function DashboardCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div style={{ marginBottom: "var(--sp-5)" }}>
        <div className="label mono">{eyebrow}</div>
        <h2 style={{ marginTop: "var(--sp-1)" }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function AgingRow({
  label,
  amount,
  count,
  pct,
  severity,
  currencyCode,
}: {
  label: string;
  amount: number;
  count: number;
  pct: number;
  severity: number;
  currencyCode: string;
}) {
  // 0 = current (accent), 1..3 = danger w/ increasing opacity
  const barColor = severity === 0 ? "var(--accent)" : "var(--danger)";
  const barOpacity = severity === 0 ? 1 : severity === 1 ? 0.25 : severity === 2 ? 0.55 : 1;
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "var(--sp-1)",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: "var(--fw-semibold)",
          }}
        >
          {label}
        </span>
        <span
          className="mono"
          style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}
        >
          {currency(amount, currencyCode)}
          {count > 0 ? ` · ${count}` : ""}
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: "var(--cream)",
          borderRadius: "var(--r-xs)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.max(0, Math.min(100, pct))}%`,
            background: barColor,
            opacity: barOpacity,
            borderRadius: "var(--r-xs)",
            transition: "width var(--t-normal)",
          }}
        />
      </div>
    </div>
  );
}

function RankedBarList({
  rows,
  color,
  currencyCode,
  empty,
}: {
  rows: { name: string; value: number }[];
  color: string;
  currencyCode: string;
  empty: string;
}) {
  const max = rows[0]?.value ?? 0;
  if (rows.length === 0) {
    return <div className="caption mono">{empty}</div>;
  }
  return (
    <div className="flex-col" style={{ gap: "var(--sp-3)" }}>
      {rows.map((r) => {
        const pct = max > 0 ? (r.value / max) * 100 : 0;
        return (
          <div key={r.name}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "var(--sp-1)",
                gap: "var(--sp-2)",
              }}
            >
              <span
                className="truncate"
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--fw-semibold)",
                  maxWidth: "60%",
                }}
                title={r.name}
              >
                {r.name}
              </span>
              <span
                className="mono"
                style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}
              >
                {currency(r.value, currencyCode)}
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: "var(--cream)",
                borderRadius: "var(--r-xs)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(0, Math.min(100, pct))}%`,
                  background: color,
                  borderRadius: "var(--r-xs)",
                  transition: "width var(--t-normal)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

