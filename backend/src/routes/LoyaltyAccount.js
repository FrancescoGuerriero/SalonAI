import {
  createFeedback,
  listFeedback,
  resolveFeedback,
} from "./feedbackAnalyticsService.js";

async function listFeedbackAnalytics(request, response) {
  const analytics = await listFeedback(request.query);
  return response.status(200).json({ success: true, analytics });
}

async function createFeedbackRecord(request, response) {
  const feedback = await createFeedback(request.body);
  return response.status(201).json({ success: true, feedback });
}

async function updateFeedbackResolution(request, response) {
  const feedback = await resolveFeedback(
    request.params.feedbackId,
    request.body?.resolved
  );
  return response.status(200).json({ success: true, feedback });
}

export {
  createFeedbackRecord,
  listFeedbackAnalytics,
  updateFeedbackResolution,
};
