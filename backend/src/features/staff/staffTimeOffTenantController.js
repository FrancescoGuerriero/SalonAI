import {
  recordAuditEvent,
} from "../../services/auditService.js";
import {
  scopedTimeOffList,
} from "../../services/staffTimeOffAuthorityService.js";
import {
  createScopedTimeOff,
  scopedTimeOffRecord,
  updateScopedTimeOffStatus,
} from "../../services/staffTimeOffMutationService.js";

export async function listTimeOff(
  req,
  res
) {
  res.json({
    items:
      await scopedTimeOffList(
        req.query,
        req.effectiveAuthority
      ),
  });
}

export async function requestTimeOff(
  req,
  res
) {
  const request =
    await createScopedTimeOff(
      req.params.staffId,
      req.body,
      req.effectiveAuthority
    );

  await recordAuditEvent({
    req,
    action:
      "staff.time_off_requested",
    resourceType:
      "staffTimeOff",
    resourceId:
      request?._id,
    before: null,
    after:
      typeof request?.toObject === "function"
        ? request.toObject()
        : request,
    metadata: {
      scope:
        "tenant-schedule",
      staff:
        String(request?.staff || ""),
      business:
        String(request?.business || ""),
      location:
        String(request?.location || ""),
      status:
        request?.status,
    },
  });

  res.status(201).json(request);
}

export async function updateTimeOff(
  req,
  res
) {
  const before =
    await scopedTimeOffRecord(
      req.params.id,
      req.effectiveAuthority
    );

  const request =
    await updateScopedTimeOffStatus(
      req.params.id,
      req.body.status,
      req.user,
      req.effectiveAuthority
    );

  await recordAuditEvent({
    req,
    action:
      "staff.time_off_status_updated",
    resourceType:
      "staffTimeOff",
    resourceId:
      request?._id,
    before,
    after: request,
    metadata: {
      scope:
        "tenant-schedule",
      staff:
        String(request?.staff || ""),
      business:
        String(request?.business || ""),
      location:
        String(request?.location || ""),
      status:
        request?.status,
    },
  });

  res.json(request);
}

export default {
  listTimeOff,
  requestTimeOff,
  updateTimeOff,
};
