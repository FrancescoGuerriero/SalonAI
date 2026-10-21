import {
  requireConsultationDefinition,
} from "./consultationDefinitionRegistry.js";

const FINAL_STATUSES = new Set([
  "booking_ready",
  "booked",
  "closed",
  "archived",
]);

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

function mediaError(message, code, statusCode = 409) {
  const error = new Error(message);
  error.code = code;
  error.status = statusCode;
  error.statusCode = statusCode;
  return error;
}

function text(value) {
  return String(value ?? "").trim();
}

export function consultationMediaPolicy(session) {
  const definition = requireConsultationDefinition(
    session?.consultationType,
    session?.definitionVersion
  );

  return Object.freeze({
    enabled: definition.media?.enabled === true,
    consentRequired: definition.media?.consentRequired !== false,
    maxItems: Math.max(0, Number(definition.media?.maxItems) || 0),
    maxBytesPerItem: DEFAULT_MAX_BYTES,
    acceptedContentTypes: Object.freeze([
      ...(definition.media?.acceptedContentTypes || []),
    ]),
  });
}

export function assertConsultationMediaProcessingAllowed(
  session,
  mediaItems = []
) {
  if (!session) {
    throw mediaError(
      "A consultation session is required for media processing.",
      "CONSULTATION_MEDIA_SESSION_REQUIRED",
      400
    );
  }

  const policy = consultationMediaPolicy(session);
  if (!policy.enabled) {
    throw mediaError(
      "Media assistance is not enabled for this consultation definition.",
      "CONSULTATION_MEDIA_DISABLED"
    );
  }

  if (
    policy.consentRequired &&
    session.governance?.mediaProcessingConsent !== true
  ) {
    throw mediaError(
      "Recorded media-processing consent is required before consultation images can be processed.",
      "CONSULTATION_MEDIA_CONSENT_REQUIRED"
    );
  }

  if (FINAL_STATUSES.has(session.status)) {
    throw mediaError(
      "Media assistance cannot run against a finalised consultation session.",
      "CONSULTATION_MEDIA_SESSION_FINALISED"
    );
  }

  if (!Array.isArray(mediaItems) || mediaItems.length === 0) {
    throw mediaError(
      "At least one consultation media item is required.",
      "CONSULTATION_MEDIA_REQUIRED",
      400
    );
  }

  if (mediaItems.length > policy.maxItems) {
    throw mediaError(
      `No more than ${policy.maxItems} consultation media items may be processed at once.`,
      "CONSULTATION_MEDIA_LIMIT_EXCEEDED",
      400
    );
  }

  return Object.freeze(
    mediaItems.map((item, index) => {
      const contentType = text(item?.contentType).toLowerCase();
      const byteLength = Number(item?.byteLength);
      const providerReference = text(item?.providerReference);

      if (!policy.acceptedContentTypes.includes(contentType)) {
        throw mediaError(
          `Media item ${index + 1} has an unsupported content type.`,
          "CONSULTATION_MEDIA_TYPE_UNSUPPORTED",
          415
        );
      }
      if (
        !Number.isSafeInteger(byteLength) ||
        byteLength <= 0 ||
        byteLength > policy.maxBytesPerItem
      ) {
        throw mediaError(
          `Media item ${index + 1} exceeds the consultation media size policy.`,
          "CONSULTATION_MEDIA_SIZE_INVALID",
          413
        );
      }
      if (!providerReference || providerReference.length > 300) {
        throw mediaError(
          `Media item ${index + 1} requires an opaque provider reference.`,
          "CONSULTATION_MEDIA_REFERENCE_INVALID",
          400
        );
      }
      if (/^https?:\/\//i.test(providerReference)) {
        throw mediaError(
          "Provider media URLs must not be persisted as consultation media references.",
          "CONSULTATION_MEDIA_URL_PERSISTENCE_FORBIDDEN",
          400
        );
      }

      return Object.freeze({
        contentType,
        byteLength,
        providerReference,
        purpose: "consultation-assistance",
        persistence: "temporary-private-only",
      });
    })
  );
}

export function buildConsultationMediaProcessingEnvelope({
  session,
  mediaItems,
} = {}) {
  const validated = assertConsultationMediaProcessingAllowed(
    session,
    mediaItems
  );

  return Object.freeze({
    capability: "consultation_media_assistance",
    consultationType: session.consultationType,
    definitionVersion: session.definitionVersion,
    tenantContext: Object.freeze({
      businessId: String(session.business),
      locationId: String(session.location),
    }),
    media: validated,
    constraints: Object.freeze({
      humanReviewRequired: true,
      canonicalWritesAllowed: false,
      medicalDiagnosisAllowed: false,
      safetyRuleOverrideAllowed: false,
      temporaryPrivateStorageRequired: true,
      rawMediaPersistenceAllowed: false,
    }),
  });
}

export default {
  assertConsultationMediaProcessingAllowed,
  buildConsultationMediaProcessingEnvelope,
  consultationMediaPolicy,
};
