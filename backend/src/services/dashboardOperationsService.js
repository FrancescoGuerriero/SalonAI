import Appointment from "../models/Appointment.js";
import Stylist from "../models/Stylist.js";

import StaffTimeOff from "../features/staff/StaffTimeOff.js";

const ACTIVE_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
];

const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
];

function startOfDay(value = new Date()) {
  const date = new Date(value);

  date.setHours(0, 0, 0, 0);

  return date;
}

function endOfDay(value = new Date()) {
  const date = new Date(value);

  date.setHours(23, 59, 59, 999);

  return date;
}

function parseTime(value) {
  const match =
    /^([01]\d|2[0-3]):([0-5]\d)$/.exec(
      String(value || "")
    );

  if (!match) {
    return null;
  }

  return (
    Number(match[1]) * 60 +
    Number(match[2])
  );
}

function appointmentStart(
  appointment
) {
  if (appointment.startsAt) {
    const date =
      new Date(
        appointment.startsAt
      );

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date;
    }
  }

  const date =
    new Date(
      appointment.appointmentDate
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  const minutes =
    parseTime(
      appointment.appointmentTime
    );

  if (minutes !== null) {
    date.setHours(
      Math.floor(minutes / 60),
      minutes % 60,
      0,
      0
    );
  }

  return date;
}

function appointmentEnd(
  appointment
) {
  if (appointment.endsAt) {
    const date =
      new Date(
        appointment.endsAt
      );

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date;
    }
  }

  const start =
    appointmentStart(
      appointment
    );

  if (!start) {
    return null;
  }

  const duration =
    Math.max(
      Number(
        appointment.duration
      ) || 60,
      1
    );

  return new Date(
    start.getTime() +
      duration * 60_000
  );
}

function appointmentValue(
  appointment
) {
  const finalPrice =
    Number(
      appointment.finalPrice
    );

  if (
    Number.isFinite(
      finalPrice
    )
  ) {
    return finalPrice;
  }

  const totalPrice =
    Number(
      appointment.totalPrice
    );

  return Number.isFinite(
    totalPrice
  )
    ? totalPrice
    : 0;
}

function outstandingBalance(
  appointment
) {
  const balanceDue =
    Number(
      appointment.balanceDue
    );

  if (
    Number.isFinite(
      balanceDue
    )
  ) {
    return Math.max(
      balanceDue,
      0
    );
  }

  const amountPaid =
    Number(
      appointment.amountPaid
    ) || 0;

  return Math.max(
    appointmentValue(
      appointment
    ) - amountPaid,
    0
  );
}

