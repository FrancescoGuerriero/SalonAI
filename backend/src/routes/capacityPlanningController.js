import Appointment from "../../models/Appointment.js";
import StaffAvailability from "./StaffAvailability.js";
import StaffTimeOff from "./StaffTimeOff.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import {
  startOfDay,
  endOfDay,
} from "../../shared/dateUtils.js";
import { userId } from "../../shared/modelHelpers.js";

export async function setWeeklyAvailability(
  staffId,
  payload
) {
  const dayOfWeek = Number(payload.dayOfWeek);

  if (
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 0 ||
    dayOfWeek > 6
  ) {
    throw createServiceError(
      "dayOfWeek must be between 0 and 6.",
      400
    );
  }

  return StaffAvailability.findOneAndUpdate(
    {
      staff: staffId,
      dayOfWeek,
      effectiveFrom:
        payload.effectiveFrom || null,
    },
    {
      $set: {
        ranges: Array.isArray(payload.ranges)
          ? payload.ranges
          : [],
        active:
          payload.active === undefined
            ? true
            : Boolean(payload.active),
        effectiveFrom:
          payload.effectiveFrom || null,
        effectiveTo: payload.effectiveTo || null,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();
}

export async function weeklyAvailability(
  staffId
) {
  return StaffAvailability.find({
    staff: staffId,
  })
    .sort({
      dayOfWeek: 1,
      effectiveFrom: -1,
    })
    .lean();
}

export async function dayAvailability(
  staffId,
  date
) {
  const target = new Date(date);

  if (Number.isNaN(target.getTime())) {
    throw createServiceError(
      "A valid date is required.",
      400
    );
  }

  const dayOfWeek = target.getDay();

  const [availability, appointments, timeOff] =
    await Promise.all([
      StaffAvailability.findOne({
        staff: staffId,
        dayOfWeek,
        active: true,
        $and: [
          {
            $or: [
              {
                effectiveFrom: null,
              },
              {
                effectiveFrom: {
                  $lte: target,
                },
              },
            ],
          },
          {
            $or: [
              {
                effectiveTo: null,
              },
              {
                effectiveTo: {
                  $gte: target,
                },
              },
            ],
          },
        ],
      }).lean(),

      Appointment.find({
        stylist: staffId,
        appointmentDate: {
          $gte: startOfDay(target),
          $lte: endOfDay(target),
        },
        status: {
          $nin: ["cancelled", "no_show"],
        },
      })
        .populate("service", "name duration")
        .populate(
          "customer",
          "firstName lastName fullName name"
        )
        .sort({ appointmentTime: 1 })
        .lean(),

      StaffTimeOff.find({
        staff: staffId,
        status: "approved",
        startsAt: {
          $lte: endOfDay(target),
        },
        endsAt: {
          $gte: startOfDay(target),
        },
      }).lean(),
    ]);

  return {
    date: target,
    availability,
    appointments,
    timeOff,
    available:
      Boolean(availability) &&
      timeOff.length === 0,
  };
}

export async function requestTimeOff(
  staffId,
  payload
) {
  const startsAt = new Date(payload.startsAt);
  const endsAt = new Date(payload.endsAt);

  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt
  ) {
    throw createServiceError(
      "Valid time-off start and end values are required.",
      400
    );
  }

  return StaffTimeOff.create({
    staff: staffId,
    startsAt,
    endsAt,
    reason: String(payload.reason || "").trim(),
    status: payload.status || "requested",
  });
}

export async function updateTimeOff(
  id,
  status,
  user
) {
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

  if (status === "approved") {
    request.approvedBy = userId(user);
  }

  await request.save();

  return request.toObject();
}

export async function listTimeOff(query = {}) {
  const match = {};

  if (query.staff) {
    match.staff = query.staff;
  }

  if (query.status) {
    match.status = query.status;
  }

  return StaffTimeOff.find(match)
    .populate(
      "staff approvedBy",
      "name firstName lastName email"
    )
    .sort({ startsAt: 1 })
    .lean();
}
