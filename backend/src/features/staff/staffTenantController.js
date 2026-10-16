import {
  recordAuditEvent,
} from "../../services/auditService.js";
import {
  scopedWeeklyAvailability,
} from "../../services/staffAvailabilityAuthorityService.js";
import {
  setScopedWeeklyAvailability,
} from "../../services/staffAvailabilityMutationService.js";

export async function week(
  req,
  res
) {
  res.json({
    items:
      await scopedWeeklyAvailability(
        req.params.staffId,
        req.effectiveAuthority
      ),
  });
}

export async function setAvailability(
  req,
  res
) {
  const staffId =
    req.params.staffId;

  const before =
    await scopedWeeklyAvailability(
      staffId,
      req.effectiveAuthority
    );

  const after =
    await setScopedWeeklyAvailability(
      staffId,
      req.body,
      req.effectiveAuthority
    );

  await recordAuditEvent({
    req,
    action:
      "staff.availability_updated",
    resourceType:
      "staffAvailability",
    resourceId:
      after?._id || staffId,
    before,
    after,
    metadata: {
      scope:
        "tenant-location",
      business:
        String(
          after?.business || ""
        ),
      location:
        String(
          after?.location || ""
        ),
      dayOfWeek:
        req.body?.dayOfWeek,
    },
  });

  res.json(after);
}

export default {
  setAvailability,
  week,
};
