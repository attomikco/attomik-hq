// Cover email for the one-shot deal package: agreement + accepted proposal +
// first (deposit) invoice sent together via Resend. Editable in the send modal
// before it goes out. Voice: concise, warm, direct. No dash characters
// anywhere, no AI-sounding phrasing.

function firstName(full: string | null | undefined): string {
  const t = (full ?? "").trim();
  if (!t) return "";
  return t.split(/\s+/)[0];
}

export function buildPackageSendEmail(opts: {
  clientName?: string | null;
  company?: string | null;
  depositFormatted?: string | null;
}): { subject: string; body: string } {
  const first = firstName(opts.clientName);
  const greeting = first ? `Hi ${first},` : "Hi,";
  const company = (opts.company ?? "").trim();
  const deposit = (opts.depositFormatted ?? "").trim();

  const subject = company
    ? `Your Attomik agreement and first invoice for ${company}`
    : "Your Attomik agreement and first invoice";

  // Acceptance: review and return the agreement signed. The deposit sentence
  // only appears when we have an amount; the kickoff sentence always stands.
  const depositSentence = deposit
    ? ` The first invoice covers the deposit of ${deposit}.`
    : "";

  const body = `${greeting}

Great to have you on board. Everything you need to get started is attached.

You will find three documents:

1. The services agreement, which is the contract for the work.
2. The proposal you accepted, attached for reference so the scope and pricing sit alongside the agreement.
3. The first invoice for the deposit.

Please review the agreement and return it signed.${depositSentence} In the meantime we are already getting things moving, and we will send you a separate email with the kickoff items so we can start planning everything together.

Any questions at all, just reply here and we will sort it out.

Best,
The Attomik Team`;

  return { subject, body };
}
