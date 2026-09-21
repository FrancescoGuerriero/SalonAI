import Stylist from "../../models/Stylist.js";
import {
  recordAuditEvent,
} from "../../services/auditService.js";
import * as service from "./staffService.js";

function createHttpError(
  message,
  statusCode
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;
  error.status =
    statusCode;

  return error;
}

function plain(value) {
  if (
    value &&
    typeof value.toObject ===
      "function"
  ) {
    return value.toObject();
  }

  return value;
}

async function ownedStylist(
  user
) {
  if (!user?._id) {
    throw createHttpError(
      "Authentication is required.",
      401
    );
  }

  const stylist =
    await Stylist.findOne({
      userAccount:
        user._id,
    })
      .select(
        "_id firstName lastName email isActive"
      )
      .lean();

  if (!stylist) {
    throw createHttpError(
      "No staff profile is linked to this account. Ask the Super Admin to link the employee account before using schedule self-service.",
      404
    );
  }

  return stylist;
}

async function auditAvailability(
  req,
  {
    staffId,
    before,
    after,
    scope,
  }
) {
  await recordAuditEvent({
    req,
    action:
      "staff.availability_updated",
    resourceType:
      "staffAvailability",
    resourceId:
      staffId,
    before,
    after:
      plain(after),
    metadata: {
      scope,
      dayOfWeek:
        req.body?.dayOfWeek,
    },
  });
}

async function auditTimeOff(
  req,
  {
    action,
    request,
    before = null,
    scope,
  }
) {
  const after =
    plain(request);

  await recordAuditEvent({
    req,
    action,
    resourceType:
      "staffTimeOff",
    resourceId:
      after?._id,
    before,
    after,
    metadata: {
      scope,
      staff:
        String(
          after?.staff || ""
        ),
      status:
        after?.status,
    },
  });
}

export async function setAvailability(
  req,
  res
) {
  const staffId =
    req.params.staffId;

  const before =
    await service.weeklyAvailability(
      staffId
    );

  const after =
    await service.setWeeklyAvailability(
      staffId,
      req.body
    );

  await auditAvailability(
    req,
    {
      staffId,
      before,
      after,
      scope:
        "all-staff",
    }
  );

  res.json(after);
}

export async function week(
  req,
  res
) {
  res.json({
    items:
      await service.weeklyAvailability(
        req.params.staffId
      ),
  });
}

export async function day(
  req,
  res
) {
  res.json(
    await service.dayAvailability(
      req.params.staffId,
      req.query.date
    )
  );
}

export async function requestTimeOff(
  req,
  res
) {
  const request =
    await service.requestTimeOff(
      req.params.staffId,
      req.body
    );

  await auditTimeOff(
    req,
    {
      action:
        "staff.time_off_requested",
      request,
      scope:
        "all-staff",
    }
  );

  res.status(201).json(
    request
  );
}

export async function updateTimeOff(
  req,
  res
) {
  const before =
    await service.getTimeOff(
      req.params.id
    );

  const request =
    await service.updateTimeOff(
      req.params.id,
      req.body.status,
      req.user
    );

  await auditTimeOff(
    req,
    {
      action:
        "staff.time_off_status_updated",
      request,
      before,
      scope:
        "all-staff",
    }
  );

  res.json(request);
}

export async function listTimeOff(
  req,
  res
) {
  res.json({
    items:
      await service.listTimeOff(
        req.query
      ),
  });
}

export async function listCalendarBlocks(
  req,
  res
) {
  res.json({
    items:
      await service.calendarScheduleBlocks(
        req.query
      ),
  });
}

export async function createCalendarBlock(
  req,
  res
) {
  const request =
    await service.createScheduleBlock(
      req.params.staffId,
      req.body,
      req.user
    );

  await auditTimeOff(
    req,
    {
      action:
        "staff.schedule_block_created",
      request,
      scope:
        "all-staff",
    }
  );

  res
    .status(201)
    .json(request);
}

export async function cancelCalendarBlock(
  req,
  res
) {
  const before =
    await service.getTimeOff(
      req.params.id
    );

  const request =
    await service.updateTimeOff(
      req.params.id,
      "cancelled",
      req.user
    );

  await auditTimeOff(
    req,
    {
      action:
        "staff.schedule_block_cancelled",
      request,
      before,
      scope:
        "all-staff",
    }
  );

  res.json(request);
}

export async function myWeek(
  req,
  res
) {
  const stylist =
    await ownedStylist(
      req.user
    );

  res.json({
    staff: stylist,
    items:
      await service.weeklyAvailabilityWithFallback(
        stylist._id
      ),
  });
}

export async function setMyAvailability(
  req,
  res
) {
  const stylist =
    await ownedStylist(
      req.user
    );

  const before =
    await service.weeklyAvailability(
      stylist._id
    );

  const after =
    await service.setWeeklyAvailability(
      stylist._id,
      req.body
    );

  await auditAvailability(
    req,
    {
      staffId:
        stylist._id,
      before,
      after,
      scope:
        "self",
    }
  );

  res.json(after);
}

export async function myDay(
  req,
  res
) {
  const stylist =
    await ownedStylist(
      req.user
    );

  res.json(
    await service.dayAvailability(
      stylist._id,
      req.query.date
    )
  );
}

export async function listMyTimeOff(
  req,
  res
) {
  const stylist =
    await ownedStylist(
      req.user
    );

  res.json({
    items:
      await service.listTimeOff({
        staff:
          stylist._id,
      }),
  });
}

export async function requestMyTimeOff(
  req,
  res
) {
  const stylist =
    await ownedStylist(
      req.user
    );

  const request =
    await service.requestTimeOff(
      stylist._id,
      {
        ...req.body,
        status:
          "requested",
      }
    );

  await auditTimeOff(
    req,
    {
      action:
        "staff.time_off_requested",
      request,
      scope:
        "self",
    }
  );

  res.status(201).json(
    request
  );
}
