import {
  DEFAULT_VERTICAL_ID,
  getVerticalDefinition,
} from "./verticals/verticalRegistry.js";

export function getRuntimePlatformConfiguration(environment = process.env) {
  const vertical = getVerticalDefinition(
    environment.SALONAI_BUSINESS_TYPE || DEFAULT_VERTICAL_ID
  );

  return {
    platform: "SalonAI",
    businessType: vertical.id,
    verticalLabel: vertical.label,
    terminology: vertical.terminology,
    capabilities: vertical.capabilities,
  };
}
