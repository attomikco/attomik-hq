// NOTE: Medium-weight starting terms. Have attorney review before production use.
// Merge fields: {client_company}, {phase2_commitment}, {governing_law}, {legal_entity}

export const DEFAULT_LEGAL_TERMS = `1. SCOPE OF SERVICES

{legal_entity} ("Attomik") agrees to provide the services described in the Scope & Deliverables section of this Agreement to {client_company} ("Client"). Any work outside this defined scope will be quoted separately and require written approval before commencement.

2. STANDARD OF CARE & NO GUARANTEES

Attomik will perform all services in a professional and workmanlike manner, using reasonable skill and care consistent with industry standards. Because outcomes depend on many factors outside Attomik's control — including market conditions, product quality, pricing, third-party platforms, and Client decisions — Attomik does not guarantee any specific business outcome, including but not limited to revenue, traffic, conversion rates, leads, customer acquisition, return on ad spend, or search ranking. Past performance of other engagements is not a prediction of future results.

3. FEES & PAYMENT

Client agrees to pay all fees as set forth in the Commercial Terms section. Phase 1 fees are payable according to the stated payment schedule. Phase 2 monthly fees are invoiced on the first business day of each month and payable net 15 days from invoice date. Overdue amounts accrue a late fee of 1.5% per month or the maximum permitted by law, whichever is lower. If any amount is more than ten (10) days overdue, Attomik may, on written notice, suspend performance of all or part of the services until overdue amounts (including accrued late fees) are paid in full, and project timelines will be adjusted accordingly. All fees are exclusive of applicable taxes.

4. TERM & TERMINATION

Phase 1 concludes upon delivery of the stated deliverables. Phase 2 begins on the agreed start date and runs month-to-month with no commitment period. Either party may terminate Phase 2 at any time with thirty (30) days written notice. The rate set forth in the Commercial Terms reflects an introductory rate for the first {phase2_commitment} months; at month {phase2_commitment_next}, the parties will review performance together and align on the rate and terms going forward. Either party may terminate immediately for material breach if such breach remains uncured for fifteen (15) days after written notice. Upon termination, Client shall pay for all services rendered through the termination date.

5. INTELLECTUAL PROPERTY

Upon full payment of applicable fees, Client owns all final deliverables created specifically for Client under this Agreement, including website builds, creative assets, and strategic documents. Attomik retains ownership of its pre-existing materials and any proprietary tools, workflows, automations, and methodologies used to produce the deliverables. Attomik grants Client a perpetual, non-exclusive license to use any such retained materials that are incorporated into final deliverables. Attomik may reference the engagement in its portfolio and marketing materials unless Client requests otherwise in writing.

6. CONFIDENTIALITY

Each party agrees to keep confidential any non-public information disclosed by the other party and to use such information solely for purposes of performing this Agreement. This obligation survives termination for a period of two (2) years. Information that is publicly available, independently developed, or required to be disclosed by law is excluded from this obligation.

7. LIMITATION OF LIABILITY

Attomik's total liability under this Agreement shall not exceed the total fees actually paid by Client to Attomik under this Agreement. Neither party shall be liable for indirect, incidental, consequential, or punitive damages, including lost profits, even if advised of the possibility of such damages.

8. INDEPENDENT CONTRACTOR

Attomik performs services as an independent contractor. Nothing in this Agreement creates an employment, partnership, joint venture, or agency relationship between the parties. Each party is responsible for its own taxes, benefits, and compliance obligations.

9. CLIENT RESPONSIBILITIES & DEPENDENCIES

Client agrees to provide the materials, access, approvals, and information listed in the Kickoff Requirements section in a timely manner. Project timelines and delivery dates are contingent on timely Client feedback, approvals, and access to required accounts, systems, and assets. Delays in providing required materials or responses may extend timelines and do not relieve Client of payment obligations. Attomik is not responsible for delays, failures, or interruptions caused by Client, Client's personnel or vendors, or third-party platforms (including but not limited to Shopify, Meta, Google, TikTok, Amazon, email service providers, and payment processors). Client is responsible for the accuracy of brand guidelines, product information, pricing, inventory data, and other content it provides.

10. GOVERNING LAW & DISPUTES

This Agreement is governed by the laws of the {governing_law}, without regard to conflict of law principles. The parties agree to attempt in good faith to resolve any disputes through direct discussion before pursuing formal legal action.

11. ENTIRE AGREEMENT

This Agreement, together with any referenced exhibits or statements of work, constitutes the entire agreement between the parties and supersedes all prior discussions and proposals. Modifications must be in writing and signed by both parties. If any provision is found unenforceable, the remaining provisions remain in full effect.`;

export function renderTerms(
  template: string,
  vars: {
    client_company?: string | null;
    phase2_commitment?: number | null;
    governing_law?: string | null;
    legal_entity?: string | null;
  },
): string {
  const commitment = Number(vars.phase2_commitment) || 3;
  return template
    .replace(/\{client_company\}/g, vars.client_company || "Client")
    .replace(/\{phase2_commitment\}/g, String(commitment))
    .replace(/\{phase2_commitment_next\}/g, String(commitment + 1))
    .replace(
      /\{governing_law\}/g,
      vars.governing_law || "State of Delaware, United States",
    )
    .replace(/\{legal_entity\}/g, vars.legal_entity || "Attomik, LLC");
}
