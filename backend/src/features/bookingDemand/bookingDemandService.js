import Appointment from "../../models/Appointment.js";

const TIMEZONE = "Europe/London";

const COMPLETED_STATUS = "completed";
const CANCELLED_STATUS = "cancelled";
const NO_SHOW_STATUS = "no_show";

const CAPACITY_STATUSES = new Set([
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "no_show",
]);

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function clampInteger(
  value,
  minimum,
  maximum,
  fallback
) {
  const parsedValue =
    Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, parsedValue)
  );
}

function roundNumber(
  value,
  decimalPlaces = 2
) {
  const multiplier =
    10 ** decimalPlaces;

  return (
    Math.round(
      (Number(value) || 0) *
        multiplier
    ) / multiplier
  );
}

function firstFiniteNumber(
  ...values
) {
  for (const value of values) {
    if (
      value !== null &&
      value !== undefined &&
      Number.isFinite(
        Number(value)
      )
    ) {
      return Number(value);
    }
  }

  return 0;
}

function toValidDate(value) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function startOfUtcMonth(date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      1
    )
  );
}

function addUtcMonths(
  date,
  months
) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() +
        months,
      1
    )
  );
}

function getAppointmentDate(
  appointment
) {
  const startsAt =
    toValidDate(
      appointment.startsAt
    );

  if (startsAt) {
    return startsAt;
  }

  const appointmentDate =
    toValidDate(
      appointment.appointmentDate
    );

  if (!appointmentDate) {
    return null;
  }

  const timeMatch =
    String(
      appointment.appointmentTime ||
        ""
    ).match(
      /^(\d{1,2}):(\d{2})/
    );

  if (timeMatch) {
    const hour =
      Number(timeMatch[1]);

    const minute =
      Number(timeMatch[2]);

    appointmentDate.setUTCHours(
      hour,
      minute,
      0,
      0
    );
  }

  return appointmentDate;
}

function getDateParts(date) {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: TIMEZONE,
        year: "numeric",
        month: "2-digit",
        weekday: "long",
        hour: "2-digit",
        hourCycle: "h23",
      }
    ).formatToParts(date);

  return Object.fromEntries(
    parts.map(
      (part) => [
        part.type,
        part.value,
      ]
    )
  );
}

function getMonthKey(date) {
  const parts =
    getDateParts(date);

  return `${parts.year}-${parts.month}`;
}

function getMonthLabel(date) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: TIMEZONE,
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function getWeekdayIndex(date) {
  const weekday =
    getDateParts(date).weekday;

  return Math.max(
    0,
    WEEKDAYS.indexOf(
      weekday
    )
  );
}

function getHour(date) {
  const hour =
    Number(
      getDateParts(date).hour
    );

  return Number.isFinite(hour)
    ? hour
    : 0;
}

function createMonthlyBuckets({
  startDate,
  months,
}) {
  return Array.from(
    {
      length: months,
    },
    (_, index) => {
      const date =
        addUtcMonths(
          startDate,
          index
        );

      return {
        month:
          getMonthKey(date),

        label:
          getMonthLabel(date),

        appointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        noShowAppointments: 0,
        bookedMinutes: 0,
        earnedRevenue: 0,
      };
    }
  );
}

function createWeekdayBuckets() {
  return WEEKDAYS.map(
    (weekday, index) => ({
      weekday,
      weekdayIndex: index,
      appointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      noShowAppointments: 0,
      bookedMinutes: 0,
      earnedRevenue: 0,
    })
  );
}

function createHourlyBuckets() {
  return Array.from(
    {
      length: 24,
    },
    (_, hour) => ({
      hour,
      label:
        `${String(hour).padStart(
          2,
          "0"
        )}:00`,

      appointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      noShowAppointments: 0,
      bookedMinutes: 0,
      earnedRevenue: 0,
    })
  );
}

function getEntityId(entity) {
  return String(
    entity?._id ||
      entity?.id ||
      entity ||
      ""
  ).trim();
}

function getEntityName(
  entity,
  fallback
) {
  const combinedName = [
    entity?.firstName,
    entity?.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    entity?.name ||
    entity?.fullName ||
    entity?.displayName ||
    combinedName ||
    entity?.title ||
    entity?.email ||
    fallback
  );
}

function getAppointmentDuration(
  appointment
) {
  const duration =
    firstFiniteNumber(
      appointment.duration,
      appointment.service
        ?.duration
    );

  return duration > 0
    ? duration
    : 60;
}

