import {
  createStage7RetentionJourney,
  listStage7RetentionJourneys,
  previewStage7RetentionJourney,
  updateStage7RetentionJourney,
} from "./stage7RetentionService.js";

export async function listJourneys(req, res) {
  const journeys = await listStage7RetentionJourneys(
    req.tenantContext || {}
  );

  return res.json({
    success: true,
    journeys,
  });
}

export async function createJourney(req, res) {
  const journey = await createStage7RetentionJourney(
    req.body,
    {
      tenantContext: req.tenantContext || {},
      actorId: req.user?._id || null,
    }
  );

  return res.status(201).json({
    success: true,
    message: "Retention journey created in paused state.",
    journey,
  });
}

export async function updateJourney(req, res) {
  const journey = await updateStage7RetentionJourney(
    req.params.journeyId,
    req.body,
    {
      tenantContext: req.tenantContext || {},
      actorId: req.user?._id || null,
    }
  );

  return res.json({
    success: true,
    message: journey.enabled
      ? "Retention journey enabled."
      : "Retention journey saved.",
    journey,
  });
}

export async function previewJourney(req, res) {
  const preview = await previewStage7RetentionJourney(
    req.params.journeyId,
    {
      tenantContext: req.tenantContext || {},
      limit: req.query.limit,
    }
  );

  return res.json({
    success: true,
    preview,
  });
}
