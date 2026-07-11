// Email Pablo sends once a proposal is accepted, asking the new client for the
// real legal-entity details we need before drafting the agreement and invoices.
// Kept here so the wording stays in one place and matches Pablo's voice.
// Client-facing copy: no dashes.

export const CLIENT_DETAILS_REQUEST_SUBJECT =
  "A few details to get {client_company} set up";

export const CLIENT_DETAILS_REQUEST_BODY = `Hi {client_name},

Great to have you on board. Before I put the agreement together I need a few details so everything lists your business correctly.

Could you send these over when you get a chance:

1. Legal business name, exactly as it should appear on the agreement and invoices
2. Registered business address
3. Signer name and title, whoever will sign the agreement
4. Billing contact name and email, where invoices should go
5. A shared ops email or Slack we can use day to day

Once I have these I'll send the agreement over for signature and we can get moving.

Thanks,
Pablo`;

// Fill the {placeholder} tokens with proposal values, keeping friendly
// fallbacks so a half-filled proposal never renders an empty greeting.
export function fillClientDetailsRequest(vars: {
  client_name?: string | null;
  client_company?: string | null;
  proposal_number?: string | null;
}): { subject: string; body: string } {
  const map: Record<string, string> = {
    client_name: (vars.client_name ?? "").trim() || "there",
    client_company: (vars.client_company ?? "").trim() || "your business",
    proposal_number: (vars.proposal_number ?? "").trim(),
  };
  const fill = (tpl: string) =>
    tpl.replace(/\{(\w+)\}/g, (_, k) => map[k] ?? `{${k}}`);
  return {
    subject: fill(CLIENT_DETAILS_REQUEST_SUBJECT),
    body: fill(CLIENT_DETAILS_REQUEST_BODY),
  };
}
