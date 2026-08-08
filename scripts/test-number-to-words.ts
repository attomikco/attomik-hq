/**
 * Unit tests for the invoice amount-in-words helper.
 *
 * Usage:
 *   npx ts-node scripts/test-number-to-words.ts
 *   npm run test:words
 *
 * Exits non-zero on the first failing expectation so it can gate a commit.
 */

import { amountInWords, EN_US } from "../lib/number-to-words";

let failures = 0;
let checks = 0;

function expect(label: string, actual: string, expected: string) {
  checks += 1;
  if (actual === expected) {
    console.log(`  ok    ${label}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL  ${label}`);
  console.log(`        expected: ${expected}`);
  console.log(`        actual:   ${actual}`);
}

console.log("amountInWords: the four required invoice totals");
expect(
  "3000",
  amountInWords(3000),
  "Three thousand US dollars and 00/100 (USD 3,000.00)",
);
expect(
  "5000",
  amountInWords(5000),
  "Five thousand US dollars and 00/100 (USD 5,000.00)",
);
expect(
  "8000",
  amountInWords(8000),
  "Eight thousand US dollars and 00/100 (USD 8,000.00)",
);
expect(
  "4250.75 (whole dollars + cents)",
  amountInWords(4250.75),
  "Four thousand two hundred fifty US dollars and 75/100 (USD 4,250.75)",
);

console.log("\namountInWords: cents handling");
expect(
  "0.05 rounds to five cents, zero dollars",
  amountInWords(0.05),
  "Zero US dollars and 05/100 (USD 0.05)",
);
expect(
  "1234.5 pads a single-digit cent value",
  amountInWords(1234.5),
  "One thousand two hundred thirty-four US dollars and 50/100 (USD 1,234.50)",
);
expect(
  "float noise does not shift a digit",
  amountInWords(0.1 + 0.2),
  "Zero US dollars and 30/100 (USD 0.30)",
);
expect(
  "a third of a cent rounds up",
  amountInWords(19.999),
  "Twenty US dollars and 00/100 (USD 20.00)",
);

console.log("\namountInWords: magnitudes and edges");
expect("zero", amountInWords(0), "Zero US dollars and 00/100 (USD 0.00)");
expect(
  "one dollar one cent",
  amountInWords(1.01),
  "One US dollars and 01/100 (USD 1.01)",
);
expect(
  "hyphenated tens",
  amountInWords(72),
  "Seventy-two US dollars and 00/100 (USD 72.00)",
);
expect(
  "hundreds inside thousands",
  amountInWords(15750),
  "Fifteen thousand seven hundred fifty US dollars and 00/100 (USD 15,750.00)",
);
expect(
  "millions",
  amountInWords(2_000_500),
  "Two million five hundred US dollars and 00/100 (USD 2,000,500.00)",
);
expect(
  "negative clamps to zero",
  amountInWords(-100),
  "Zero US dollars and 00/100 (USD 0.00)",
);

console.log("\nlocale seam: swapping the locale swaps the wording");
const SHOUTY = {
  ...EN_US,
  assemble: (words: string, cents: string, figures: string, name: string) =>
    `${words.toUpperCase()} ${name.toUpperCase()} ${cents}/100 ${figures}`,
};
expect(
  "a custom locale controls the whole string",
  amountInWords(3000, "USD", SHOUTY),
  "THREE THOUSAND US DOLLARS 00/100 USD 3,000.00",
);

console.log(
  `\n${checks - failures}/${checks} passed${failures ? `, ${failures} FAILED` : ""}`,
);
process.exit(failures ? 1 : 0);