function displayName(
  record,
  fallback
) {
  if (!record) {
    return fallback;
  }

  return (
    record.fullName ||
    record.name ||
    [
      record.firstName,
      record.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    fallback
  );
}

function scheduledMinutes(
  stylist,
  dayName
) {
  const hours =
    Array.isArray(
      stylist.workingHours
    )
      ? stylist.workingHours.find(
          (item) =>
            item.day ===
            dayName
        )
      : null;

  if (
    !hours ||
    hours.available === false
  ) {
    return 0;
  }

  const start =
    parseTime(hours.start);

  const end =
    parseTime(hours.end);

  if (
    start === null ||
    end === null ||
    end <= start
  ) {
    return 0;
  }

  return end - start;
}

function initialStatusCounts() {
  return Object.fromEntries(
    APPOINTMENT_STATUSES.map(
      (status) => [
        status,
        0,
      ]
    )
  );
}

class DashboardOperationsService {
  async getSnapshot() {
    const now = new Date();

    const dayStart =
      startOfDay(now);

    const dayEnd =
      endOfDay(now);

    const dayName =
      now.toLocaleDateString(
        "en-GB",
        {
          weekday: "long",
        }
      );

    const [
      appointments,
      stylists,
      timeOff,
    ] = await Promise.all([
      Appointment.find({
        appointmentDate: {
          $gte: dayStart,
          $lte: dayEnd,
        },
      })
        .populate("customer")
        .populate("stylist")
        .populate("service")
        .sort({
          appointmentDate: 1,
          appointmentTime: 1,
        })
        .lean(),

      Stylist.find({
        isActive: {
          $ne: false,
        },
      })
        .select(
          [
            "firstName",
            "lastName",
            "workingHours",
            "isActive",
          ].join(" ")
        )
        .lean(),

      StaffTimeOff.find({
        status: "approved",

        startsAt: {
          $lte: dayEnd,
        },

        endsAt: {
          $gte: dayStart,
        },
      })
        .select(
          "staff startsAt endsAt"
        )
        .lean(),
    ]);

    const statusCounts =
      initialStatusCounts();

    appointments.forEach(
      (appointment) => {
        if (
          Object.prototype
            .hasOwnProperty.call(
              statusCounts,
              appointment.status
            )
        ) {
          statusCounts[
            appointment.status
          ] += 1;
        }
      }
    );

    const activeAppointments =
      appointments.filter(
        (appointment) =>
          ACTIVE_STATUSES.includes(
            appointment.status
          )
      );

    const totalScheduledMinutes =
      stylists.reduce(
        (total, stylist) =>
          total +
          scheduledMinutes(
            stylist,
            dayName
          ),
        0
      );

    const bookedMinutes =
      activeAppointments.reduce(
        (
          total,
          appointment
        ) =>
          total +
          Math.max(
            Number(
              appointment.duration
            ) || 60,
            1
          ),
        0
      );

    const utilisationPercent =
      totalScheduledMinutes > 0
        ? Number(
            (
              (
                bookedMinutes /
                totalScheduledMinutes
              ) * 100
            ).toFixed(1)
          )
        : 0;

    const overdueAppointments =
      activeAppointments.filter(
        (appointment) => {
          if (
            appointment.status ===
            "completed"
          ) {
            return false;
          }

          const end =
            appointmentEnd(
              appointment
            );

          return (
            end &&
            end < now
          );
        }
      ).length;

    const outstanding =
      appointments
        .filter(
          (appointment) =>
            appointment.status !==
              "cancelled" &&
            appointment.paymentStatus !==
              "paid"
        )
        .reduce(
          (
            total,
            appointment
          ) =>
            total +
            outstandingBalance(
              appointment
            ),
          0
        );

    const collected =
      appointments.reduce(
        (
          total,
          appointment
        ) =>
          total +
          Math.max(
            Number(
              appointment.amountPaid
            ) || 0,
            0
          ),
        0
      );

    const nextAppointments =
      activeAppointments
        .map(
          (appointment) => ({
            appointment,

            startsAt:
              appointmentStart(
                appointment
              ),
          })
        )
        .filter(
          (item) =>
            item.startsAt &&
            item.startsAt >= now
        )
        .sort(
          (left, right) =>
            left.startsAt -
            right.startsAt
        )
        .slice(0, 5)
        .map(
          ({
            appointment,
            startsAt,
          }) => ({
            id:
              appointment._id,

            startsAt,

            time:
              appointment
                .appointmentTime ||
              "",

            status:
              appointment.status,

            customer:
              displayName(
                appointment.customer,
                "Customer"
              ),

            stylist:
              displayName(
                appointment.stylist,
                "Stylist"
              ),

            service:
              appointment
                .service?.name ||
              "Service",
          })
        );

    const staffOnLeave =
      new Set(
        timeOff.map(
          (record) =>
            String(record.staff)
        )
      ).size;

    return {
      generatedAt: now,

      appointmentsToday:
        appointments.length,

      activeStylists:
        stylists.length,

      staffOnLeave,

      scheduledMinutes:
        totalScheduledMinutes,

      bookedMinutes,

      utilisationPercent,

      pendingApprovals:
        statusCounts.pending,

      overdueAppointments,

      revenueCollected:
        Number(
          collected.toFixed(2)
        ),

      outstandingBalance:
        Number(
          outstanding.toFixed(2)
        ),

      statusCounts,

      nextAppointments,
    };
  }
}

export default new DashboardOperationsService();