import { listResolvedFeatureControls } from "../services/featureControlService.js";

export async function getPublicFeatureConfiguration(request, response) {
  const controls = await listResolvedFeatureControls();

  return response.json({
    success: true,
    features: Object.fromEntries(
      controls.map(({ id, enabled }) => [id, enabled])
    ),
  });
}
