export const MAX_CATALOGUE_SOURCE_BYTES =
  5 * 1024 * 1024;
export const MAX_CATALOGUE_DATA_URL_LENGTH =
  280_000;
export const MAX_CATALOGUE_IMAGES = 6;
export const MAX_CATALOGUE_IMAGE_URL_LENGTH =
  2_000;

export function normaliseCatalogueImageUrl(
  value
) {
  const text =
    String(value || "")
      .trim();

  if (!text) {
    throw new Error(
      "Enter an image URL or app-relative image path."
    );
  }

  if (
    text.length >
    MAX_CATALOGUE_IMAGE_URL_LENGTH
  ) {
    throw new Error(
      "Image URLs and app-relative paths must be 2000 characters or fewer."
    );
  }

  if (
    text.startsWith("//")
  ) {
    throw new Error(
      "App-relative image paths must start with a single slash."
    );
  }

  if (
    text.startsWith("/")
  ) {
    let url;

    try {
      url = new URL(
        text,
        "https://salonai.invalid"
      );
    } catch {
      throw new Error(
        "Enter a valid app-relative image path."
      );
    }

    if (
      url.origin !==
      "https://salonai.invalid"
    ) {
      throw new Error(
        "Enter a valid app-relative image path."
      );
    }

    return `${url.pathname}${url.search}${url.hash}`;
  }

  let url;

  try {
    url =
      new URL(text);
  } catch {
    throw new Error(
      "Enter a valid HTTPS image URL."
    );
  }

  if (
    url.protocol !==
    "https:"
  ) {
    throw new Error(
      "Remote image URLs must use HTTPS."
    );
  }

  return url.toString();
}

export function uniqueCatalogueImages(
  images
) {
  return [
    ...new Set(
      (images || [])
        .map((image) =>
          String(
            image || ""
          ).trim()
        )
        .filter(Boolean)
    ),
  ];
}

export function makeCatalogueImagePrimary(
  images,
  index
) {
  const current =
    uniqueCatalogueImages(
      images
    );

  if (
    index <= 0 ||
    index >= current.length
  ) {
    return current;
  }

  return [
    current[index],
    ...current.filter(
      (
        _,
        itemIndex
      ) =>
        itemIndex !==
        index
    ),
  ];
}
