import Stylist from "../../models/Stylist.js";
import {
  recordAuditEvent,
} from "../../services/auditService.js";
import {
  scopedWorkforceFilter,
} from "../../services/workforceAuthorityService.js";
import {
  scopedTimeOffList,
} from "../../services/staffTimeOffAuthorityService.js";
import {
  createScopedTimeOff,
} from "../../services/staffTimeOffMutationService.js";
import {
  scopedSelfWeeklyAvailability,
  setScopedSelfWeeklyAvailability,
} from "../../services/staffSelfAvailabilityService.js";

function resourceNotFound() {
  const error = new Error("The requested resource was not found.");
  error.code = "RESOURCE_NOT_FOUND";
  error.statusCode = 404;
  return error;
}

async function ownedTenantStylist(req) {
  const stylist = await Stylist.findOne(
    scopedWorkforceFilter(
      req.effectiveAuthority,
      {
        userAccount: req.user?._id,
      }
    )
  )
    .select("_id business workingLocations firstName lastName email isActive")
    .lean();

  if (!stylist) {
    throw resourceNotFound();
  }

  return stylist;
}

export async function myWeek(req, res) {
  res.json(
    await scopedSelfWeeklyAvailability(
      req.user?._id,
      req.effectiveAuthority
    )
  );
}

export async function setMyAvailability(req, res) {
  const before = await scopedSelfWeeklyAvailability(
    req.user?._id,
    req.effectiveAuthority
  );

  const after = await setScopedSelfWeeklyAvailability(
    req.user?._id,
    req.body,
    req.effectiveAuthority
  );

  await recordAuditEvent({
    req,
    action: "staff.availability_updated",
    resourceType: "staffAvailability",
    resourceId: after?._id,
    before: before?.items || [],
    after,
    metadata: {
      scope: "self-tenant",
      business: String(after?.business || ""),
      location: String(after?.location || ""),
      dayOfWeek: req.body?.dayOfWeek,
    },
  });

  res.json(after);
}

export async function listMyTimeOff(req, res) {
  const stylist = await ownedTenantStylist(req);

  res.json({
    items: await scopedTimeOffList(
      {
        staff: stylist._id,
      },
      req.effectiveAuthority
    ),
  });
}

export async function requestMyTimeOff(req, res) {
  const stylist = await ownedTenantStylist(req);
  const request = await createScopedTimeOff(
    stylist._id,
    req.body,
    req.effectiveAuthority
  );

  await recordAuditEvent({
    req,
    action: "staff.time_off_requested",
    resourceType: "staffTimeOff",
    resourceId: request?._id,
    before: null,
    after:
      typeof request?.toObject === "function"
        ? request.toObject()
        : request,
    metadata: {
      scope: "self-tenant",
      staff: String(request?.staff || ""),
      business: String(request?.business || ""),
      location: String(request?.location || ""),
      status: request?.status,
    },
  });

  res.status(201).json(request);
}

export default {
  listMyTimeOff,
  myWeek,
  requestMyTimeOff,
  setMyAvailability,
};
