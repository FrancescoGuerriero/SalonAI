import Appointment from "../../models/Appointment.js";

const TIMEZONE = "Europe/London";

const CANCELLED_STATUS = "cancelled";
const NO_SHOW_STATUS = "no_show";

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

function firstPositiveNumber(
  ...values
) {
  let firstFiniteValue = 0;

  for (const value of values) {
    if (
      value === null ||
      value === undefined
    ) {
      continue;
    }

    const numericValue =
      Number(value);

    if (
      !Number.isFinite(
        numericValue
      )
    ) {
      continue;
    }

    if (
      firstFiniteValue === 0
    ) {
      firstFiniteValue =
        numericValue;
    }

    if (numericValue > 0) {
      return numericValue;
    }
  }

  return firstFiniteValue;
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

function getBookingValue(
  appointment
) {
  return firstPositiveNumber(
    appointment.finalPrice,
    appointment.totalPrice,
    appointment.price,
    appointment.service?.price
  );
}

function getRetainedPayment(
  appointment
) {
  const paymentStatus =
    String(
      appointment.paymentStatus ||
        ""
    ).toLowerCase();

  if (
    paymentStatus === "refunded" ||
    paymentStatus === "cancelled"
  ) {
    return 0;
  }

  return Math.max(
    0,
    firstPositiveNumber(
      appointment.amountPaid
    )
  );
}

function getEstimatedLostRevenue(
  appointment
) {
  const bookingValue =
    getBookingValue(
      appointment
    );

  const retainedPayment =
    getRetainedPayment(
      appointment
    );

  return Math.max(
    0,
    bookingValue -
      retainedPayment
  );
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

        totalAppointments: 0,
        cancelledAppointments: 0,
        noShowAppointments: 0,
        lostAppointments: 0,
        estimatedLostRevenue: 0,
      };
    }
  );
}

function createWeekdayBuckets() {
  return WEEKDAYS.map(
    (weekday, index) => ({
      weekday,
      weekdayIndex: index,
      totalAppointments: 0,
      cancelledAppointments: 0,
      noShowAppointments: 0,
      lostAppointments: 0,
      estimatedLostRevenue: 0,
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

      totalAppointments: 0,
      cancelledAppointments: 0,
      noShowAppointments: 0,
      lostAppointments: 0,
      estimatedLostRevenue: 0,
    })
  );
}

function updateGeneralBucket({
  bucket,
  status,
  estimatedLostRevenue,
}) {
  if (!bucket) {
    return;
  }

  bucket.totalAppointments += 1;

  if (
    status ===
    CANCELLED_STATUS
  ) {
    bucket.cancelledAppointments +=
      1;

    bucket.lostAppointments +=
      1;

    bucket.estimatedLostRevenue +=
      estimatedLostRevenue;
  }

  if (
    status ===
    NO_SHOW_STATUS
  ) {
    bucket.noShowAppointments +=
      1;

    bucket.lostAppointments +=
      1;

    bucket.estimatedLostRevenue +=
      estimatedLostRevenue;
  }
}

function updateAffectedEntity({
  map,
  entity,
  fallbackName,
  status,
  estimatedLostRevenue,
  appointmentDate,
}) {
  const id =
    getEntityId(entity) ||
    "unassigned";

  if (!map.has(id)) {
    map.set(id, {
      id,

      name:
        getEntityName(
          entity,
          fallbackName
        ),

      email:
        entity?.email ||
        "",

      cancelledAppointments: 0,
      noShowAppointments: 0,
      lostAppointments: 0,
      estimatedLostRevenue: 0,
      lastIncidentAt: null,
    });
  }

  const record =
    map.get(id);

  if (
    status ===
    CANCELLED_STATUS
  ) {
    record.cancelledAppointments +=
      1;
  }

  if (
    status ===
    NO_SHOW_STATUS
  ) {
    record.noShowAppointments +=
      1;
  }

  record.lostAppointments +=
    1;

  record.estimatedLostRevenue +=
    estimatedLostRevenue;

  if (
    !record.lastIncidentAt ||
    appointmentDate >
      record.lastIncidentAt
  ) {
    record.lastIncidentAt =
      appointmentDate;
  }
}

function finaliseBucket(bucket) {
  const lossRate =
    bucket.totalAppointments > 0
      ? (
          bucket.lostAppointments /
          bucket.totalAppointments
        ) * 100
      : 0;

  return {
    ...bucket,

    lossRate:
      roundNumber(
        lossRate,
        1
      ),

    estimatedLostRevenue:
      roundNumber(
        bucket.estimatedLostRevenue
      ),
  };
}

function finaliseAffectedRanking(
  map,
  limit = 10
) {
  return Array.from(
    map.values()
  )
    .map(
      (record) => ({
        ...record,

        estimatedLostRevenue:
          roundNumber(
            record.estimatedLostRevenue
          ),

        lastIncidentAt:
          record.lastIncidentAt
            ?.toISOString() ||
          null,
      })
    )
    .sort(
      (first, second) =>
        second.lostAppointments -
          first.lostAppointments ||
        second.estimatedLostRevenue -
          first.estimatedLostRevenue
    )
    .slice(0, limit);
}

