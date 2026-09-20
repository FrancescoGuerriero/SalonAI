import {
  ImagePlus,
  Link as LinkIcon,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useRef,
  useState,
} from "react";

const ACCEPTED_IMAGE_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

const MAX_SOURCE_BYTES =
  5 * 1024 * 1024;
const MAX_DIMENSION = 1080;
const MAX_DATA_URL_LENGTH =
  280_000;
const DEFAULT_MAX_IMAGES = 6;

function readFileAsDataUrl(file) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () =>
        resolve(
          String(
            reader.result || ""
          )
        );

      reader.onerror = () =>
        reject(
          new Error(
            "The selected image could not be read."
          )
        );

      reader.readAsDataURL(
        file
      );
    }
  );
}

function loadImage(source) {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image();

      image.onload = () =>
        resolve(image);

      image.onerror = () =>
        reject(
          new Error(
            "The selected file is not a readable image."
          )
        );

      image.src = source;
    }
  );
}

function validateSourceFile(file) {
  if (
    !file ||
    !ACCEPTED_IMAGE_TYPES.has(
      file.type
    )
  ) {
    throw new Error(
      "Choose a JPEG, PNG or WebP image."
    );
  }

  if (
    file.size >
    MAX_SOURCE_BYTES
  ) {
    throw new Error(
      "Choose an image no larger than 5 MB."
    );
  }
}

async function optimiseImage(
  file
) {
  validateSourceFile(
    file
  );

  const source =
    await readFileAsDataUrl(
      file
    );

  const image =
    await loadImage(
      source
    );

  const naturalWidth =
    image.naturalWidth ||
    image.width;
  const naturalHeight =
    image.naturalHeight ||
    image.height;

  const ratio =
    Math.min(
      1,
      MAX_DIMENSION /
        Math.max(
          naturalWidth,
          naturalHeight
        )
    );

  const width =
    Math.max(
      1,
      Math.round(
        naturalWidth *
        ratio
      )
    );
  const height =
    Math.max(
      1,
      Math.round(
        naturalHeight *
        ratio
      )
    );

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = width;
  canvas.height = height;

  const context =
    canvas.getContext(
      "2d",
      {
        alpha: false,
      }
    );

  if (!context) {
    throw new Error(
      "Your browser could not prepare this image."
    );
  }

  context.fillStyle =
    "#ffffff";
  context.fillRect(
    0,
    0,
    width,
    height
  );
  context.drawImage(
    image,
    0,
    0,
    width,
    height
  );

  let output = "";

  for (const quality of [
    0.82,
    0.72,
    0.62,
    0.52,
  ]) {
    output =
      canvas.toDataURL(
        "image/jpeg",
        quality
      );

    if (
      output.length <=
      MAX_DATA_URL_LENGTH
    ) {
      return output;
    }
  }

  throw new Error(
    "The optimised image is still too large. Try a smaller image."
  );
}

