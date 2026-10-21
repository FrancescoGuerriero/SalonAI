import crypto from "node:crypto";

import {
  buildConsultationMediaProcessingEnvelope,
} from "./consultationMediaPolicy.js";

function runtimeError(message, code, statusCode = 502) {
  const error = new Error(message);
  error.code = code;
  error.status = statusCode;
  error.statusCode = statusCode;
  return error;
}

function requireBuffer(value) {
  if (!Buffer.isBuffer(value) || value.length === 0) {
    throw runtimeError(
      "Consultation media bytes are required for transient processing.",
      "CONSULTATION_MEDIA_BYTES_REQUIRED",
      400
    );
  }
  return value;
}

function safeObservation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw runtimeError(
      "The consultation media analyser returned an invalid observation.",
      "CONSULTATION_MEDIA_ANALYSIS_INVALID"
    );
  }

  return Object.freeze({
    summary: String(value.summary ?? "").trim().slice(0, 2000),
    confidence:
      Number.isFinite(Number(value.confidence))
        ? Math.max(0, Math.min(1, Number(value.confidence)))
        : null,
    attentionFlags: Object.freeze(
      (Array.isArray(value.attentionFlags) ? value.attentionFlags : [])
        .map((item) => String(item ?? "").trim().slice(0, 240))
        .filter(Boolean)
        .slice(0, 20)
    ),
    advisoryOnly: true,
    humanReviewRequired: true,
  });
}

export async function analyseConsultationMediaTransiently(
  { session, mediaItem, bytes } = {},
  { analyser } = {}
) {
  if (typeof analyser !== "function") {
    throw runtimeError(
      "A consultation media analyser is required.",
      "CONSULTATION_MEDIA_ANALYSER_REQUIRED",
      503
    );
  }

  const buffer = requireBuffer(bytes);
  const descriptor = {
    contentType: mediaItem?.contentType,
    byteLength: buffer.length,
    providerReference: mediaItem?.providerReference,
  };

  const envelope = buildConsultationMediaProcessingEnvelope({
    session,
    mediaItems: [descriptor],
  });

  const digest = crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");

  try {
    const observation = await analyser({
      envelope,
      media: Object.freeze({
        contentType: envelope.media[0].contentType,
        byteLength: buffer.length,
        sha256: digest,
        bytes: buffer,
      }),
    });

    return Object.freeze({
      capability: "consultation_media_assistance",
      consultationType: envelope.consultationType,
      definitionVersion: envelope.definitionVersion,
      mediaSha256: digest,
      observation: safeObservation(observation),
      persistence: Object.freeze({
        rawMediaStored: false,
        providerUrlStored: false,
        digestMayBeRetainedForAudit: true,
      }),
    });
  } finally {
    // Best-effort zeroisation of the transient in-process copy. Callers must
    // also dispose of any provider/download buffers they created upstream.
    buffer.fill(0);
  }
}

export default {
  analyseConsultationMediaTransiently,
};
