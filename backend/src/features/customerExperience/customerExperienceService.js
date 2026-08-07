import mongoose from "mongoose";

export function text(value, maximumLength = 500) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximumLength);
}

export function integer(value, minimum, maximum, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    const error = new Error(`${fieldName} must be between ${minimum} and ${maximum}.`);
    error.statusCode = 422;
    throw error;
  }
  return parsed;
}

export function objectId(value, fieldName) {
  if (!mongoose.isValidObjectId(value)) {
    const error = new Error(`${fieldName} must be a valid identifier.`);
    error.statusCode = 400;
    throw error;
  }
  return new mongoose.Types.ObjectId(value);
}

export function safeHttpsUrl(value) {
  const candidate = text(value, 1000);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") throw new Error("protocol");
    return url.toString();
  } catch {
    const error = new Error("Inspiration image links must use a valid HTTPS URL.");
    error.statusCode = 422;
    throw error;
  }
}

export function normaliseDiscovery(payload = {}) {
  const allowedDays = new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
  const allowedTimes = new Set(["", "morning", "afternoon", "evening"]);
  const preferredTimeOfDay = text(payload.preferredTimeOfDay, 20).toLowerCase();

  return {
    postcode: text(payload.postcode, 20).toUpperCase(),
    travelRadiusMiles: integer(payload.travelRadiusMiles ?? 10, 1, 100, "Travel radius"),
    serviceCategories: [...new Set((Array.isArray(payload.serviceCategories) ? payload.serviceCategories : [])
      .map((item) => text(item, 80))
      .filter(Boolean))].slice(0, 12),
    preferredStylist: text(payload.preferredStylist, 100),
    preferredDays: [...new Set((Array.isArray(payload.preferredDays) ? payload.preferredDays : [])
      .map((item) => text(item, 20).toLowerCase())
      .filter((item) => allowedDays.has(item)))],
    preferredTimeOfDay: allowedTimes.has(preferredTimeOfDay) ? preferredTimeOfDay : "",
  };
}

export function normaliseOffer(payload = {}) {
  const discountType = text(payload.discountType, 20).toLowerCase();
  const value = Number(payload.value);
  const endsAt = new Date(payload.endsAt);

  if (!["percentage", "fixed"].includes(discountType)) {
    const error = new Error("Discount type must be percentage or fixed.");
    error.statusCode = 422;
    throw error;
  }
  if (!Number.isFinite(value) || value <= 0 || (discountType === "percentage" && value > 100)) {
    const error = new Error("Offer value is invalid.");
    error.statusCode = 422;
    throw error;
  }
  if (Number.isNaN(endsAt.getTime()) || endsAt <= new Date()) {
    const error = new Error("Offer end date must be in the future.");
    error.statusCode = 422;
    throw error;
  }

  return {
    code: text(payload.code, 40).toUpperCase(),
    title: text(payload.title, 120),
    description: text(payload.description, 750),
    discountType,
    value,
    minimumSpend: Math.max(0, Number(payload.minimumSpend) || 0),
    startsAt: payload.startsAt ? new Date(payload.startsAt) : new Date(),
    endsAt,
    active: payload.active !== false,
    maxClaims: payload.maxClaims ? integer(payload.maxClaims, 1, 1000000, "Maximum claims") : null,
  };
}
