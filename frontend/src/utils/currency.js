export function formatCurrency(value, currency = "GBP") {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(Number.isFinite(amount) ? amount : 0);
}
