/**
 * Invoice total spelled out in words, for the MX invoice template.
 *
 *   amountInWords(3000)  ->  "Three thousand US dollars and 00/100 (USD 3,000.00)"
 *
 * A comprobante from a foreign resident has to state the total in words as
 * well as figures. Everything language-specific lives inside a locale object,
 * so moving the invoice wording from English to Spanish means writing an ES_MX
 * locale and repointing AMOUNT_WORDS_LOCALE at it. Nothing else changes.
 */

export type AmountWordsLocale = {
  /** Spells a non-negative whole number. Must handle 0. */
  wholeToWords(n: number): string;
  /** Name of the currency in this language, e.g. "US dollars". */
  currencyName(code: string): string;
  /**
   * Assembles the final line from the pieces.
   *   words   already-capitalized whole part, e.g. "Three thousand"
   *   cents   two digits, e.g. "00"
   *   figures the numeric rendering, e.g. "USD 3,000.00"
   */
  assemble(words: string, cents: string, figures: string, currencyName: string): string;
};

const EN_ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen",
];

const EN_TENS = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty",
  "ninety",
];

// Ordered largest-first so the grouping loop can consume them in sequence.
const EN_SCALES: { value: number; name: string }[] = [
  { value: 1_000_000_000, name: "billion" },
  { value: 1_000_000, name: "million" },
  { value: 1_000, name: "thousand" },
];

/** Spells 0..999 without any scale word. */
function enUnderThousand(n: number): string {
  if (n < 20) return EN_ONES[n];
  if (n < 100) {
    const tens = EN_TENS[Math.floor(n / 10)];
    const ones = n % 10;
    return ones ? `${tens}-${EN_ONES[ones]}` : tens;
  }
  const hundreds = `${EN_ONES[Math.floor(n / 100)]} hundred`;
  const rest = n % 100;
  return rest ? `${hundreds} ${enUnderThousand(rest)}` : hundreds;
}

export const EN_US: AmountWordsLocale = {
  wholeToWords(n) {
    if (n === 0) return EN_ONES[0];
    const parts: string[] = [];
    let remaining = n;
    for (const scale of EN_SCALES) {
      const count = Math.floor(remaining / scale.value);
      if (count > 0) {
        parts.push(`${enUnderThousand(count)} ${scale.name}`);
        remaining %= scale.value;
      }
    }
    if (remaining > 0) parts.push(enUnderThousand(remaining));
    return parts.join(" ");
  },

  currencyName(code) {
    // US invoices are always billed in USD; other codes fall back to the code
    // itself rather than guessing a plural noun.
    return code === "USD" ? "US dollars" : code;
  },

  assemble(words, cents, figures, currencyName) {
    return `${words} ${currencyName} and ${cents}/100 (${figures})`;
  },
};

/**
 * The active locale for invoice amount wording. Switching the invoice to
 * Spanish is this one line, once an ES_MX locale exists.
 */
export const AMOUNT_WORDS_LOCALE: AmountWordsLocale = EN_US;

/** Capitalizes the first character, leaving the rest untouched. */
function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Spells an invoice total, e.g.
 *   3000     -> "Three thousand US dollars and 00/100 (USD 3,000.00)"
 *   4250.75  -> "Four thousand two hundred fifty US dollars and 75/100 (USD 4,250.75)"
 *
 * Negative inputs are clamped to zero: an invoice total is never negative, and
 * silently spelling a negative would be worse than showing nothing sensible.
 */
export function amountInWords(
  amount: number,
  code = "USD",
  locale: AmountWordsLocale = AMOUNT_WORDS_LOCALE,
): string {
  const safe = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  // Work in integer cents so 4250.745-style float noise can't shift a digit.
  const totalCents = Math.max(0, Math.round(safe * 100));
  const whole = Math.floor(totalCents / 100);
  const cents = String(totalCents % 100).padStart(2, "0");

  const words = capitalize(locale.wholeToWords(whole));
  const figures = `${code} ${whole.toLocaleString("en-US")}.${cents}`;
  return locale.assemble(words, cents, figures, locale.currencyName(code));
}