function findPeakBucket(
  buckets,
  labelKey
) {
  const populated =
    buckets.filter(
      (bucket) =>
        bucket.lostAppointments >
        0
    );

  if (!populated.length) {
    return null;
  }

  const highest =
    [...populated].sort(
      (first, second) =>
        second.lostAppointments -
          first.lostAppointments ||
        second.estimatedLostRevenue -
          first.estimatedLostRevenue
    )[0];

  return {
    label:
      highest[labelKey],

    lostAppointments:
      highest.lostAppointments,

    estimatedLostRevenue:
      roundNumber(
        highest.estimatedLostRevenue
      ),
  };
}

async function generateBookingLossAnalytics({
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
        "name fullName displayName email phone"
      )
      .populate(
        "service",
        "name title category price"
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

  const customerMap =
    new Map();

  let totalAppointments = 0;
  let cancelledAppointments = 0;
  let noShowAppointments = 0;
  let estimatedLostRevenue = 0;
  let retainedPayments = 0;

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

    totalAppointments += 1;

    const status =
      String(
        appointment.status ||
          ""
      ).toLowerCase();

    const lostRevenue =
      getEstimatedLostRevenue(
        appointment
      );

    const monthBucket =
      byMonth.find(
        (month) =>
          month.month ===
          getMonthKey(
            appointmentDate
          )
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

    updateGeneralBucket({
      bucket:
        monthBucket,
      status,
      estimatedLostRevenue:
        lostRevenue,
    });

    updateGeneralBucket({
      bucket:
        weekdayBucket,
      status,
      estimatedLostRevenue:
        lostRevenue,
    });

    updateGeneralBucket({
      bucket:
        hourBucket,
      status,
      estimatedLostRevenue:
        lostRevenue,
    });

    const isLostAppointment =
      status ===
        CANCELLED_STATUS ||
      status ===
        NO_SHOW_STATUS;

    if (!isLostAppointment) {
      continue;
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

    estimatedLostRevenue +=
      lostRevenue;

    retainedPayments +=
      getRetainedPayment(
        appointment
      );

    updateAffectedEntity({
      map:
        serviceMap,
      entity:
        appointment.service,
      fallbackName:
        "Unassigned service",
      status,
      estimatedLostRevenue:
        lostRevenue,
      appointmentDate,
    });

    updateAffectedEntity({
      map:
        stylistMap,
      entity:
        appointment.stylist,
      fallbackName:
        "Unassigned stylist",
      status,
      estimatedLostRevenue:
        lostRevenue,
      appointmentDate,
    });

    updateAffectedEntity({
      map:
        customerMap,
      entity:
        appointment.customer,
      fallbackName:
        "Unknown customer",
      status,
      estimatedLostRevenue:
        lostRevenue,
      appointmentDate,
    });
  }

  const lostAppointments =
    cancelledAppointments +
    noShowAppointments;

  const cancellationRate =
    totalAppointments > 0
      ? (
          cancelledAppointments /
          totalAppointments
        ) * 100
      : 0;

  const noShowRate =
    totalAppointments > 0
      ? (
          noShowAppointments /
          totalAppointments
        ) * 100
      : 0;

  const totalLossRate =
    totalAppointments > 0
      ? (
          lostAppointments /
          totalAppointments
        ) * 100
      : 0;

  const affectedServices =
    finaliseAffectedRanking(
      serviceMap
    );

  const affectedStylists =
    finaliseAffectedRanking(
      stylistMap
    );

  const repeatCustomers =
    finaliseAffectedRanking(
      customerMap,
      20
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
      totalAppointments,
      cancelledAppointments,
      noShowAppointments,
      lostAppointments,

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

      totalLossRate:
        roundNumber(
          totalLossRate,
          1
        ),

      estimatedLostRevenue:
        roundNumber(
          estimatedLostRevenue
        ),

      retainedPayments:
        roundNumber(
          retainedPayments
        ),

      averageLostBookingValue:
        lostAppointments > 0
          ? roundNumber(
              estimatedLostRevenue /
                lostAppointments
            )
          : 0,

      peakRiskDay:
        findPeakBucket(
          byWeekday,
          "weekday"
        ),

      peakRiskHour:
        findPeakBucket(
          byHour,
          "label"
        ),

      mostAffectedService:
        affectedServices[0] ||
        null,

      mostAffectedStylist:
        affectedStylists[0] ||
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
            hour.lostAppointments >
            0
        )
        .map(
          finaliseBucket
        ),

    affectedServices,
    affectedStylists,
    repeatCustomers,
  };
}

export {
  generateBookingLossAnalytics,
};
