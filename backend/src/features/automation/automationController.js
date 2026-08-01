import RetentionJourney from "./RetentionJourney.js";

export async function listJourneys(req, res) {
  res.json({ success: true, journeys: await RetentionJourney.find().sort({ createdAt: -1 }).lean() });
}

export async function createJourney(req, res) {
  res.status(201).json({ success: true, journey: await RetentionJourney.create(req.body) });
}

export async function toggleJourney(req, res) {
  const journey = await RetentionJourney.findByIdAndUpdate(
    req.params.journeyId,
    { enabled: Boolean(req.body.enabled) },
    { new: true }
  );
  res.json({ success: true, journey });
}
