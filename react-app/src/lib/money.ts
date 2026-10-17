/**
 * Money helpers (MoneyAndValidationRules §1).
 *
 * Every amount in CoSupply is an integer Myanmar Kyat value with no decimal
 * places, so formatting is grouping only — never currency conversion and
 * never fractional digits.
 */

const MMK_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

/** Format an integer MMK amount, e.g. 5000 -> "5,000". */
export function formatMMK(amount: number): string {
  return MMK_FORMATTER.format(Math.trunc(amount));
}
