import {
  ImagePlus,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import {
  useRef,
  useState,
} from "react";

import {
  MAX_PROFILE_DATA_URL_LENGTH,
  PROFILE_PHOTO_ACCEPT,
  isSupportedProfileFile,
  profileInitials,
} from "../../utils/profileMedia.js";

function readFileAsDataUrl(file) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () =>
        resolve(
          String(
            reader.result ||
              ""
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
        resolve(
          image
        );
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

async function optimiseProfilePhoto(file) {
  if (
    !isSupportedProfileFile(
      file
    )
  ) {
    throw new Error(
      "Choose a JPEG, PNG or WebP image no larger than 5 MB."
    );
  }

  const source =
    await readFileAsDataUrl(
      file
    );
  const image =
    await loadImage(
      source
    );

  const maximumDimension =
    720;
  const ratio = Math.min(
    1,
    maximumDimension /
      Math.max(
        image.naturalWidth ||
          image.width,
        image.naturalHeight ||
          image.height
      )
  );

  const width = Math.max(
    1,
    Math.round(
      (image.naturalWidth ||
        image.width) *
        ratio
    )
  );
  const height = Math.max(
    1,
    Math.round(
      (image.naturalHeight ||
        image.height) *
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

  let output =
    canvas.toDataURL(
      "image/jpeg",
      0.82
    );

  if (
    output.length >
    MAX_PROFILE_DATA_URL_LENGTH
  ) {
    output =
      canvas.toDataURL(
        "image/jpeg",
        0.68
      );
  }

  if (
    output.length >
    MAX_PROFILE_DATA_URL_LENGTH
  ) {
    throw new Error(
      "The optimised image is still too large. Try a smaller photograph."
    );
  }

  return output;
}

export default function ProfilePhotoUploader({
  value = "",
  onChange,
  name = "",
  label = "Profile photo",
  help =
    "JPEG, PNG or WebP. The image is resized in your browser before it is saved.",
  disabled = false,
}) {
  const inputRef =
    useRef(null);
  const [
    error,
    setError,
  ] = useState("");
  const [
    processing,
    setProcessing,
  ] = useState(false);

  async function handleFile(
    event
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setProcessing(
      true
    );

    try {
      const dataUrl =
        await optimiseProfilePhoto(
          file
        );

      onChange?.(
        dataUrl
      );
    } catch (
      uploadError
    ) {
      setError(
        uploadError.message ||
          "The photograph could not be prepared."
      );
    } finally {
      setProcessing(
        false
      );

      if (
        inputRef.current
      ) {
        inputRef.current.value =
          "";
      }
    }
  }

  return (
    <div className="profile-photo-field">
      <div className="profile-photo-preview">
        {value ? (
          <img
            src={value}
            alt={`${name || "Profile"} preview`}
          />
        ) : (
          <span
            aria-hidden="true"
          >
            {name ? (
              profileInitials(
                name
              )
            ) : (
              <UserRound
                size={40}
              />
            )}
          </span>
        )}
      </div>

      <div className="profile-photo-copy">
        <strong>
          <ImagePlus
            size={18}
          />
          {label}
        </strong>

        <p>{help}</p>

        <div className="profile-photo-actions">
          <label
            className={`app-button app-button-secondary profile-photo-upload${
              disabled ||
              processing
                ? " is-disabled"
                : ""
            }`}
          >
            <Upload
              size={16}
            />
            {processing
              ? "Preparing…"
              : value
                ? "Replace photo"
                : "Upload photo"}

            <input
              ref={inputRef}
              type="file"
              accept={
                PROFILE_PHOTO_ACCEPT
              }
              disabled={
                disabled ||
                processing
              }
              onChange={
                handleFile
              }
            />
          </label>

          {value ? (
            <button
              type="button"
              className="app-button app-button-secondary"
              disabled={
                disabled ||
                processing
              }
              onClick={() => {
                setError(
                  ""
                );
                onChange?.(
                  ""
                );
              }}
            >
              <Trash2
                size={16}
              />
              Remove
            </button>
          ) : null}
        </div>

        {error ? (
          <p
            className="profile-photo-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
