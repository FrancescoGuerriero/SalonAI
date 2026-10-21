import {
  createRetentionJourney,
  listRetentionJourneys,
  updateRetentionJourney,
} from "../premium/automation/retentionAutomationService.js";

export async function listJourneys(
  request,
  response
) {
  const journeys =
    await listRetentionJourneys();

  return response.json({
    success: true,
    journeys,
  });
}

export async function createJourney(
  request,
  response
) {
  const journey =
    await createRetentionJourney(
      request.body,
      request.user?._id || null
    );

  return response
    .status(201)
    .json({
      success: true,
      journey,
    });
}

export async function toggleJourney(
  request,
  response
) {
  const journey =
    await updateRetentionJourney(
      request.params.journeyId,
      {
        enabled:
          request.body?.enabled ===
          true,
      },
      request.user?._id || null
    );

  return response.json({
    success: true,
    journey,
  });
}
