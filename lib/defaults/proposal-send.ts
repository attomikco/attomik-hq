// Cover email for sending a proposal PDF via Resend. Editable in the send
// modal before it goes out. Voice: concise, warm, direct. No dash characters
// anywhere, no AI-sounding phrasing.

function firstName(full: string | null | undefined): string {
  const t = (full ?? "").trim();
  if (!t) return "";
  return t.split(/\s+/)[0];
}

export function buildProposalSendEmail(opts: {
  clientName?: string | null;
  company?: string | null;
}): { subject: string; body: string } {
  const first = firstName(opts.clientName);
  const greeting = first ? `Hi ${first},` : "Hi,";
  const company = (opts.company ?? "").trim();

  const subject = company
    ? `Proposal for ${company}`
    : "Your Attomik proposal";

  const body = `${greeting}

Thanks for the conversation. I have attached our proposal for your review.

It lays out the work in two phases. Phase 1 is the build and Phase 2 is the ongoing partnership, and you only commit to Phase 1 to start. The pricing, timeline, and scope are all in the document.

Have a read and tell me what you think. Happy to get on a call to walk through any of it.

Thanks,
Pablo`;

  return { subject, body };
}
