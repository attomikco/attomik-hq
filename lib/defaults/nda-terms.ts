// Default Mutual NDA template. Same data shape as DEFAULT_LEGAL_TERMS:
// a string broken into numbered clauses separated by blank lines, with
// merge fields substituted at render time by renderNDATerms.
//
// Merge fields used in the body:
//   {client_legal_name}, {client_address}, {effective_date},
//   {purpose}, {term_years}, {legal_entity}

export const DEFAULT_NDA_TERMS = `MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement (this "Agreement") is entered into as of {effective_date} (the "Effective Date") between {legal_entity}, a Delaware limited liability company with its principal place of business at 169 Madison Ave, STE 2733, New York, NY 10016 ("Attomik"), and {client_legal_name}, with its principal place of business at {client_address} ("Counterparty"). Attomik and Counterparty are each referred to as a "Party" and collectively as the "Parties."

1. PURPOSE

The Parties wish to explore and discuss a potential business relationship in connection with the following: {purpose} (the "Purpose"). In connection with the Purpose, each Party (in such capacity, the "Disclosing Party") may share certain non-public, confidential, or proprietary information with the other Party (in such capacity, the "Receiving Party").

2. CONFIDENTIAL INFORMATION

"Confidential Information" means any non-public information disclosed by the Disclosing Party to the Receiving Party, whether orally, in writing, electronically, or by inspection of tangible objects, that is identified as confidential at the time of disclosure or that should reasonably be understood to be confidential given the nature of the information and the circumstances of disclosure. Confidential Information includes, without limitation, business plans, customer and supplier information, financial information, marketing strategies, product roadmaps, technical data, source code, designs, processes, methodologies, internal tools, pricing, and any information about employees, contractors, or partners.

Confidential Information does not include information that the Receiving Party can demonstrate: (a) is or becomes publicly available through no fault of the Receiving Party; (b) was known to the Receiving Party prior to disclosure without an obligation of confidentiality; (c) is independently developed by the Receiving Party without use of or reference to the Confidential Information; or (d) is rightfully obtained from a third party without an obligation of confidentiality.

3. OBLIGATIONS

The Receiving Party agrees to: (a) use the Confidential Information solely for the Purpose; (b) protect the Confidential Information using at least the same degree of care it uses to protect its own confidential information of similar importance, and in no event less than a reasonable degree of care; (c) limit access to the Confidential Information to its employees, contractors, and advisors who have a legitimate need to know and who are bound by confidentiality obligations no less protective than those in this Agreement; and (d) not reverse engineer, decompile, or disassemble any materials provided by the Disclosing Party.

4. COMPELLED DISCLOSURE

If the Receiving Party is required by law, court order, or governmental authority to disclose Confidential Information, the Receiving Party shall, to the extent legally permitted, promptly notify the Disclosing Party so that the Disclosing Party may seek a protective order or other remedy. The Receiving Party shall disclose only the portion of Confidential Information that is legally required and shall use reasonable efforts to ensure that any disclosed information is treated confidentially.

5. NO LICENSE

Nothing in this Agreement grants the Receiving Party any right, title, license, or interest in or to any Confidential Information, intellectual property, or other proprietary rights of the Disclosing Party, except the limited right to use the Confidential Information solely for the Purpose.

6. NO REPRESENTATION

All Confidential Information is provided "as is." Neither Party makes any representation or warranty as to the accuracy or completeness of the Confidential Information disclosed under this Agreement.

7. TERM

This Agreement begins on the Effective Date and continues for {term_years} years, unless earlier terminated by either Party. The confidentiality obligations for each item of Confidential Information survive for {term_years} years from the date that item was disclosed.

8. RETURN OR DESTRUCTION

Upon written request by the Disclosing Party, the Receiving Party shall promptly return or destroy all Confidential Information in its possession, including all copies, notes, and derivatives, and shall certify such return or destruction in writing. The Receiving Party may retain one archival copy solely for legal compliance and a reasonable number of automated backup copies, which remain subject to the confidentiality obligations of this Agreement until destroyed in the ordinary course.

9. NO OBLIGATION TO PROCEED

Nothing in this Agreement obligates either Party to enter into any further business relationship, transaction, or agreement. Each Party may terminate discussions at any time, for any reason, without liability.

10. REMEDIES

The Parties acknowledge that a breach of this Agreement may cause irreparable harm for which monetary damages would be inadequate. The Disclosing Party shall be entitled to seek equitable relief, including injunctive relief and specific performance, in addition to any other remedies available at law or in equity.

11. GOVERNING LAW

This Agreement is governed by the laws of the State of Delaware, without regard to its conflict of laws principles. The Parties consent to the exclusive jurisdiction of the state and federal courts located in Delaware for any disputes arising under this Agreement.

12. MISCELLANEOUS

This Agreement constitutes the entire agreement between the Parties regarding the subject matter and supersedes all prior or contemporaneous understandings. This Agreement may be amended only in a writing signed by both Parties. If any provision is held unenforceable, the remaining provisions shall remain in full force and effect. This Agreement may be executed in counterparts, including by electronic signature, each of which shall be deemed an original.`;

export function renderNDATerms(
  template: string,
  vars: {
    client_legal_name?: string | null;
    client_address?: string | null;
    effective_date?: string | null;
    purpose?: string | null;
    term_years?: number | null;
    legal_entity?: string | null;
  },
): string {
  const term = Number(vars.term_years) || 2;
  return template
    .replace(
      /\{client_legal_name\}/g,
      (vars.client_legal_name ?? "").trim() || "Counterparty",
    )
    .replace(
      /\{client_address\}/g,
      (vars.client_address ?? "").trim() || "[address on file]",
    )
    .replace(/\{effective_date\}/g, vars.effective_date || "the Effective Date")
    .replace(
      /\{purpose\}/g,
      (vars.purpose ?? "").trim() ||
        "the parties' evaluation of a potential business relationship",
    )
    .replace(/\{term_years\}/g, String(term))
    .replace(/\{legal_entity\}/g, vars.legal_entity || "Attomik, LLC");
}
