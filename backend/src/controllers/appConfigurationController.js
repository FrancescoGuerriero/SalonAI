import { listResolvedFeatureControls } from "../services/featureControlService.js";
import { getRuntimePlatformConfiguration } from "../platform/platformConfigurationService.js";

export async function getPublicFeatureConfiguration(request, response) {
  const controls = await listResolvedFeatureControls();

  return response.json({
    success: true,
    features: Object.fromEntries(
      controls.map(({ id, enabled }) => [id, enabled])
    ),
  });
}

export function getPublicPlatformConfiguration(request, response) {
  return response.json({
    success: true,
    ...getRuntimePlatformConfiguration(),
  });
}
