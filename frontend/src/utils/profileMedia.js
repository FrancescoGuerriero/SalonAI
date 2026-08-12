export const PROFILE_PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp";

export const MAX_SOURCE_IMAGE_BYTES =
  5 * 1024 * 1024;

export const MAX_PROFILE_DATA_URL_LENGTH =
  650000;

export function isSupportedProfileFile(file) {
  return Boolean(
    file &&
      [
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(file.type) &&
      Number(file.size) > 0 &&
      Number(file.size) <=
        MAX_SOURCE_IMAGE_BYTES
  );
}

export function profileInitials(name = "") {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "SA";
  }

  return parts
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");
}

export function isProfileImageValue(value) {
  const text = String(value || "").trim();

  return (
    !text ||
    text.startsWith("https://") ||
    /^data:image\/(jpeg|png|webp);base64,/i.test(
      text
    )
  );
}
