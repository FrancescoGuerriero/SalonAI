const DATA_IMAGE_PATTERN =
  /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i;

export const MAX_PROFILE_IMAGE_BYTES = 450_000;
export const MAX_PROFILE_IMAGE_URL_LENGTH = 2_000;

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.status = 400;
  return error;
}

function decodedBase64Bytes(payload) {
  const cleaned = String(payload || "").replace(/\s+/g, "");
  if (!cleaned) return 0;

  const padding =
    cleaned.endsWith("==") ? 2 :
    cleaned.endsWith("=") ? 1 : 0;

  return Math.floor((cleaned.length * 3) / 4) - padding;
}

export function isSupportedProfileImage(value) {
  try {
    normaliseProfileImage(value);
    return true;
  } catch {
    return false;
  }
}

export function normaliseProfileImage(
  value,
  {
    maximumBytes = MAX_PROFILE_IMAGE_BYTES,
    maximumUrlLength = MAX_PROFILE_IMAGE_URL_LENGTH,
  } = {}
) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  const match = text.match(DATA_IMAGE_PATTERN);

  if (match) {
    const mediaType = match[1].toLowerCase();
    const payload = match[2].replace(/\s+/g, "");
    const bytes = decodedBase64Bytes(payload);

    if (!bytes || bytes > maximumBytes) {
      throw createValidationError(
        `Profile photos must be no larger than ${Math.round(maximumBytes / 1000)} KB after optimisation.`
      );
    }

    return `data:image/${mediaType};base64,${payload}`;
  }

  if (text.toLowerCase().startsWith("data:image/")) {
    throw createValidationError(
      "Profile photo uploads must use JPEG, PNG or WebP."
    );
  }

  if (text.length <= maximumUrlLength) {
    try {
      const url = new URL(text);

      if (url.protocol !== "https:") {
        throw createValidationError(
          "Profile image URLs must use HTTPS."
        );
      }

      return url.toString();
    } catch (error) {
      if (error?.statusCode) {
        throw error;
      }
    }
  }

  throw createValidationError(
    "Profile photos must be an HTTPS image URL or a JPEG, PNG or WebP upload."
  );
}

export function normalisePublicProfileUrl(
  value,
  {
    allowHandle = false,
    maximumLength = 300,
  } = {}
) {
  const text = String(value ?? "").trim().slice(0, maximumLength);

  if (!text) {
    return "";
  }

  if (allowHandle && /^@[A-Za-z0-9._]{1,60}$/.test(text)) {
    return text;
  }

  let url;

  try {
    url = new URL(text);
  } catch {
    throw createValidationError(
      "Public profile links must be valid HTTPS URLs."
    );
  }

  if (url.protocol !== "https:") {
    throw createValidationError(
      "Public profile links must use HTTPS."
    );
  }

  return url.toString();
}

export default {
  isSupportedProfileImage,
  normaliseProfileImage,
  normalisePublicProfileUrl,
};
