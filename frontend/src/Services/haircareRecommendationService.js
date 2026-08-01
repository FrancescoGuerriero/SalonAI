import API from "../api/axios.js";

const AI_ROOT = "/ai";

export const HAIR_TYPES = Object.freeze([
  { value: "straight", label: "Straight" },
  { value: "wavy", label: "Wavy" },
  { value: "curly", label: "Curly" },
  { value: "coily", label: "Coily" },
]);

export const HAIR_TEXTURES = Object.freeze([
  { value: "fine", label: "Fine" },
  { value: "medium", label: "Medium" },
  { value: "coarse", label: "Coarse" },
]);

export const HAIR_CONCERNS = Object.freeze([
  { value: "dryness", label: "Dryness" },
  { value: "damage", label: "Damage" },
  { value: "frizz", label: "Frizz" },
  { value: "oiliness", label: "Oiliness" },
  { value: "colour_care", label: "Colour care" },
  { value: "scalp_sensitivity", label: "Scalp sensitivity" },
  { value: "dandruff", label: "Dandruff or persistent flaking" },
  { value: "thinning", label: "Thinning or hair loss" },
  { value: "breakage", label: "Breakage" },
  { value: "lack_of_volume", label: "Lack of volume" },
]);

export const CHEMICAL_SERVICES = Object.freeze([
  { value: "colour", label: "Colour" },
  { value: "bleach", label: "Bleach or lightener" },
  { value: "relaxer", label: "Relaxer" },
  { value: "perm", label: "Perm" },
  { value: "keratin", label: "Keratin treatment" },
  { value: "none", label: "None" },
]);

export const MAINTENANCE_PREFERENCES = Object.freeze([
  { value: "low", label: "Low maintenance" },
  { value: "medium", label: "Balanced" },
  { value: "high", label: "Detailed routine" },
]);

function createAiApiError(error) {
  const data = error?.response?.data || {};
  const aiError = new Error(
    data.message ||
      data.error ||
      error?.message ||
      "The AI recommendation request failed."
  );

  aiError.name = "HaircareRecommendationApiError";
  aiError.status = error?.response?.status || null;
  aiError.code = data.code || error?.code || "AI_RECOMMENDATION_API_ERROR";
  aiError.details = data.details || null;
  aiError.data = data;

  return aiError;
}

export async function getAiServiceStatus() {
  try {
    const response = await API.get(`${AI_ROOT}/status`);
    return response.data;
  } catch (error) {
    throw createAiApiError(error);
  }
}

export async function generateHaircareRecommendation(payload) {
  try {
    const response = await API.post(
      `${AI_ROOT}/haircare/recommendations`,
      payload
    );

    return response.data?.recommendation || response.data;
  } catch (error) {
    throw createAiApiError(error);
  }
}

export default {
  generateHaircareRecommendation,
  getAiServiceStatus,
};
