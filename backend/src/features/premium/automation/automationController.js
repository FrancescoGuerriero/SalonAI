import {
  createRetentionJourney,
  listRetentionJourneys,
  updateRetentionJourney,
} from "./retentionAutomationService.js";

export async function listJourneys(
  req,
  res
) {
  const journeys =
    await listRetentionJourneys();

  return res.json({
    success: true,
    journeys,
  });
}

export async function createJourney(
  req,
  res
) {
  const journey =
    await createRetentionJourney(
      req.body,
      req.user?._id || null
    );

  return res
    .status(201)
    .json({
      success: true,
      message:
        "Retention journey created in paused state.",
      journey,
    });
}

export async function updateJourney(
  req,
  res
) {
  const journey =
    await updateRetentionJourney(
      req.params.journeyId,
      req.body,
      req.user?._id || null
    );

  return res.json({
    success: true,
    message:
      journey.enabled
        ? "Retention journey enabled."
        : "Retention journey saved.",
    journey,
  });
}
