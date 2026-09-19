import {
  DEFAULT_VERTICAL_ID,
  getVerticalDefinition,
} from "./verticals/verticalRegistry.js";

export const PLATFORM_NAME = "AI Business Platform";

export function getRuntimePlatformConfiguration(environment = process.env) {
  const vertical = getVerticalDefinition(
    environment.AI_BUSINESS_PLATFORM_VERTICAL ||
      environment.SALONAI_BUSINESS_TYPE ||
      DEFAULT_VERTICAL_ID
  );

  return {
    platform: PLATFORM_NAME,
    businessType: vertical.id,
    verticalLabel: vertical.label,
    terminology: vertical.terminology,
    capabilities: vertical.capabilities,
  };
}
