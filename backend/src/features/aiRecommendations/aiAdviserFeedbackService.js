import mongoose from "mongoose";

import AiInferenceLog from "../aiPlatform/AiInferenceLog.js";

const CAPABILITY =
  "management-adviser";
const MAX_COMMENT_LENGTH =
  1000;

function httpError(
  message,
  statusCode,
  code
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;
  error.status =
    statusCode;
  error.code =
    code;

  return error;
}

export function normaliseAdviserFeedback({
  rating,
  comment = "",
} = {}) {
  const numericRating =
    Number(rating);

  if (
    numericRating !== 1 &&
    numericRating !== -1
  ) {
    throw httpError(
      "Adviser feedback rating must be 1 (useful) or -1 (not useful).",
      400,
      "INVALID_ADVISER_FEEDBACK"
    );
  }

  const safeComment =
    String(
      comment ?? ""
    ).trim();

  if (
    safeComment.length >
    MAX_COMMENT_LENGTH
  ) {
    throw httpError(
      `Adviser feedback comments must be ${MAX_COMMENT_LENGTH} characters or fewer.`,
      400,
      "INVALID_ADVISER_FEEDBACK"
    );
  }

  return {
    rating:
      numericRating,
    useful:
      numericRating === 1,
    comment:
      safeComment,
  };
}

export async function submitAdviserFeedback({
  inferenceId,
  rating,
  comment = "",
  user,
} = {}) {
  const actorUserId =
    user?._id;

  if (!actorUserId) {
    throw httpError(
      "Authentication is required to submit Adviser feedback.",
      401,
      "AUTHENTICATION_REQUIRED"
    );
  }

  const safeInferenceId =
    String(
      inferenceId || ""
    ).trim();

  if (
    !mongoose.Types
      .ObjectId.isValid(
        safeInferenceId
      )
  ) {
    throw httpError(
      "Adviser response not found.",
      404,
      "ADVISER_INFERENCE_NOT_FOUND"
    );
  }

  const feedback =
    normaliseAdviserFeedback({
      rating,
      comment,
    });
  const submittedAt =
    new Date();

  const inference =
    await AiInferenceLog
      .findOneAndUpdate(
        {
          _id:
            safeInferenceId,
          capability:
            CAPABILITY,
          "context.actorUserId":
            actorUserId,
        },
        {
          $set: {
            "feedback.rating":
              feedback.rating,
            "feedback.useful":
              feedback.useful,
            "feedback.comment":
              feedback.comment,
            "feedback.submittedAt":
              submittedAt,
          },
        },
        {
          new: true,
          runValidators: true,
        }
      )
      .select(
        "_id feedback"
      )
      .lean();

  if (!inference) {
    throw httpError(
      "Adviser response not found.",
      404,
      "ADVISER_INFERENCE_NOT_FOUND"
    );
  }

  return {
    inferenceId:
      String(
        inference._id
      ),
    feedback: {
      rating:
        inference.feedback
          ?.rating ??
        feedback.rating,
      useful:
        inference.feedback
          ?.useful ??
        feedback.useful,
      comment:
        inference.feedback
          ?.comment ??
        feedback.comment,
      submittedAt:
        inference.feedback
          ?.submittedAt ||
        submittedAt,
    },
  };
}

export default {
  normaliseAdviserFeedback,
  submitAdviserFeedback,
};
