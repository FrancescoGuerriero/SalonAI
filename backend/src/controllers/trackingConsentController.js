import TrackingConsentReceipt from "../models/TrackingConsentReceipt.js";

function text(
  value,
  maxLength
) {
  return String(value ?? "")
    .trim()
    .slice(
      0,
      maxLength
    );
}

function httpError(
  message,
  statusCode,
  code
) {
  const error =
    new Error(message);
  error.statusCode =
    statusCode;
  error.code = code;
  return error;
}

export async function recordTrackingConsent(
  req,
  res
) {
  const receiptId =
    text(
      req.body?.receiptId,
      128
    );
  const version =
    text(
      req.body?.version,
      100
    );
  const source =
    text(
      req.body?.source,
      80
    ) ||
    "consent_banner";
  const choices =
    req.body?.choices &&
    typeof req.body.choices ===
      "object"
      ? req.body.choices
      : {};

  if (
    !/^[A-Za-z0-9_-]{12,128}$/.test(
      receiptId
    )
  ) {
    throw httpError(
      "A valid tracking-consent receipt identifier is required.",
      422,
      "TRACKING_CONSENT_RECEIPT_INVALID"
    );
  }

  if (!version) {
    throw httpError(
      "A tracking-consent version is required.",
      422,
      "TRACKING_CONSENT_VERSION_REQUIRED"
    );
  }

  const consentUpdatedAt =
    new Date(
      req.body
        ?.updatedAt ||
      Date.now()
    );

  if (
    Number.isNaN(
      consentUpdatedAt.getTime()
    )
  ) {
    throw httpError(
      "The tracking-consent timestamp is invalid.",
      422,
      "TRACKING_CONSENT_TIMESTAMP_INVALID"
    );
  }

  const receipt =
    await TrackingConsentReceipt.findOneAndUpdate(
      {
        receiptId,
      },
      {
        $set: {
          version,
          necessary: true,
          choices: {
            analytics:
              choices.analytics ===
              true,
            advertising:
              choices.advertising ===
              true,
            experience:
              choices.experience ===
              true,
          },
          source,
          consentUpdatedAt,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert:
          true,
      }
    );

  return res
    .status(201)
    .json({
      success: true,
      receipt: {
        receiptId:
          receipt.receiptId,
        version:
          receipt.version,
        choices:
          receipt.choices,
        consentUpdatedAt:
          receipt.consentUpdatedAt,
      },
    });
}

export default {
  recordTrackingConsent,
};
