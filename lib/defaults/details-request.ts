// Post-acceptance "request details" email. Sent manually this session (a Copy
// button on the proposals page); programmatic send is Session 4. Kept here in
// lib/defaults so the wording lives in one place, same as the other templates.
//
// Voice: concise, direct, warm. No dash characters anywhere (the list is
// numbered on purpose so there are no dash bullets), no AI-sounding phrasing.

function firstName(full: string | null | undefined): string {
  const t = (full ?? "").trim();
  if (!t) return "";
  return t.split(/\s+/)[0];
}

export function buildDetailsRequestEmail(opts: {
  clientName?: string | null;
}): { subject: string; body: string } {
  const first = firstName(opts.clientName);
  const greeting = first ? `Hi ${first},` : "Hi,";

  const subject = "Details to prepare your agreement and first invoice";

  const body = `${greeting}

Thanks for accepting the proposal. To prepare the agreement and set up your first invoice, I need a few details from you:

1. Legal entity name, exactly as it should read on the contract
2. Registered business address
3. Name and title of the person who will sign
4. Billing contact email, where invoices should go
5. A shared operational email if you have one, like hello@yourbrand.com

If your accounting team needs anything specific on invoices, tell us now and we will set it up from the first one. That includes your EIN or tax ID if it needs to appear, and any PO number or invoicing process we should follow.

Send those over and I will have the agreement ready for signature.

Thanks,
Pablo`;

  return { subject, body };
}
