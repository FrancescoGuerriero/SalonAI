import Appointment from "../../models/Appointment.js";

const COMPLETED_STATUS = "completed";
const CANCELLED_STATUS = "cancelled";
const NO_SHOW_STATUS = "no_show";

const ACTIVE_STATUSES = new Set([
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
]);

function clampInteger(
  value,
  minimum,
  maximum,
  fallback
) {
  const parsedValue =
    Number.parseInt(value, 10);

  if (
    !Number.isFinite(parsedValue)
  ) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      parsedValue
    )
  );
}

function roundMoney(value) {
  return Math.round(
    (Number(value) || 0) * 100
  ) / 100;
}

function roundPercentage(value) {
  return Math.round(
    (Number(value) || 0) * 10
  ) / 10;
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
  const rawDate =
    appointment.startsAt ||
    appointment.appointmentDate;

  if (!rawDate) {
    return null;
  }

  const date =
    new Date(rawDate);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

function getMonthKey(date) {
  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() + 1
    ).padStart(2, "0");

  return `${year}-${month}`;
}

function getMonthLabel(date) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(date);
}

function createMonthBuckets({
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
        earnedRevenue: 0,
        collectedRevenue: 0,
      };
    }
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

function getServiceName(service) {
  return (
    service?.name ||
    service?.title ||
    "Unassigned service"
  );
}

