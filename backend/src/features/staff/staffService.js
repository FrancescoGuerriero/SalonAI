import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import Stylist from "../../models/Stylist.js";
import StaffAvailability from "./StaffAvailability.js";
import StaffTimeOff, {
  STAFF_SCHEDULE_BLOCK_TYPES,
} from "./StaffTimeOff.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import {
  salonDateAnchor,
  salonDayBounds,
  salonDayOfWeek,
  salonMinutesSinceMidnight,
  sameSalonDay,
} from "../../shared/salonTime.js";
import { userId } from "../../shared/modelHelpers.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function parseDate(value, fieldName) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createServiceError(
      `${fieldName} must be a valid date.`,
      400,
      { field: fieldName }
    );
  }

  return date;
}

function normaliseScheduleBlockType(
  value
) {
  const blockType =
    String(
      value || "other"
    )
      .trim()
      .toLowerCase()
      .replaceAll("-", "_");

  if (
    !STAFF_SCHEDULE_BLOCK_TYPES.includes(
      blockType
    )
  ) {
    throw createServiceError(
      "Schedule block type is invalid.",
      400,
      {
        field:
          "blockType",
      }
    );
  }

  return blockType;
}

function scheduleBlockLabel(
  block
) {
  const blockType =
    block?.blockType ||
    "time_off";

  if (
    [
      "time_off",
      "personal",
    ].includes(
      blockType
    )
  ) {
    return "Unavailable";
  }

  const fallback = {
    meeting: "Meeting",
    training: "Training",
    other: "Blocked time",
  };

  return (
    String(
      block?.title || ""
    ).trim() ||
    fallback[blockType] ||
    "Blocked time"
  );
}

function validateScheduleBlockWindow(
  payload = {}
) {
  const startsAt =
    parseDate(
      payload.startsAt,
      "startsAt"
    );
  const endsAt =
    parseDate(
      payload.endsAt,
      "endsAt"
    );

  if (
    endsAt <= startsAt
  ) {
    throw createServiceError(
      "Schedule block end must be after its start.",
      400
    );
  }

  return {
    startsAt,
    endsAt,
  };
}

