export function formatCurrency(value: number) {
  return `₹${Math.round(value).toLocaleString()}`;
}

const compactFormatter = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// Short form for chart axes, e.g. ₹30K, ₹1.5L — full amounts get truncated
// on a phone-width axis.
export function formatCurrencyCompact(value: number) {
  return `₹${compactFormatter.format(value)}`;
}
