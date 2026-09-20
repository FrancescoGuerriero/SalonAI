const DATA_IMAGE_PATTERN =
  /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i;

export const MAX_CATALOGUE_IMAGE_BYTES = 210_000;
export const MAX_CATALOGUE_IMAGE_URL_LENGTH = 2_000;
export const MAX_CATALOGUE_IMAGES = 6;

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.status = 400;
  return error;
}

function decodedBase64Bytes(payload) {
  const cleaned = String(payload || "").replace(/\s+/g, "");

  if (!cleaned) {
    return 0;
  }

  const padding =
    cleaned.endsWith("==")
      ? 2
      : cleaned.endsWith("=")
        ? 1
        : 0;

  return Math.floor((cleaned.length * 3) / 4) - padding;
}

function normaliseAppRelativePath(text) {
  if (
    !text.startsWith("/") ||
    text.startsWith("//") ||
    text.includes("\\")
  ) {
    return null;
  }

  let url;

  try {
    url = new URL(
      text,
      "https://salonai.invalid"
    );
  } catch {
    return null;
  }

  if (
    url.origin !==
    "https://salonai.invalid"
  ) {
    return null;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function normaliseCatalogueImage(
  value,
  {
    maximumBytes =
      MAX_CATALOGUE_IMAGE_BYTES,
    maximumUrlLength =
      MAX_CATALOGUE_IMAGE_URL_LENGTH,
  } = {}
) {
  const text =
    String(value ?? "").trim();

  if (!text) {
    return "";
  }

  const dataMatch =
    text.match(
      DATA_IMAGE_PATTERN
    );

  if (dataMatch) {
    const mediaType =
      dataMatch[1].toLowerCase();
    const payload =
      dataMatch[2].replace(
        /\s+/g,
        ""
      );
    const bytes =
      decodedBase64Bytes(
        payload
      );

    if (
      !bytes ||
      bytes > maximumBytes
    ) {
      throw validationError(
        `Catalogue images must be no larger than ${Math.round(maximumBytes / 1000)} KB after optimisation.`
      );
    }

    return `data:image/${mediaType};base64,${payload}`;
  }

  if (
    text
      .toLowerCase()
      .startsWith(
        "data:image/"
      )
  ) {
    throw validationError(
      "Catalogue image uploads must use JPEG, PNG or WebP."
    );
  }

  if (
    text.length >
    maximumUrlLength
  ) {
    throw validationError(
      "Catalogue image URLs are too long."
    );
  }

  const relative =
    normaliseAppRelativePath(
      text
    );

  if (relative) {
    return relative;
  }

  if (
    text.startsWith("//")
  ) {
    throw validationError(
      "Catalogue image paths must be app-relative or use an HTTPS URL."
    );
  }

  let url;

  try {
    url = new URL(text);
  } catch {
    throw validationError(
      "Catalogue images must be an HTTPS URL, app-relative path, or supported upload."
    );
  }

  if (
    url.protocol !==
    "https:"
  ) {
    throw validationError(
      "Catalogue image URLs must use HTTPS."
    );
  }

  return url.toString();
}

export function isSupportedCatalogueImage(
  value
) {
  try {
    normaliseCatalogueImage(
      value
    );
    return true;
  } catch {
    return false;
  }
}

export function normaliseCatalogueImages(
  values,
  {
    maximumImages =
      MAX_CATALOGUE_IMAGES,
  } = {}
) {
  if (
    !Array.isArray(values)
  ) {
    throw validationError(
      "Product images must be supplied as a list."
    );
  }

  const normalised =
    values
      .map(
        normaliseCatalogueImage
      )
      .filter(Boolean);

  const unique = [
    ...new Set(
      normalised
    ),
  ];

  if (
    unique.length >
    maximumImages
  ) {
    throw validationError(
      `A product can have at most ${maximumImages} images.`
    );
  }

  return unique;
}

export default {
  MAX_CATALOGUE_IMAGE_BYTES,
  MAX_CATALOGUE_IMAGE_URL_LENGTH,
  MAX_CATALOGUE_IMAGES,
  isSupportedCatalogueImage,
  normaliseCatalogueImage,
  normaliseCatalogueImages,
};