function getAppointmentRevenue(
  appointment
) {
  return firstFiniteNumber(
    appointment.finalPrice,
    appointment.totalPrice,
    appointment.price,
    appointment.service?.price
  );
}

function incrementBucket({
  bucket,
  status,
  duration,
  revenue,
}) {
  if (!bucket) {
    return;
  }

  bucket.appointments += 1;

  if (
    CAPACITY_STATUSES.has(status)
  ) {
    bucket.bookedMinutes +=
      duration;
  }

  if (
    status ===
    COMPLETED_STATUS
  ) {
    bucket.completedAppointments +=
      1;

    bucket.earnedRevenue +=
      revenue;
  }

  if (
    status ===
    CANCELLED_STATUS
  ) {
    bucket.cancelledAppointments +=
      1;
  }

  if (
    status ===
    NO_SHOW_STATUS
  ) {
    bucket.noShowAppointments +=
      1;
  }
}

function updateRanking(
  map,
  entity,
  fallbackName,
  revenue,
  status
) {
  const entityId =
    getEntityId(entity) ||
    "unassigned";

  if (!map.has(entityId)) {
    map.set(entityId, {
      id: entityId,

      name:
        getEntityName(
          entity,
          fallbackName
        ),

      appointments: 0,
      completedAppointments: 0,
      earnedRevenue: 0,
    });
  }

  const record =
    map.get(entityId);

  record.appointments += 1;

  if (
    status ===
    COMPLETED_STATUS
  ) {
    record.completedAppointments +=
      1;

    record.earnedRevenue +=
      revenue;
  }
}

function finaliseBucket(bucket) {
  return {
    ...bucket,

    bookedHours:
      roundNumber(
        bucket.bookedMinutes /
          60,
        1
      ),

    earnedRevenue:
      roundNumber(
        bucket.earnedRevenue
      ),
  };
}

function finaliseRanking(map) {
  return Array.from(
    map.values()
  )
    .map(
      (record) => ({
        ...record,

        earnedRevenue:
          roundNumber(
            record.earnedRevenue
          ),
      })
    )
    .sort(
      (first, second) =>
        second.appointments -
          first.appointments ||
        second.earnedRevenue -
          first.earnedRevenue
    )
    .slice(0, 10);
}

