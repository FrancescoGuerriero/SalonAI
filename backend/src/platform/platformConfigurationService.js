import {
  DEFAULT_VERTICAL_ID,
  getVerticalDefinition,
  listVerticalDefinitions,
} from "./verticals/verticalRegistry.js";

export const PLATFORM_NAME = "AI Intelligent Business Platform";
export const REFERENCE_APPLICATION = "Salon AI";

export function getRuntimePlatformConfiguration(environment = process.env) {
  const vertical = getVerticalDefinition(
    environment.AI_BUSINESS_PLATFORM_VERTICAL ||
      environment.SALONAI_BUSINESS_TYPE ||
      DEFAULT_VERTICAL_ID
  );

  return {
    platform: PLATFORM_NAME,
    referenceApplication: REFERENCE_APPLICATION,
    businessType: vertical.id,
    verticalLabel: vertical.label,
    terminology: vertical.terminology,
    capabilities: vertical.capabilities,
    availableProducts: listVerticalDefinitions().map(({ id, label }) => ({
      id,
      label,
    })),
  };
}
