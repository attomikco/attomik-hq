// NOTE: Updated agreement terms — 17 clauses. Adds Communication & Working
// Cadence, Client Content/Claims/Indemnification, Offboarding & Transition,
// Force Majeure, Assignment, and Notices; rewrites Scope, Term & Termination,
// Limitation of Liability, and Client Responsibilities. Have attorney review
// before production use.
//
// Merge fields (preserved from prior version):
//   {client_company}, {governing_law}, {legal_entity}, {proposal_ref}
//
// {phase2_commitment} and {phase2_commitment_next} are no longer used in the
// body — clause 4 hardcodes "three (3)" and "month four (4)" per the updated
// wording. The renderTerms helper still substitutes them, so legacy stored
// terms (rows whose `terms` column was set before this update) keep
// rendering correctly.
//
// Paragraphs that begin with `**Label.**` render as inline-bold sub-labels
// in the PDF (see lib/pdf/agreement-pdf.ts) and as <strong> in the on-screen
// preview (see app/(app)/agreements/agreement-preview.tsx). Used in clause 5
// to break up the working-cadence sub-sections without wasting vertical
// space on standalone heading lines.

export const DEFAULT_LEGAL_TERMS = `1. SCOPE OF SERVICES

{legal_entity} ("Attomik") agrees to provide the services described in {proposal_ref}, which is attached to and incorporated by reference into this Agreement (the "Proposal"), to {client_company} ("Client"). The Proposal sets out the scope, deliverables, and commercial terms agreed between the parties.

The Proposal defines what is included in the engagement. Work outside the defined scope — including new deliverables, expanded platforms, additional brands, or material changes to direction after work has commenced — will be quoted separately as a change order and require written approval before commencement. Reasonable revisions and iteration on in-scope deliverables are included; repeated reversals of previously approved direction may be treated as out of scope.

In the event of any conflict between this Agreement and the Proposal, the terms of this Agreement govern.

2. STANDARD OF CARE

Attomik will perform the services in a professional manner, using reasonable skill and care consistent with industry standards. Outcomes depend on factors outside Attomik's control — including market conditions, product quality, pricing, third-party platforms, and Client decisions — and Attomik does not guarantee any specific business result.

3. FEES & PAYMENT

Client agrees to pay all fees as set forth in the Commercial Terms section. Phase 1 fees are payable according to the stated payment schedule. Phase 2 monthly fees are invoiced on the first business day of each month and payable net 15 days from invoice date.

Overdue amounts accrue a late fee of 1.5% per month or the maximum permitted by law, whichever is lower. If any amount is more than ten (10) days overdue, Attomik may, on written notice, suspend performance of all or part of the services until overdue amounts (including accrued late fees) are paid in full, and project timelines will be adjusted accordingly. All fees are exclusive of applicable taxes.

4. TERM & TERMINATION

Phase 1 concludes upon delivery of the stated deliverables.

Phase 2 begins on the agreed start date. The first three (3) months operate as an introductory period, during which either party may terminate at any time with thirty (30) days written notice. At month four (4), the parties will conduct a performance review and align on the rate, scope, and term of the ongoing engagement.

Either party may terminate immediately for material breach if such breach remains uncured for fifteen (15) days after written notice. Upon termination, Client shall pay for all services rendered through the termination date.

5. COMMUNICATION & WORKING CADENCE

To ensure focused, effective work, the parties agree to the following structure:

**Primary channel.** Email is the primary channel for strategic, status, and non-urgent communication. Slack is used for active project execution — coordinating in-flight deliverables, sharing files, and operational questions tied to live work.

**Working hours.** Attomik operates during standard U.S. business hours, Monday through Friday, on Eastern Time, excluding U.S. federal holidays. Communication received outside these hours will be addressed on the next business day.

**Response time.** Attomik will respond to Client communications within a reasonable timeframe during business hours. Complex requests requiring research, analysis, or coordination across deliverables may receive an initial acknowledgment with a substantive response to follow.

**Strategy calls.** A standing 45-minute strategy call is held biweekly during working hours.

**Urgent matters.** Time-sensitive issues materially impairing Client's commercial operations may be raised by phone or text and will be addressed as promptly as reasonably possible.

**Ad-hoc meetings.** Additional live meetings beyond the biweekly call may be scheduled by mutual agreement. Most non-urgent matters will be handled asynchronously by default.

6. INTELLECTUAL PROPERTY

Upon full payment of applicable fees, Client owns all final deliverables created specifically for Client under this Agreement, including website builds, creative assets, and strategic documents. Attomik retains ownership of its pre-existing materials and any proprietary tools, workflows, automations, and methodologies used to produce the deliverables. Attomik grants Client a perpetual, non-exclusive license to use any such retained materials that are incorporated into final deliverables.

Attomik may reference the engagement in its portfolio and marketing materials unless Client requests otherwise in writing.

7. CONFIDENTIALITY

Each party agrees to keep confidential any non-public information disclosed by the other party and to use such information solely for purposes of performing this Agreement. This obligation survives termination for a period of two (2) years. Information that is publicly available, independently developed, or required to be disclosed by law is excluded from this obligation.

8. CLIENT CONTENT, CLAIMS & INDEMNIFICATION

Client is solely responsible for the accuracy, legality, and regulatory compliance of all materials, information, claims, and content it provides to Attomik or directs Attomik to use, including without limitation product descriptions, marketing claims, ingredient and nutritional information, health or efficacy claims, pricing, inventory data, brand guidelines, imagery, and customer-facing copy.

Client represents and warrants that all such materials and claims comply with applicable laws and regulations, including FTC advertising rules, FDA labeling and claims requirements (where applicable), platform policies (including Meta, Google, TikTok, Amazon, Shopify, and Klaviyo), and all other applicable consumer protection, advertising, and product regulations.

Client agrees to indemnify and hold harmless Attomik, its founders, employees, and contractors from claims, losses, or expenses (including reasonable attorneys' fees) arising out of or related to: (a) the accuracy, legality, or compliance of Client-provided materials or claims; (b) Client's products, services, or business operations; (c) any third-party platform action (including account suspension, ad disapproval, listing removal, or processor freezes) resulting from Client-provided materials, claims, or product attributes; or (d) Client's breach of any representation or warranty in this Agreement.

Attomik may decline to publish, run, or implement any Client-provided material that Attomik reasonably believes may violate applicable law or platform policy, without liability and without relieving Client of payment obligations.

9. LIMITATION OF LIABILITY

Attomik's total liability under this Agreement shall not exceed the total fees actually paid by Client to Attomik under this Agreement in the three (3) months preceding the event giving rise to the claim. Neither party shall be liable for indirect, incidental, consequential, or punitive damages, including lost profits, even if advised of the possibility of such damages.

10. INDEPENDENT CONTRACTOR

Attomik performs services as an independent contractor. Nothing in this Agreement creates an employment, partnership, joint venture, or agency relationship between the parties. Each party is responsible for its own taxes, benefits, and compliance obligations.

11. CLIENT RESPONSIBILITIES & DEPENDENCIES

Client agrees to provide the materials, access, approvals, and information listed in the Kickoff Requirements section in a timely manner. Project timelines and delivery dates are contingent on timely Client feedback, approvals, and access to required accounts, systems, and assets.

Delays in providing required materials, approvals, or responses may extend timelines and do not relieve Client of payment obligations. If Client delays exceed ten (10) business days for a given dependency, Attomik may reallocate resources and adjust the project schedule accordingly.

Attomik is not responsible for delays, failures, or interruptions caused by Client, Client's personnel or vendors, or third-party platforms (including but not limited to Shopify, Meta, Google, TikTok, Amazon, email service providers, and payment processors).

12. OFFBOARDING & TRANSITION

Upon termination or expiration of this Agreement, and subject to Client being current on all fees:

Attomik will return or transfer to Client, within fifteen (15) business days, all final deliverables, Client-owned assets, and Client account credentials held by Attomik. Attomik will remove its personnel from Client systems and platforms upon Client's confirmation of receipt.

Attomik will retain copies of work product as required for its records, portfolio, and legal obligations, subject to the confidentiality terms of this Agreement.

Transition support beyond the standard offboarding (including extended training, handover documentation, or vendor onboarding support) may be provided on a time-and-materials basis at Attomik's then-current rates, by separate written agreement.

13. FORCE MAJEURE

Neither party shall be liable for any delay or failure to perform caused by events beyond its reasonable control, including acts of God, natural disasters, war, terrorism, civil unrest, government action, pandemics, internet or utility outages, or third-party platform failures. The affected party shall promptly notify the other and use reasonable efforts to resume performance.

14. ASSIGNMENT

Neither party may assign this Agreement without the prior written consent of the other party, except that Attomik may assign this Agreement to a successor entity in connection with a merger, acquisition, or sale of substantially all of its assets.

15. NOTICES

Formal legal notices under this Agreement (including notices of breach, termination, or assignment) must be sent in writing to the addresses listed at the top of this Agreement, with a copy by email to the primary contacts identified at kickoff. Email alone is sufficient for routine business communication but not for formal legal notices.

16. GOVERNING LAW & DISPUTES

This Agreement is governed by the laws of the {governing_law}, without regard to conflict of law principles. The parties agree to attempt in good faith to resolve any disputes through direct discussion before pursuing formal legal action.

17. ENTIRE AGREEMENT

This Agreement, together with any referenced exhibits or statements of work, constitutes the entire agreement between the parties and supersedes all prior discussions and proposals. Modifications must be in writing and signed by both parties. If any provision is found unenforceable, the remaining provisions remain in full effect.`;

export function renderTerms(
  template: string,
  vars: {
    client_company?: string | null;
    phase2_commitment?: number | null;
    governing_law?: string | null;
    legal_entity?: string | null;
    proposal_number?: string | null;
    proposal_date?: string | null;
  },
): string {
  const commitment = Number(vars.phase2_commitment) || 3;
  const proposalNumber = (vars.proposal_number ?? "").trim();
  const proposalDate = (vars.proposal_date ?? "").trim();
  const proposalRef = proposalNumber
    ? proposalDate
      ? `Proposal ${proposalNumber} dated ${proposalDate}`
      : `Proposal ${proposalNumber}`
    : "the attached proposal";
  return template
    .replace(/\{client_company\}/g, vars.client_company || "Client")
    .replace(/\{phase2_commitment\}/g, String(commitment))
    .replace(/\{phase2_commitment_next\}/g, String(commitment + 1))
    .replace(
      /\{governing_law\}/g,
      vars.governing_law || "State of Delaware, United States",
    )
    .replace(/\{legal_entity\}/g, vars.legal_entity || "Attomik, LLC")
    .replace(/\{proposal_ref\}/g, proposalRef);
}
