import { Resend } from "resend";
import { renderProposalPDF } from "@/lib/pdf/proposal-pdf";
import type { Proposal, SettingsMap } from "@/lib/types";

// Shared result shape for the proposal-page sends. Mirrors the invoice
// dispatch helper: never touches the DB, the API route owns bookkeeping.
export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Editable plain-text bodies are authored with real line breaks; give HTML
// clients the same layout without any extra styling.
function bodyToHtml(body: string): string {
  return escapeHtml(body).replace(/\n/g, "<br>");
}

/** Company-details request email (no attachment). Subject/body come from the
 *  editable modal fields, so they are passed in verbatim. */
export async function sendDetailsRequestEmail(params: {
  resend: Resend;
  from: string;
  to: string;
  cc?: string[];
  replyTo?: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  const { resend, from, to, cc, replyTo, subject, body } = params;
  const { data, error } = await resend.emails.send({
    from,
    to,
    cc,
    replyTo,
    subject,
    text: body,
    html: bodyToHtml(body),
  });
  if (error) {
    return { ok: false, error: error.message ?? "Failed to send email." };
  }
  return { ok: true, id: data?.id ?? null };
}

/** Proposal cover email with the proposal PDF attached. */
export async function sendProposalEmail(params: {
  resend: Resend;
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  body: string;
  proposal: Proposal;
  settings: SettingsMap;
}): Promise<SendResult> {
  const { resend, from, to, replyTo, subject, body, proposal, settings } =
    params;
  const { bytes, filename } = renderProposalPDF(proposal, settings);
  const { data, error } = await resend.emails.send({
    from,
    to,
    replyTo,
    subject,
    text: body,
    html: bodyToHtml(body),
    attachments: [{ filename, content: bytes }],
  });
  if (error) {
    return { ok: false, error: error.message ?? "Failed to send email." };
  }
  return { ok: true, id: data?.id ?? null };
}