async function generateBookingDemandAnalytics({
  months = 6,
} = {}) {
  const selectedMonths =
    clampInteger(
      months,
      1,
      24,
      6
    );

  const now =
    new Date();

  const currentMonth =
    startOfUtcMonth(now);

  const startDate =
    addUtcMonths(
      currentMonth,
      -(selectedMonths - 1)
    );

  const endDate =
    addUtcMonths(
      currentMonth,
      1
    );

  const appointments =
    await Appointment.find({
      $or: [
        {
          startsAt: {
            $gte: startDate,
            $lt: endDate,
          },
        },
        {
          appointmentDate: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      ],
    })
      .populate(
        "customer",
        "name email"
      )
      .populate(
        "service",
        "name title category price duration"
      )
      .populate(
        "stylist",
        "firstName lastName name fullName displayName email"
      )
      .lean();

  const byMonth =
    createMonthlyBuckets({
      startDate,
      months:
        selectedMonths,
    });

  const byWeekday =
    createWeekdayBuckets();

  const byHour =
    createHourlyBuckets();

  const serviceMap =
    new Map();

  const stylistMap =
    new Map();

  const customerIds =
    new Set();

  let completedAppointments = 0;
  let cancelledAppointments = 0;
  let noShowAppointments = 0;
  let bookedMinutes = 0;
  let earnedRevenue = 0;

  for (
    const appointment
    of appointments
  ) {
    const appointmentDate =
      getAppointmentDate(
        appointment
      );

    if (
      !appointmentDate ||
      appointmentDate <
        startDate ||
      appointmentDate >=
        endDate
    ) {
      continue;
    }

    const status =
      String(
        appointment.status ||
          "pending"
      ).toLowerCase();

    const duration =
      getAppointmentDuration(
        appointment
      );

    const revenue =
      getAppointmentRevenue(
        appointment
      );

    const monthKey =
      getMonthKey(
        appointmentDate
      );

    const monthBucket =
      byMonth.find(
        (month) =>
          month.month ===
          monthKey
      );

    const weekdayBucket =
      byWeekday[
        getWeekdayIndex(
          appointmentDate
        )
      ];

    const hourBucket =
      byHour[
        getHour(
          appointmentDate
        )
      ];

    incrementBucket({
      bucket:
        monthBucket,
      status,
      duration,
      revenue,
    });

    incrementBucket({
      bucket:
        weekdayBucket,
      status,
      duration,
      revenue,
    });

    incrementBucket({
      bucket:
        hourBucket,
      status,
      duration,
      revenue,
    });

    if (
      CAPACITY_STATUSES.has(
        status
      )
    ) {
      bookedMinutes +=
        duration;
    }

    if (
      status ===
      COMPLETED_STATUS
    ) {
      completedAppointments +=
        1;

      earnedRevenue +=
        revenue;
    }

    if (
      status ===
      CANCELLED_STATUS
    ) {
      cancelledAppointments +=
        1;
    }

    if (
      status ===
      NO_SHOW_STATUS
    ) {
      noShowAppointments +=
        1;
    }

    const customerId =
      getEntityId(
        appointment.customer
      );

    if (customerId) {
      customerIds.add(
        customerId
      );
    }

    updateRanking(
      serviceMap,
      appointment.service,
      "Unassigned service",
      revenue,
      status
    );

    updateRanking(
      stylistMap,
      appointment.stylist,
      "Unassigned stylist",
      revenue,
      status
    );
  }

  const appointmentCount =
    appointments.filter(
      (appointment) => {
        const date =
          getAppointmentDate(
            appointment
          );

        return (
          date &&
          date >= startDate &&
          date < endDate
        );
      }
    ).length;

  const completionRate =
    appointmentCount > 0
      ? (
          completedAppointments /
          appointmentCount
        ) * 100
      : 0;

  const cancellationRate =
    appointmentCount > 0
      ? (
          cancelledAppointments /
          appointmentCount
        ) * 100
      : 0;

  const noShowRate =
    appointmentCount > 0
      ? (
          noShowAppointments /
          appointmentCount
        ) * 100
      : 0;

  const peakWeekday =
    [...byWeekday].sort(
      (first, second) =>
        second.appointments -
        first.appointments
    )[0] || null;

  const populatedHours =
    byHour.filter(
      (hour) =>
        hour.appointments > 0
    );

  const peakHour =
    [...populatedHours].sort(
      (first, second) =>
        second.appointments -
        first.appointments
    )[0] || null;

  const topServices =
    finaliseRanking(
      serviceMap
    );

  const topStylists =
    finaliseRanking(
      stylistMap
    );

  return {
    generatedAt:
      now.toISOString(),

    timezone: TIMEZONE,
    currency: "GBP",

    period: {
      months:
        selectedMonths,

      startDate:
        startDate.toISOString(),

      endDate:
        endDate.toISOString(),
    },

    summary: {
      appointmentCount,

      completedAppointments,

      cancelledAppointments,

      noShowAppointments,

      uniqueCustomers:
        customerIds.size,

      completionRate:
        roundNumber(
          completionRate,
          1
        ),

      cancellationRate:
        roundNumber(
          cancellationRate,
          1
        ),

      noShowRate:
        roundNumber(
          noShowRate,
          1
        ),

      bookedHours:
        roundNumber(
          bookedMinutes / 60,
          1
        ),

      earnedRevenue:
        roundNumber(
          earnedRevenue
        ),

      averageAppointmentValue:
        completedAppointments > 0
          ? roundNumber(
              earnedRevenue /
                completedAppointments
            )
          : 0,

      peakWeekday:
        peakWeekday
          ? {
              weekday:
                peakWeekday.weekday,

              appointments:
                peakWeekday.appointments,
            }
          : null,

      peakHour:
        peakHour
          ? {
              hour:
                peakHour.hour,

              label:
                peakHour.label,

              appointments:
                peakHour.appointments,
            }
          : null,

      busiestService:
        topServices[0] ||
        null,

      busiestStylist:
        topStylists[0] ||
        null,
    },

    byMonth:
      byMonth.map(
        finaliseBucket
      ),

    byWeekday:
      byWeekday.map(
        finaliseBucket
      ),

    byHour:
      byHour
        .filter(
          (hour) =>
            hour.appointments >
            0
        )
        .map(
          finaliseBucket
        ),

    topServices,
    topStylists,
  };
}

export {
  generateBookingDemandAnalytics,
};