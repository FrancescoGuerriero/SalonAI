import mongoose from "mongoose";

import StaffShift from "../features/staffRota/StaffShift.js";
import {
  assertStaffScheduleRecordAuthority,
} from "./staffScheduleAuthorityService.js";

function authorityError(
  message,
  code,
  statusCode
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function idText(value) {
  const candidate =
    value &&
    typeof value === "object" &&
    "_id" in value
      ? value._id
      : value;

  return String(candidate || "").trim();
}

function resourceNotFound() {
  return authorityError(
    "The requested resource was not found.",
    "RESOURCE_NOT_FOUND",
    404
  );
}

export function assertRotaShiftMutationRecord(
  authority,
  shift
) {
  if (!shift) {
    throw resourceNotFound();
  }

  return assertStaffScheduleRecordAuthority(
    authority,
    shift,
    {
      locationField: "locationRef",
    }
  );
}

export function assertNoUnscopedRotaStaffReassignment(
  payload = {},
  currentStaffId
) {
  const hasStaffId =
    Object.prototype.hasOwnProperty.call(
      payload,
      "staffId"
    );
  const hasStaff =
    Object.prototype.hasOwnProperty.call(
      payload,
      "staff"
    );

  if (!hasStaffId && !hasStaff) {
    return true;
  }

  const requestedStaffId = idText(
    hasStaffId
      ? payload.staffId
      : payload.staff
  );
  const existingStaffId = idText(
    currentStaffId
  );

  if (
    requestedStaffId &&
    requestedStaffId !== existingStaffId
  ) {
    throw authorityError(
      "Staff reassignment requires a tenant-scoped rota reassignment workflow.",
      "ROTA_STAFF_REASSIGNMENT_REQUIRES_SCOPED_WORKFLOW",
      409
    );
  }

  return true;
}

export async function scopedRotaShiftMutationTarget(
  shiftId,
  authority,
  payload = {}
) {
  if (!mongoose.isValidObjectId(shiftId)) {
    throw resourceNotFound();
  }

  const businessId = idText(
    authority?.businessId
  );

  if (!businessId) {
    throw authorityError(
      "Trusted effective authority is required for rota mutation scoping.",
      "STAFF_ROTA_AUTHORITY_REQUIRED",
      401
    );
  }

  const shift = await StaffShift.findOne({
    _id: shiftId,
    business: businessId,
  })
    .select(
      "_id business locationRef staff"
    )
    .lean();

  if (!shift) {
    throw resourceNotFound();
  }

  assertRotaShiftMutationRecord(
    authority,
    shift
  );

  assertNoUnscopedRotaStaffReassignment(
    payload,
    shift.staff
  );

  return shift;
}

export default {
  assertNoUnscopedRotaStaffReassignment,
  assertRotaShiftMutationRecord,
  scopedRotaShiftMutationTarget,
};