function normaliseUrl(
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
    text.startsWith("/")
  ) {
    return text;
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

function uniqueImages(
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

export default function CatalogueImagePicker({
  images = [],
  onChange,
  multiple = false,
  disabled = false,
  label = "Images",
  maxImages =
    DEFAULT_MAX_IMAGES,
  help =
    "Upload JPEG, PNG or WebP images, or add an existing HTTPS/app image path.",
}) {
  const fileInputRef =
    useRef(null);

  const [
    urlValue,
    setUrlValue,
  ] = useState("");

  const [
    processing,
    setProcessing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const current =
    uniqueImages(
      images
    );

  function commit(
    nextImages
  ) {
    const unique =
      uniqueImages(
        nextImages
      );

    const bounded =
      multiple
        ? unique.slice(
            0,
            maxImages
          )
        : unique.slice(
            0,
            1
          );

    onChange?.(
      bounded
    );
  }

  async function handleFiles(
    event
  ) {
    const files =
      Array.from(
        event.target.files ||
          []
      );

    if (!files.length) {
      return;
    }

    setError("");
    setProcessing(true);

    try {
      const availableSlots =
        multiple
          ? Math.max(
              0,
              maxImages -
                current.length
            )
          : 1;

      if (
        availableSlots === 0
      ) {
        throw new Error(
          `You can add up to ${maxImages} images.`
        );
      }

      const selected =
        files.slice(
          0,
          availableSlots
        );

      const prepared =
        [];

      for (
        const file
        of selected
      ) {
        prepared.push(
          await optimiseImage(
            file
          )
        );
      }

      commit(
        multiple
          ? [
              ...current,
              ...prepared,
            ]
          : prepared
      );
    } catch (
      uploadError
    ) {
      setError(
        uploadError?.message ||
          "The image could not be prepared."
      );
    } finally {
      setProcessing(false);

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    }
  }

  function addUrl() {
    setError("");

    try {
      const next =
        normaliseUrl(
          urlValue
        );

      if (
        multiple &&
        current.length >=
          maxImages
      ) {
        throw new Error(
          `You can add up to ${maxImages} images.`
        );
      }

      commit(
        multiple
          ? [
              ...current,
              next,
            ]
          : [
              next,
            ]
      );

      setUrlValue("");
    } catch (
      urlError
    ) {
      setError(
        urlError?.message ||
          "The image URL is invalid."
      );
    }
  }

  function removeImage(
    index
  ) {
    commit(
      current.filter(
        (
          _,
          itemIndex
        ) =>
          itemIndex !==
          index
      )
    );
  }

  function makePrimary(
    index
  ) {
    if (
      index <= 0 ||
      index >=
        current.length
    ) {
      return;
    }

    const next = [
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

    commit(next);
  }

  return (
    <div className="sm:col-span-2 rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <div className="flex flex-col gap-1">
        <strong className="text-sm font-bold text-black">
          {label}
        </strong>
        <p className="text-xs leading-5 text-stone-600">
          {help}
        </p>
      </div>

      {current.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {current.map(
            (
              image,
              index
            ) => (
              <article
                key={`${image}-${index}`}
                className="overflow-hidden rounded-xl border border-stone-200 bg-white"
              >
                <div className="relative aspect-[4/3] bg-stone-100">
                  <img
                    src={image}
                    alt={`${label} preview ${index + 1}`}
                    className="h-full w-full object-cover"
                  />

                  {multiple &&
                  index === 0 ? (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/80 px-2 py-1 text-[11px] font-bold text-white">
                      <Star
                        size={12}
                        aria-hidden="true"
                      />
                      Primary
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 p-3">
                  {multiple &&
                  index > 0 ? (
                    <button
                      type="button"
                      disabled={
                        disabled ||
                        processing
                      }
                      onClick={() =>
                        makePrimary(
                          index
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs font-semibold text-black hover:bg-amber-50 disabled:opacity-50"
                    >
                      <Star
                        size={14}
                      />
                      Set primary
                    </button>
                  ) : null}

                  <button
                    type="button"
                    disabled={
                      disabled ||
                      processing
                    }
                    onClick={() =>
                      removeImage(
                        index
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2
                      size={14}
                    />
                    Remove
                  </button>
                </div>
              </article>
            )
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-500">
          No image added yet.
        </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
        <label
          className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-black bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 ${
            disabled ||
            processing
              ? "pointer-events-none opacity-50"
              : ""
          }`}
        >
          <ImagePlus
            size={17}
          />
          {processing
            ? "Preparing…"
            : multiple
              ? "+ Add image"
              : current.length
                ? "Replace image"
                : "+ Add image"}

          <input
            ref={
              fileInputRef
            }
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={
              multiple
            }
            disabled={
              disabled ||
              processing
            }
            onChange={
              handleFiles
            }
            className="sr-only"
          />
        </label>

        <label className="relative block">
          <span className="sr-only">
            Image URL
          </span>
          <LinkIcon
            size={16}
            className="pointer-events-none absolute left-3 top-3 text-stone-500"
          />
          <input
            type="text"
            value={
              urlValue
            }
            disabled={
              disabled ||
              processing
            }
            onChange={(
              event
            ) =>
              setUrlValue(
                event.target
                  .value
              )
            }
            onKeyDown={(
              event
            ) => {
              if (
                event.key ===
                "Enter"
              ) {
                event.preventDefault();
                addUrl();
              }
            }}
            placeholder="https://... or /products/..."
            className="w-full rounded-xl border border-stone-300 bg-white py-2.5 pl-9 pr-3 text-sm text-black"
          />
        </label>

        <button
          type="button"
          disabled={
            disabled ||
            processing ||
            !urlValue.trim() ||
            (
              multiple &&
              current.length >=
                maxImages
            )
          }
          onClick={
            addUrl
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-stone-100 disabled:opacity-50"
        >
          <Upload
            size={16}
          />
          Add URL
        </button>
      </div>

      {error ? (
        <p
          className="mt-3 text-sm font-semibold text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
