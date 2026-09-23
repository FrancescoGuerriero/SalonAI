import mongoose from "mongoose";

import Customer from "../models/customer.js";
import PrivacyRequest, {
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
} from "../models/PrivacyRequest.js";

function text(value, max = 4000) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function httpError(
  message,
  statusCode,
  code
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function addOneCalendarMonth(
  value = new Date()
) {
  const date = new Date(value);
  date.setUTCMonth(
    date.getUTCMonth() + 1
  );
  return date;
}

async function customerForUser(
  user
) {
  if (!user?._id) {
    return null;
  }

  if (user.customerProfile) {
    const linked =
      await Customer.findById(
        user.customerProfile
      );
    if (linked) return linked;
  }

  return Customer.findOne({
    $or: [
      {
        userAccount:
          user._id,
      },
      ...(user.email
        ? [
            {
              email:
                String(
                  user.email
                )
                  .trim()
                  .toLowerCase(),
            },
          ]
        : []),
    ],
  });
}

function serialiseCustomerRequest(
  request
) {
  return {
    id: request._id,
    requestType:
      request.requestType,
    status:
      request.status,
    details:
      request.details,
    responseSummary:
      request.responseSummary,
    policyVersion:
      request.policyVersion,
    receivedAt:
      request.receivedAt,
    targetResponseAt:
      request.targetResponseAt,
    completedAt:
      request.completedAt,
    createdAt:
      request.createdAt,
    updatedAt:
      request.updatedAt,
  };
}

export async function createMyPrivacyRequest(
  req,
  res
) {
  const requestType =
    text(
      req.body?.requestType,
      80
    ).toLowerCase();

  if (
    !PRIVACY_REQUEST_TYPES
      .includes(requestType)
  ) {
    throw httpError(
      "Select a valid privacy request type.",
      422,
      "PRIVACY_REQUEST_TYPE_INVALID"
    );
  }

  const customer =
    await customerForUser(
      req.user
    );
  const receivedAt =
    new Date();

  const request =
    await PrivacyRequest.create({
      requester:
        req.user._id,
      customerProfile:
        customer?._id ||
        null,
      requestType,
      details:
        text(
          req.body?.details,
          4000
        ),
      status:
        "received",
      policyVersion:
        process.env
          .PRIVACY_POLICY_VERSION ||
        "2026-09",
      receivedAt,
      targetResponseAt:
        addOneCalendarMonth(
          receivedAt
        ),
      createdBy:
        req.user._id,
      updatedBy:
        req.user._id,
    });

  return res
    .status(201)
    .json({
      success: true,
      privacyRequest:
        serialiseCustomerRequest(
          request
        ),
    });
}

export async function listMyPrivacyRequests(
  req,
  res
) {
  const requests =
    await PrivacyRequest.find({
      requester:
        req.user._id,
    })
      .sort({
        createdAt: -1,
      })
      .limit(100);

  return res.json({
    success: true,
    privacyRequests:
      requests.map(
        serialiseCustomerRequest
      ),
  });
}

export async function listPrivacyRequests(
  req,
  res
) {
  const status =
    text(
      req.query?.status,
      80
    ).toLowerCase();

  const filter = {};

  if (
    status &&
    PRIVACY_REQUEST_STATUSES
      .includes(status)
  ) {
    filter.status =
      status;
  }

  const requests =
    await PrivacyRequest.find(
      filter
    )
      .select(
        "+internalNotes"
      )
      .populate(
        "requester",
        "name email role"
      )
      .populate(
        "customerProfile",
        "firstName lastName email phone"
      )
      .sort({
        createdAt: -1,
      })
      .limit(250);

  return res.json({
    success: true,
    privacyRequests:
      requests,
  });
}

export async function updatePrivacyRequest(
  req,
  res
) {
  const id =
    String(
      req.params?.id ||
      ""
    ).trim();

  if (
    !mongoose
      .isObjectIdOrHexString(id)
  ) {
    throw httpError(
      "A valid privacy request identifier is required.",
      400,
      "PRIVACY_REQUEST_ID_INVALID"
    );
  }

  const request =
    await PrivacyRequest.findById(
      new mongoose.Types.ObjectId(
        id
      )
    ).select(
      "+internalNotes"
    );

  if (!request) {
    throw httpError(
      "Privacy request not found.",
      404,
      "PRIVACY_REQUEST_NOT_FOUND"
    );
  }

  const status =
    text(
      req.body?.status,
      80
    ).toLowerCase();

  if (
    status &&
    !PRIVACY_REQUEST_STATUSES
      .includes(status)
  ) {
    throw httpError(
      "Select a valid privacy request status.",
      422,
      "PRIVACY_REQUEST_STATUS_INVALID"
    );
  }

  if (status) {
    request.status =
      status;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      req.body || {},
      "responseSummary"
    )
  ) {
    request.responseSummary =
      text(
        req.body.responseSummary,
        4000
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      req.body || {},
      "internalNotes"
    )
  ) {
    request.internalNotes =
      text(
        req.body.internalNotes,
        4000
      );
  }

  if (
    request.status ===
      "completed" &&
    !request.completedAt
  ) {
    request.completedAt =
      new Date();
  }

  if (
    request.status !==
      "completed"
  ) {
    request.completedAt =
      null;
  }

  request.updatedBy =
    req.user._id;

  await request.save();

  return res.json({
    success: true,
    privacyRequest:
      request,
  });
}

export default {
  createMyPrivacyRequest,
  listMyPrivacyRequests,
  listPrivacyRequests,
  updatePrivacyRequest,
};
