import CustomerFeedback from "./CustomerFeedback.js";

import {
  clampInteger,
  roundNumber,
} from "../shared/analyticsUtils.js";

const POSITIVE_WORDS = new Set([
  "amazing",
  "beautiful",
  "brilliant",
  "clean",
  "excellent",
  "fantastic",
  "friendly",
  "great",
  "happy",
  "helpful",
  "love",
  "lovely",
  "perfect",
  "professional",
  "recommend",
  "relaxing",
  "satisfied",
  "wonderful",
]);

const NEGATIVE_WORDS = new Set([
  "awful",
  "bad",
  "dirty",
  "disappointed",
  "expensive",
  "late",
  "poor",
  "rude",
  "slow",
  "terrible",
  "unhappy",
  "unprofessional",
  "wait",
  "waiting",
  "worst",
]);

function analyseSentiment(comment, rating) {
  const words = String(comment || "")
    .toLowerCase()
    .match(/[a-z']+/g) || [];
  let score = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) score += 1;
    if (NEGATIVE_WORDS.has(word)) score -= 1;
  }

  score += (Number(rating || 3) - 3) * 1.5;
  const normalised = Math.max(-1, Math.min(1, score / 6));

  return {
    sentiment: normalised >= 0.2 ? "positive" : normalised <= -0.2 ? "negative" : "neutral",
    sentimentScore: roundNumber(normalised, 2),
  };
}

async function createFeedback(payload) {
  const rating = clampInteger(payload?.rating, 1, 5, 3);
  const analysis = analyseSentiment(payload?.comment, rating);

  const feedback = await CustomerFeedback.create({
    customer: payload?.customerId || payload?.customer || null,
    appointment: payload?.appointmentId || payload?.appointment || null,
    service: payload?.serviceId || payload?.service || null,
    stylist: payload?.stylistId || payload?.stylist || null,
    rating,
    comment: String(payload?.comment || "").trim(),
    source: String(payload?.source || "manual").trim(),
    tags: Array.isArray(payload?.tags)
      ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [],
    ...analysis,
  });

  return feedback.toObject();
}

async function listFeedback({ sentiment, resolved, limit = 200 } = {}) {
  const query = {};
  if (["positive", "neutral", "negative"].includes(sentiment)) query.sentiment = sentiment;
  if (resolved === "true") query.resolved = true;
  if (resolved === "false") query.resolved = false;

  const items = await CustomerFeedback.find(query)
    .populate("customer", "firstName lastName name fullName displayName email")
    .populate("service", "name category")
    .populate("stylist", "firstName lastName name fullName displayName email")
    .sort({ createdAt: -1 })
    .limit(clampInteger(limit, 1, 1000, 200))
    .lean();

  const ratingAverage =
    items.length > 0
      ? items.reduce((total, item) => total + Number(item.rating || 0), 0) / items.length
      : 0;

  return {
    summary: {
      feedbackCount: items.length,
      averageRating: roundNumber(ratingAverage, 2),
      positive: items.filter((item) => item.sentiment === "positive").length,
      neutral: items.filter((item) => item.sentiment === "neutral").length,
      negative: items.filter((item) => item.sentiment === "negative").length,
      unresolvedNegative: items.filter(
        (item) => item.sentiment === "negative" && !item.resolved
      ).length,
    },
    items,
  };
}

async function resolveFeedback(feedbackId, resolved = true) {
  const feedback = await CustomerFeedback.findByIdAndUpdate(
    feedbackId,
    { resolved: Boolean(resolved) },
    { new: true, runValidators: true }
  ).lean();

  if (!feedback) {
    const error = new Error("Feedback record not found.");
    error.statusCode = 404;
    throw error;
  }

  return feedback;
}

export { analyseSentiment, createFeedback, listFeedback, resolveFeedback };
