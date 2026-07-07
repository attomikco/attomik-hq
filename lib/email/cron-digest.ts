import { currency } from "@/lib/format";
import type { CronRunSummary } from "@/lib/email/cron-send-ready";

/** Internal ops digest emailed to the team after each auto-send run. */
export function buildCronDigestEmail(s: CronRunSummary) {
  const code = s.currency;
  const tag = s.live ? "" : "[DRY RUN] ";
  const sentTotal = s.sent.reduce((n, x) => n + x.amount, 0);

  const verb = s.live ? "sent" : "would send";
  const subject = `${tag}Invoice auto-send — ${s.sent.length} ${verb}, ${s.skipped.length} skipped`;

  const esc = (t: string) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const sentRows = s.sent
    .map(
      (x) => `
        <tr>
          <td style="padding:6px 10px;border-top:1px solid #eee;font-family:monospace;">${esc(x.number ?? "—")}</td>
          <td style="padding:6px 10px;border-top:1px solid #eee;">${esc(x.client ?? "—")}</td>
          <td style="padding:6px 10px;border-top:1px solid #eee;text-align:right;">${esc(currency(x.amount, code))}</td>
          <td style="padding:6px 10px;border-top:1px solid #eee;color:#666;">${esc(x.to)}${x.cc.length ? ` +${x.cc.length} cc` : ""}</td>
        </tr>`,
    )
    .join("");

  const skippedRows = s.skipped
    .map(
      (x) => `
        <tr>
          <td style="padding:6px 10px;border-top:1px solid #eee;font-family:monospace;">${esc(x.number ?? "—")}</td>
          <td style="padding:6px 10px;border-top:1px solid #eee;">${esc(x.client ?? "—")}</td>
          <td style="padding:6px 10px;border-top:1px solid #eee;color:#b91c1c;">${esc(x.reason)}</td>
        </tr>`,
    )
    .join("");

  const section = (title: string, headers: string[], rows: string) =>
    rows
      ? `<h3 style="margin:22px 0 6px;font-size:14px;">${esc(title)}</h3>
         <table style="width:100%;border-collapse:collapse;font-size:13px;">
           <tr>${headers.map((h) => `<th style="text-align:left;padding:0 10px 4px;color:#888;font-weight:600;">${esc(h)}</th>`).join("")}</tr>
           ${rows}
         </table>`
      : "";

  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;max-width:680px;">
    <p style="font-size:14px;color:#444;">${s.live ? "Auto-send" : "Dry run"} for <strong>${esc(s.today)}</strong> (ET).
    ${s.live ? "Sent" : "Would send"} <strong>${s.sent.length}</strong> invoice(s) totalling <strong>${esc(currency(sentTotal, code))}</strong>.
    ${s.skipped.length ? `<span style="color:#b91c1c;">${s.skipped.length} skipped.</span>` : ""}</p>
    ${section(s.live ? "Sent" : "Would send", ["Invoice", "Client", "Amount", "To"], sentRows)}
    ${section("Skipped — need attention", ["Invoice", "Client", "Reason"], skippedRows)}
    ${s.live ? "" : `<p style="margin-top:22px;font-size:12px;color:#888;">This was a dry run — no emails were sent to clients and no statuses changed. Set INVOICE_CRON_LIVE=true to go live.</p>`}
  </div>`;

  const line = (label: string, items: string[]) =>
    items.length ? [`${label}:`, ...items, ""] : [];
  const text = [
    `${s.live ? "Auto-send" : "DRY RUN"} for ${s.today} (ET)`,
    `${s.live ? "Sent" : "Would send"} ${s.sent.length} invoice(s), total ${currency(sentTotal, code)}. Skipped ${s.skipped.length}.`,
    ``,
    ...line(
      s.live ? "Sent" : "Would send",
      s.sent.map((x) => `  ${x.number ?? "—"} · ${x.client ?? "—"} · ${currency(x.amount, code)} → ${x.to}`),
    ),
    ...line(
      "Skipped",
      s.skipped.map((x) => `  ${x.number ?? "—"} · ${x.client ?? "—"} · ${x.reason}`),
    ),
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return { subject, html, text };
}
