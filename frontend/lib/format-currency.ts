export function formatCurrency(value: number) {
  return `₹${Math.round(value).toLocaleString()}`;
}
