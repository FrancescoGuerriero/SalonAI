/**
 * Inspect source order evidence without comparing with Commerce or implying
 * ownership. Keep monetary values as decimal strings to avoid float rounding.
 */
export function inspectSellerOrderSourceEvidence(sourceRecord) {
  const source = sourceRecord && typeof sourceRecord === "object" ? sourceRecord : {};
  const rawAmount = source.amount;
  const rawCurrency = source.currency;
  const amount = typeof rawAmount === "string" ? rawAmount.trim() : "";
  const currency = typeof rawCurrency === "string" ? rawCurrency.trim() : "";
  const hasAmount = rawAmount !== undefined && rawAmount !== null && amount !== "";
  const hasCurrency = rawCurrency !== undefined && rawCurrency !== null && currency !== "";
  const validAmount = !hasAmount || /^(?:0|[1-9]\d{0,11})(?:\.\d{1,3})?$/.test(amount);
  const validCurrency = !hasCurrency || /^[A-Z]{3}$/.test(currency);
  const rawDate = source.placedAt;
  const hasDate = rawDate !== undefined && rawDate !== null && rawDate !== "";
  const parsedDate = rawDate instanceof Date ? rawDate :
    typeof rawDate === "string" ? new Date(rawDate) : null;
  const validDate = !hasDate || (parsedDate instanceof Date &&
    Number.isFinite(parsedDate.getTime()) &&
    parsedDate.getTime() <= Date.now() + 300000);
  const state = !validAmount || !validCurrency || !validDate ? "invalid_source_evidence" :
    !hasAmount || !hasCurrency || !hasDate ? "incomplete_source_evidence" :
      "source_evidence_present";
  return Object.freeze({
    state,
    sourceAmount: validAmount && hasAmount ? amount : null,
    sourceCurrency: validCurrency && hasCurrency ? currency : null,
    sourcePlacedAt: validDate && hasDate ? parsedDate.toISOString() : null,
    commerceAmountCompared: false,
    commerceOwnershipVerified: false,
  });
}
