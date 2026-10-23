import {
  getMetricDefinition,
  metricDefinitionEvidence,
} from "./metricCatalogue.js";

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function round(value, decimals = 1) {
  const precision = Math.max(0, Math.min(6, Number(decimals) || 0));
  return Number(Number(value || 0).toFixed(precision));
}

export function calculateCanonicalRatio(
  key,
  numerator,
  denominator,
  { decimals = 1 } = {}
) {
  const definition = getMetricDefinition(key);

  if (definition.aggregation !== "ratio") {
    const error = new Error(
      `Canonical metric ${key} is not a ratio metric.`
    );
    error.code = "METRIC_NOT_RATIO";
    error.statusCode = 400;
    throw error;
  }

  const safeNumerator = finiteNonNegative(numerator);
  const safeDenominator = finiteNonNegative(denominator);

  if (safeDenominator <= 0) return 0;

  return round(
    (safeNumerator / safeDenominator) * 100,
    decimals
  );
}

export function canonicalRatioResult(
  key,
  numerator,
  denominator,
  { decimals = 1 } = {}
) {
  const definition = getMetricDefinition(key);

  return Object.freeze({
    key: definition.key,
    version: definition.version,
    label: definition.label,
    value: calculateCanonicalRatio(
      key,
      numerator,
      denominator,
      { decimals }
    ),
    numerator: finiteNonNegative(numerator),
    denominator: finiteNonNegative(denominator),
    unit: definition.unit,
    area: definition.presentationArea,
    evidence: metricDefinitionEvidence(key),
  });
}

export function canonicalMetricEvidence(key) {
  return metricDefinitionEvidence(key);
}

export default {
  calculateCanonicalRatio,
  canonicalRatioResult,
  canonicalMetricEvidence,
};
