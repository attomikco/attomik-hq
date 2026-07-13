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
}): { subject: string; body: string; cc: string } {
  const first = firstName(opts.clientName);
  const greeting = first ? `Hey ${first},` : "Hey,";

  const cc = "accounts@attomik.co";
  const subject =
    "Details to get your agreement, first invoice, and kickoff ready";

  const body = `${greeting}

Great news on moving forward. To get the agreement, first invoice, and kickoff prepared, I need a few details from your side:

1. Legal entity name (LLC, Inc., etc.)
2. Registered business address
3. Who signs the agreement (name and title)
4. Billing contact email

If your accounting team needs anything specific on invoices, like an EIN on the document or a PO process, tell me now and we will set it up from the first one.

Once I have this, you will get the agreement to sign and the first invoice, and I will send over the kickoff items we need from your side to get started.

I have copied accounts@attomik.co, our accounts address for anything billing or agreement related.

Best,
Pablo`;

  return { subject, body, cc };
}