function getServiceCategory(service) {
  return (
    service?.category ||
    "Other"
  );
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

function getCollectedRevenue(
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

  return firstFiniteNumber(
    appointment.amountPaid
  );
}

function calculateGrowthRate(
  previousValue,
  currentValue
) {
  if (
    previousValue <= 0 &&
    currentValue <= 0
  ) {
    return 0;
  }

  if (
    previousValue <= 0 &&
    currentValue > 0
  ) {
    return 100;
  }

  return roundPercentage(
    (
      (currentValue -
        previousValue) /
      previousValue
    ) * 100
  );
}

function createServiceRecord({
  service,
  months,
  startDate,
}) {
  return {
    serviceId:
      getEntityId(service) ||
      "unassigned",

    name:
      getServiceName(service),

    category:
      getServiceCategory(
        service
      ),

    listedPrice:
      firstFiniteNumber(
        service?.price
      ),

    duration:
      firstFiniteNumber(
        service?.duration
      ),

    active:
      service?.active !==
      false,

    totalAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    noShowAppointments: 0,
    activeAppointments: 0,

    earnedRevenue: 0,
    collectedRevenue: 0,

    customerIds:
      new Set(),

    monthly:
      createMonthBuckets({
        startDate,
        months,
      }),
  };
}

function finaliseServiceRecord(
  record
) {
  const completionRate =
    record.totalAppointments > 0
      ? (
          record.completedAppointments /
          record.totalAppointments
        ) * 100
      : 0;

  const cancellationRate =
    record.totalAppointments > 0
      ? (
          record.cancelledAppointments /
          record.totalAppointments
        ) * 100
      : 0;

  const noShowRate =
    record.totalAppointments > 0
      ? (
          record.noShowAppointments /
          record.totalAppointments
        ) * 100
      : 0;

  const averageTicket =
    record.completedAppointments > 0
      ? record.earnedRevenue /
        record.completedAppointments
      : 0;

  const currentMonth =
    record.monthly.at(-1);

  const previousMonth =
    record.monthly.at(-2);

  const revenueGrowthRate =
    calculateGrowthRate(
      previousMonth?.earnedRevenue ||
        0,

      currentMonth?.earnedRevenue ||
        0
    );

  return {
    serviceId:
      record.serviceId,

    name:
      record.name,

    category:
      record.category,

    listedPrice:
      roundMoney(
        record.listedPrice
      ),

    duration:
      record.duration,

    active:
      record.active,

    totalAppointments:
      record.totalAppointments,

    completedAppointments:
      record.completedAppointments,

    cancelledAppointments:
      record.cancelledAppointments,

    noShowAppointments:
      record.noShowAppointments,

    activeAppointments:
      record.activeAppointments,

    uniqueCustomers:
      record.customerIds.size,

    earnedRevenue:
      roundMoney(
        record.earnedRevenue
      ),

    collectedRevenue:
      roundMoney(
        record.collectedRevenue
      ),

    averageTicket:
      roundMoney(
        averageTicket
      ),

    completionRate:
      roundPercentage(
        completionRate
      ),

    cancellationRate:
      roundPercentage(
        cancellationRate
      ),

    noShowRate:
      roundPercentage(
        noShowRate
      ),

    revenueGrowthRate,

    monthly:
      record.monthly.map(
        (month) => ({
          ...month,

          earnedRevenue:
            roundMoney(
              month.earnedRevenue
            ),

          collectedRevenue:
            roundMoney(
              month.collectedRevenue
            ),
        })
      ),
  };
}

async function generateServicePerformance({
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
        "service",
        "name title category price duration active"
      )
      .populate(
        "customer",
        "name email"
      )
      .lean();

  const serviceMap =
    new Map();

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

    const service =
      appointment.service;

    const serviceId =
      getEntityId(service) ||
      "unassigned";

    if (
      !serviceMap.has(
        serviceId
      )
    ) {
      serviceMap.set(
        serviceId,
        createServiceRecord({
          service,
          months:
            selectedMonths,
          startDate,
        })
      );
    }

    const record =
      serviceMap.get(
        serviceId
      );

    const status =
      String(
        appointment.status ||
          "pending"
      ).toLowerCase();

    const monthKey =
      getMonthKey(
        appointmentDate
      );

    const monthRecord =
      record.monthly.find(
        (month) =>
          month.month ===
          monthKey
      );

    const revenue =
      getAppointmentRevenue(
        appointment
      );

    const collectedRevenue =
      getCollectedRevenue(
        appointment
      );

    record.totalAppointments +=
      1;

    if (monthRecord) {
      monthRecord.appointments +=
        1;
    }

    const customerId =
      getEntityId(
        appointment.customer
      );

    if (customerId) {
      record.customerIds.add(
        customerId
      );
    }

    if (
      status ===
      COMPLETED_STATUS
    ) {
      record.completedAppointments +=
        1;

      record.earnedRevenue +=
        revenue;

      if (monthRecord) {
        monthRecord.completedAppointments +=
          1;

        monthRecord.earnedRevenue +=
          revenue;
      }
    }

    if (
      status ===
      CANCELLED_STATUS
    ) {
      record.cancelledAppointments +=
        1;

      if (monthRecord) {
        monthRecord.cancelledAppointments +=
          1;
      }
    }

    if (
      status ===
      NO_SHOW_STATUS
    ) {
      record.noShowAppointments +=
        1;

      if (monthRecord) {
        monthRecord.noShowAppointments +=
          1;
      }
    }

    if (
      ACTIVE_STATUSES.has(
        status
      )
    ) {
      record.activeAppointments +=
        1;
    }

    record.collectedRevenue +=
      collectedRevenue;

    if (monthRecord) {
      monthRecord.collectedRevenue +=
        collectedRevenue;
    }
  }

  const services =
    Array.from(
      serviceMap.values()
    )
      .map(
        finaliseServiceRecord
      )
      .sort(
        (first, second) =>
          second.earnedRevenue -
            first.earnedRevenue ||
          second.totalAppointments -
            first.totalAppointments
      );

  const totalAppointments =
    services.reduce(
      (total, service) =>
        total +
        service.totalAppointments,
      0
    );

  const completedAppointments =
    services.reduce(
      (total, service) =>
        total +
        service.completedAppointments,
      0
    );

  const earnedRevenue =
    services.reduce(
      (total, service) =>
        total +
        service.earnedRevenue,
      0
    );

  const collectedRevenue =
    services.reduce(
      (total, service) =>
        total +
        service.collectedRevenue,
      0
    );

  const completionRate =
    totalAppointments > 0
      ? (
          completedAppointments /
          totalAppointments
        ) * 100
      : 0;

  const highestRevenueService =
    services[0]
      ? {
          serviceId:
            services[0]
              .serviceId,

          name:
            services[0].name,

          earnedRevenue:
            services[0]
              .earnedRevenue,
        }
      : null;

  const mostPopularService =
    services.length
      ? [...services].sort(
          (first, second) =>
            second.totalAppointments -
            first.totalAppointments
        )[0]
      : null;

  return {
    generatedAt:
      new Date()
        .toISOString(),

    currency: "GBP",

    timezone:
      "Europe/London",

    period: {
      months:
        selectedMonths,

      startDate:
        startDate
          .toISOString(),

      endDate:
        endDate
          .toISOString(),
    },

    summary: {
      serviceCount:
        services.length,

      totalAppointments,

      completedAppointments,

      earnedRevenue:
        roundMoney(
          earnedRevenue
        ),

      collectedRevenue:
        roundMoney(
          collectedRevenue
        ),

      averageTicket:
        completedAppointments > 0
          ? roundMoney(
              earnedRevenue /
                completedAppointments
            )
          : 0,

      completionRate:
        roundPercentage(
          completionRate
        ),

      highestRevenueService,

      mostPopularService:
        mostPopularService
          ? {
              serviceId:
                mostPopularService
                  .serviceId,

              name:
                mostPopularService
                  .name,

              appointments:
                mostPopularService
                  .totalAppointments,
            }
          : null,
    },

    services,
  };
}

export {
  generateServicePerformance,
};