function timeToMinutes(value, fieldName) {
  const time = String(value || "").trim();

  if (!TIME_PATTERN.test(time)) {
    throw createServiceError(
      `${fieldName} must use HH:mm format.`,
      400,
      { field: fieldName }
    );
  }

  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function validateRanges(ranges = []) {
  if (!Array.isArray(ranges)) {
    throw createServiceError(
      "Availability ranges must be an array.",
      400,
      { field: "ranges" }
    );
  }

  const normalised = ranges.map((range, index) => {
    const start = String(range?.start || "").trim();
    const end = String(range?.end || "").trim();
    const startMinutes = timeToMinutes(start, `ranges[${index}].start`);
    const endMinutes = timeToMinutes(end, `ranges[${index}].end`);

    if (endMinutes <= startMinutes) {
      throw createServiceError(
        "Each availability range must end after it starts.",
        400,
        { field: `ranges[${index}]` }
      );
    }

    return { start, end, startMinutes, endMinutes };
  });

  normalised.sort((left, right) => left.startMinutes - right.startMinutes);

  for (let index = 1; index < normalised.length; index += 1) {
    if (normalised[index].startMinutes < normalised[index - 1].endMinutes) {
      throw createServiceError(
        "Availability ranges must not overlap.",
        400,
        { field: "ranges" }
      );
    }
  }

  return normalised.map(({ start, end }) => ({ start, end }));
}

async function requireStylist(staffId) {
  if (!mongoose.isValidObjectId(staffId)) {
    throw createServiceError(
      "staffId must be a valid stylist identifier.",
      400,
      { field: "staffId" }
    );
  }

  return assertFound(
    await Stylist.findById(staffId),
    "Stylist not found."
  );
}

function effectiveAvailabilityMatch(staffId, target) {
  return {
    staff: staffId,
    dayOfWeek:
      salonDayOfWeek(
        target
      ),
    active: true,
    $and: [
      {
        $or: [
          { effectiveFrom: null },
          { effectiveFrom: { $lte: target } },
        ],
      },
      {
        $or: [
          { effectiveTo: null },
          { effectiveTo: { $gte: target } },
        ],
      },
    ],
  };
}

function fallbackRangesForDay(
  stylist,
  dayOfWeek
) {
  const dayName =
    DAY_NAMES[
      Number(dayOfWeek)
    ];

  const workingDay =
    stylist.workingHours?.find(
      (entry) =>
        entry.day ===
        dayName
    );

  if (
    !workingDay ||
    workingDay.available ===
      false
  ) {
    return [];
  }

  const start =
    workingDay.start ||
    "09:00";
  const end =
    workingDay.end ||
    "17:00";

  const dayStart =
    timeToMinutes(
      start,
      "workingHours.start"
    );
  const dayEnd =
    timeToMinutes(
      end,
      "workingHours.end"
    );

  const breaks =
    (
      workingDay.breaks ||
      []
    )
      .map(
        (
          entry,
          index
        ) => ({
          start:
            String(
              entry?.start ||
                ""
            ).trim(),
          end:
            String(
              entry?.end ||
                ""
            ).trim(),
          startMinutes:
            timeToMinutes(
              entry?.start,
              `workingHours.breaks[${index}].start`
            ),
          endMinutes:
            timeToMinutes(
              entry?.end,
              `workingHours.breaks[${index}].end`
            ),
        })
      )
      .filter(
        (entry) =>
          entry.endMinutes >
            entry.startMinutes &&
          entry.startMinutes >=
            dayStart &&
          entry.endMinutes <=
            dayEnd
      )
      .sort(
        (left, right) =>
          left.startMinutes -
          right.startMinutes
      );

  const ranges = [];
  let cursor =
    dayStart;
  let cursorLabel =
    start;

  for (
    const pause of breaks
  ) {
    if (
      pause.startMinutes <
      cursor
    ) {
      continue;
    }

    if (
      pause.startMinutes >
      cursor
    ) {
      ranges.push({
        start:
          cursorLabel,
        end:
          pause.start,
      });
    }

    cursor =
      pause.endMinutes;
    cursorLabel =
      pause.end;
  }

  if (
    cursor <
    dayEnd
  ) {
    ranges.push({
      start:
        cursorLabel,
      end,
    });
  }

  return validateRanges(
    ranges
  );
}

function fallbackRanges(
  stylist,
  target
) {
  return fallbackRangesForDay(
    stylist,
    salonDayOfWeek(
      target
    )
  );
}

function appointmentMinutes(
  date
) {
  return salonMinutesSinceMidnight(
    date
  );
}

export async function setWeeklyAvailability(staffId, payload = {}) {
  await requireStylist(staffId);

  const dayOfWeek = Number(payload.dayOfWeek);

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw createServiceError(
      "dayOfWeek must be between 0 and 6.",
      400,
      { field: "dayOfWeek" }
    );
  }

  const ranges = validateRanges(payload.ranges || []);

  return StaffAvailability.findOneAndUpdate(
    {
      staff: staffId,
      dayOfWeek,
      effectiveFrom: payload.effectiveFrom || null,
    },
    {
      $set: {
        ranges,
        active: payload.active === undefined ? true : Boolean(payload.active),
        effectiveFrom: payload.effectiveFrom || null,
        effectiveTo: payload.effectiveTo || null,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  ).lean();
}

export async function weeklyAvailability(staffId) {
  await requireStylist(staffId);

  return StaffAvailability.find({ staff: staffId })
    .sort({ dayOfWeek: 1, effectiveFrom: -1 })
    .lean();
}

export async function weeklyAvailabilityWithFallback(staffId) {
  const stylist =
    await requireStylist(
      staffId
    );

  const configured =
    await StaffAvailability.find({
      staff:
        staffId,
    })
      .sort({
        dayOfWeek: 1,
        effectiveFrom: -1,
      })
      .lean();

  return Array.from(
    {
      length: 7,
    },
    (
      _,
      dayOfWeek
    ) => {
      const matching =
        configured.filter(
          (entry) =>
            Number(
              entry.dayOfWeek
            ) ===
            dayOfWeek
        );

      const base =
        matching.find(
          (entry) =>
            !entry.effectiveFrom
        ) ||
        matching[0];

      if (base) {
        return {
          ...base,
          source:
            "configured_availability",
        };
      }

      const ranges =
        fallbackRangesForDay(
          stylist,
          dayOfWeek
        );

      return {
        staff:
          stylist._id,
        dayOfWeek,
        ranges,
        active:
          ranges.length >
          0,
        effectiveFrom:
          null,
        effectiveTo:
          null,
        source:
          "stylist_working_hours",
      };
    }
  );
}

export async function dayAvailability(staffId, date) {
  const target =
    salonDateAnchor(
      date
    );

  const {
    start: dayStart,
    end: dayEnd,
  } =
    salonDayBounds(
      target
    );

  const stylist =
    await requireStylist(
      staffId
    );

  const [configuredAvailability, appointments, timeOff] = await Promise.all([
    StaffAvailability.findOne(
      effectiveAvailabilityMatch(staffId, target)
    ).lean(),
    Appointment.find({
      stylist: staffId,
      appointmentDate: {
        $gte: dayStart,
        $lte: dayEnd,
      },
      status: { $nin: ["cancelled", "no_show"] },
    })
      .populate("service", "name duration")
      .populate("customer", "firstName lastName fullName name")
      .sort({ appointmentTime: 1 })
      .lean(),
    StaffTimeOff.find({
      staff: staffId,
      status: "approved",
      startsAt: {
        $lte: dayEnd,
      },
      endsAt: {
        $gte: dayStart,
      },
    }).lean(),
  ]);

  const ranges = configuredAvailability?.ranges?.length
    ? configuredAvailability.ranges
    : fallbackRanges(stylist, target);

  return {
    date: target,
    availability: configuredAvailability || {
      staff: stylist._id,
      dayOfWeek:
      salonDayOfWeek(
        target
      ),
      ranges,
      active: ranges.length > 0,
      source: "stylist_working_hours",
    },
    appointments,
    timeOff,
    available: ranges.length > 0 && timeOff.length === 0,
  };
}

export async function assertAppointmentWithinStaffAvailability(
  staffId,
  startsAt,
  endsAt
) {
  const start = parseDate(startsAt, "startsAt");
  const end = parseDate(endsAt, "endsAt");

  if (end <= start) {
    throw createServiceError(
      "Appointment end time must be after its start time.",
      400
    );
  }

  if (
    !sameSalonDay(
      start,
      end
    )
  ) {
    throw createServiceError(
      "Appointments must start and finish on the same day.",
      409
    );
  }

  const stylist = await requireStylist(staffId);

  if (stylist.isActive === false) {
    throw createServiceError(
      "The selected stylist is inactive.",
      409
    );
  }

  const [configuredAvailability, timeOff] = await Promise.all([
    StaffAvailability.findOne(
      effectiveAvailabilityMatch(staffId, start)
    ).lean(),
    StaffTimeOff.findOne({
      staff: staffId,
      status: "approved",
      startsAt: { $lt: end },
      endsAt: { $gt: start },
    }).lean(),
  ]);

  if (timeOff) {
    throw createServiceError(
      "The selected stylist is unavailable because an approved schedule block overlaps this appointment.",
      409,
      { timeOff }
    );
  }

  const ranges = configuredAvailability?.ranges?.length
    ? validateRanges(configuredAvailability.ranges)
    : fallbackRanges(stylist, start);

  const startMinutes = appointmentMinutes(start);
  const endMinutes = appointmentMinutes(end);
  const isInsideWorkingRange = ranges.some((range) => {
    const rangeStart = timeToMinutes(range.start, "range.start");
    const rangeEnd = timeToMinutes(range.end, "range.end");
    return startMinutes >= rangeStart && endMinutes <= rangeEnd;
  });

  if (!isInsideWorkingRange) {
    throw createServiceError(
      "The requested appointment is outside the stylist's working hours.",
      409,
      { ranges }
    );
  }

  return {
    available: true,
    source: configuredAvailability
      ? "configured_availability"
      : "stylist_working_hours",
    ranges,
  };
}

export async function requestTimeOff(staffId, payload = {}) {
  await requireStylist(staffId);

  const {
    startsAt,
    endsAt,
  } =
    validateScheduleBlockWindow(
      payload
    );

  return StaffTimeOff.create({
    staff: staffId,
    startsAt,
    endsAt,
    blockType:
      "time_off",
    title: "",
    reason: String(payload.reason || "").trim(),
    status: "requested",
  });
}

export async function createScheduleBlock(
  staffId,
  payload = {},
  user
) {
  await requireStylist(
    staffId
  );

  const {
    startsAt,
    endsAt,
  } =
    validateScheduleBlockWindow(
      payload
    );

  const blockType =
    normaliseScheduleBlockType(
      payload.blockType
    );

  const title =
    String(
      payload.title || ""
    )
      .trim()
      .slice(0, 120);

  const [
    appointmentConflict,
    blockConflict,
  ] =
    await Promise.all([
      Appointment.findOne({
        stylist:
          staffId,
        status: {
          $nin: [
            "cancelled",
            "no_show",
          ],
        },
        startsAt: {
          $lt:
            endsAt,
        },
        endsAt: {
          $gt:
            startsAt,
        },
      })
        .select(
          "_id startsAt endsAt status"
        )
        .lean(),
      StaffTimeOff.findOne({
        staff:
          staffId,
        status:
          "approved",
        startsAt: {
          $lt:
            endsAt,
        },
        endsAt: {
          $gt:
            startsAt,
        },
      })
        .select(
          "_id startsAt endsAt blockType"
        )
        .lean(),
    ]);

  if (
    appointmentConflict
  ) {
    throw createServiceError(
      "The schedule block overlaps an existing appointment.",
      409,
      {
        appointmentId:
          appointmentConflict._id,
      }
    );
  }

  if (blockConflict) {
    throw createServiceError(
      "The schedule block overlaps existing blocked time.",
      409,
      {
        scheduleBlockId:
          blockConflict._id,
      }
    );
  }

  return StaffTimeOff.create({
    staff:
      staffId,
    startsAt,
    endsAt,
    blockType,
    title,
    reason:
      String(
        payload.reason || ""
      )
        .trim()
        .slice(0, 500),
    status:
      "approved",
    approvedBy:
      userId(user),
  });
}

export async function calendarScheduleBlocks(
  query = {}
) {
  const startAnchor =
    salonDateAnchor(
      query.startDate ||
        query.startsAt
    );
  const endAnchor =
    salonDateAnchor(
      query.endDate ||
        query.endsAt
    );
  const {
    start: startsAt,
  } =
    salonDayBounds(
      startAnchor
    );
  const {
    end: endsAt,
  } =
    salonDayBounds(
      endAnchor
    );

  if (
    endsAt < startsAt
  ) {
    throw createServiceError(
      "Calendar block end date must not be before its start date.",
      400
    );
  }

  const match = {
    status:
      "approved",
    startsAt: {
      $lte:
        endsAt,
    },
    endsAt: {
      $gte:
        startsAt,
    },
  };

  if (query.staff) {
    await requireStylist(
      query.staff
    );
    match.staff =
      query.staff;
  }

  const blocks =
    await StaffTimeOff.find(
      match
    )
      .select(
        "staff startsAt endsAt blockType title status"
      )
      .populate(
        "staff",
        "firstName lastName isActive"
      )
      .sort({
        startsAt: 1,
      })
      .lean();

  return blocks.map(
    (block) => ({
      _id:
        block._id,
      staff:
        block.staff,
      startsAt:
        block.startsAt,
      endsAt:
        block.endsAt,
      blockType:
        block.blockType ||
        "time_off",
      title:
        scheduleBlockLabel(
          block
        ),
      status:
        block.status,
    })
  );
}

export async function getTimeOff(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw createServiceError(
      "Time-off request identifier is invalid.",
      400,
      { field: "id" }
    );
  }

  return assertFound(
    await StaffTimeOff.findById(id).lean(),
    "Time-off request not found."
  );
}

export async function updateTimeOff(id, status, user) {
  const allowed = [
    "requested",
    "approved",
    "declined",
    "cancelled",
  ];

  if (!allowed.includes(status)) {
    throw createServiceError(
      "Invalid time-off status.",
      400
    );
  }

  const request = assertFound(
    await StaffTimeOff.findById(id),
    "Time-off request not found."
  );

  request.status = status;
  request.approvedBy = status === "approved" ? userId(user) : undefined;

  await request.save();
  return request.toObject();
}

export async function listTimeOff(query = {}) {
  const match = {};

  if (query.staff) {
    await requireStylist(query.staff);
    match.staff = query.staff;
  }

  if (query.status) {
    match.status = query.status;
  }

  if (query.blockType) {
    match.blockType =
      normaliseScheduleBlockType(
        query.blockType
      );
  }

  if (
    query.startDate ||
    query.endDate
  ) {
    const rangeStart =
      query.startDate
        ? parseDate(
            query.startDate,
            "startDate"
          )
        : new Date(0);
    const rangeEnd =
      query.endDate
        ? parseDate(
            query.endDate,
            "endDate"
          )
        : new Date(
            "9999-12-31T23:59:59.999Z"
          );

    match.startsAt = {
      $lte:
        rangeEnd,
    };
    match.endsAt = {
      $gte:
        rangeStart,
    };
  }

  return StaffTimeOff.find(match)
    .populate("staff", "firstName lastName email isActive")
    .populate("approvedBy", "name email role")
    .sort({ startsAt: 1 })
    .lean();
}
