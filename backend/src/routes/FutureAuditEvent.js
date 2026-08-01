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

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, parsedValue)
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
      date.getUTCMonth() + months,
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

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
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

function getCustomerName(customer) {
  return (
    customer?.name ||
    customer?.fullName ||
    customer?.displayName ||
    customer?.email ||
    "Unknown customer"
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

function daysSince(
  date,
  now
) {
  if (!date) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(
      (
        now.getTime() -
        date.getTime()
      ) /
        86400000
    )
  );
}

function classifyCustomer({
  completedAppointments,
  earnedRevenue,
  daysSinceLastVisit,
}) {
  if (
    completedAppointments === 0
  ) {
    return "prospect";
  }

  if (
    daysSinceLastVisit !== null &&
    daysSinceLastVisit >= 180
  ) {
    return "lapsed";
  }

  if (
    daysSinceLastVisit !== null &&
    daysSinceLastVisit >= 90
  ) {
    return "at_risk";
  }

  if (
    earnedRevenue >= 1000 ||
    completedAppointments >= 10
  ) {
    return "vip";
  }

  if (
    completedAppointments >= 5
  ) {
    return "loyal";
  }

  if (
    completedAppointments === 1
  ) {
    return "new";
  }

  return "regular";
}

function createCustomerRecord({
  customer,
  startDate,
  months,
}) {
  return {
    customerId:
      getEntityId(customer),

    name:
      getCustomerName(customer),

    email:
      customer?.email || "",

    phone:
      customer?.phone || "",

    memberSince:
      customer?.createdAt || null,

    totalAppointments: 0,
    completedAppointments: 0,
    activeAppointments: 0,
    cancelledAppointments: 0,
    noShowAppointments: 0,

    earnedRevenue: 0,
    collectedRevenue: 0,

    firstVisit: null,
    lastVisit: null,

    serviceIds:
      new Set(),

    stylistIds:
      new Set(),

    monthly:
      createMonthBuckets({
        startDate,
        months,
      }),
  };
}

function finaliseCustomerRecord(
  record,
  now
) {
  const averageSpend =
    record.completedAppointments > 0
      ? record.earnedRevenue /
        record.completedAppointments
      : 0;

  const completionRate =
    record.totalAppointments > 0
      ? (
          record.completedAppointments /
          record.totalAppointments
        ) * 100
      : 0;

  const customerDaysSinceLastVisit =
    daysSince(
      record.lastVisit,
      now
    );

  const segment =
    classifyCustomer({
      completedAppointments:
        record.completedAppointments,

      earnedRevenue:
        record.earnedRevenue,

      daysSinceLastVisit:
        customerDaysSinceLastVisit,
    });

  return {
    customerId:
      record.customerId,

    name:
      record.name,

    email:
      record.email,

    phone:
      record.phone,

    memberSince:
      record.memberSince,

    segment,

    totalAppointments:
      record.totalAppointments,

    completedAppointments:
      record.completedAppointments,

    activeAppointments:
      record.activeAppointments,

    cancelledAppointments:
      record.cancelledAppointments,

    noShowAppointments:
      record.noShowAppointments,

    repeatCustomer:
      record.completedAppointments >= 2,

    earnedRevenue:
      roundMoney(
        record.earnedRevenue
      ),

    collectedRevenue:
      roundMoney(
        record.collectedRevenue
      ),

    averageSpend:
      roundMoney(
        averageSpend
      ),

    completionRate:
      roundPercentage(
        completionRate
      ),

    firstVisit:
      record.firstVisit
        ?.toISOString() ||
      null,

    lastVisit:
      record.lastVisit
        ?.toISOString() ||
      null,

    daysSinceLastVisit:
      customerDaysSinceLastVisit,

    uniqueServices:
      record.serviceIds.size,

    uniqueStylists:
      record.stylistIds.size,

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

async function generateCustomerValueAnalytics({
  months = 12,
} = {}) {
  const selectedMonths =
    clampInteger(
      months,
      1,
      24,
      12
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
        "name fullName displayName email phone createdAt"
      )
      .populate(
        "service",
        "name category price"
      )
      .populate(
        "stylist",
        "firstName lastName name fullName displayName email"
      )
      .lean();

  const customerMap =
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
      appointmentDate < startDate ||
      appointmentDate >= endDate
    ) {
      continue;
    }

    const customer =
      appointment.customer;

    const customerId =
      getEntityId(customer);

    if (!customerId) {
      continue;
    }

    if (
      !customerMap.has(
        customerId
      )
    ) {
      customerMap.set(
        customerId,
        createCustomerRecord({
          customer,
          startDate,
          months:
            selectedMonths,
        })
      );
    }

    const record =
      customerMap.get(
        customerId
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

    record.totalAppointments += 1;
    record.collectedRevenue +=
      collectedRevenue;

    if (monthRecord) {
      monthRecord.appointments += 1;
      monthRecord.collectedRevenue +=
        collectedRevenue;
    }

    if (
      ACTIVE_STATUSES.has(
        status
      )
    ) {
      record.activeAppointments += 1;
    }

    if (
      status === CANCELLED_STATUS
    ) {
      record.cancelledAppointments += 1;
    }

    if (
      status === NO_SHOW_STATUS
    ) {
      record.noShowAppointments += 1;
    }

    if (
      status !== COMPLETED_STATUS
    ) {
      continue;
    }

    record.completedAppointments += 1;
    record.earnedRevenue +=
      revenue;

    if (
      !record.firstVisit ||
      appointmentDate <
        record.firstVisit
    ) {
      record.firstVisit =
        appointmentDate;
    }

    if (
      !record.lastVisit ||
      appointmentDate >
        record.lastVisit
    ) {
      record.lastVisit =
        appointmentDate;
    }

    const serviceId =
      getEntityId(
        appointment.service
      );

    const stylistId =
      getEntityId(
        appointment.stylist
      );

    if (serviceId) {
      record.serviceIds.add(
        serviceId
      );
    }

    if (stylistId) {
      record.stylistIds.add(
        stylistId
      );
    }

    if (monthRecord) {
      monthRecord.completedAppointments +=
        1;

      monthRecord.earnedRevenue +=
        revenue;
    }
  }

  const customers =
    Array.from(
      customerMap.values()
    )
      .map(
        (record) =>
          finaliseCustomerRecord(
            record,
            now
          )
      )
      .sort(
        (first, second) =>
          second.earnedRevenue -
            first.earnedRevenue ||
          second.completedAppointments -
            first.completedAppointments
      );

  const repeatCustomers =
    customers.filter(
      (customer) =>
        customer.repeatCustomer
    ).length;

  const earnedRevenue =
    customers.reduce(
      (total, customer) =>
        total +
        customer.earnedRevenue,
      0
    );

  const completedAppointments =
    customers.reduce(
      (total, customer) =>
        total +
        customer.completedAppointments,
      0
    );

  const segmentCounts = {
    vip: 0,
    loyal: 0,
    regular: 0,
    new: 0,
    at_risk: 0,
    lapsed: 0,
    prospect: 0,
  };

  for (
    const customer
    of customers
  ) {
    if (
      Object.hasOwn(
        segmentCounts,
        customer.segment
      )
    ) {
      segmentCounts[
        customer.segment
      ] += 1;
    }
  }

  const topCustomer =
    customers[0]
      ? {
          customerId:
            customers[0]
              .customerId,

          name:
            customers[0]
              .name,

          earnedRevenue:
            customers[0]
              .earnedRevenue,

          completedAppointments:
            customers[0]
              .completedAppointments,
        }
      : null;

  return {
    generatedAt:
      now.toISOString(),

    currency: "GBP",

    timezone:
      "Europe/London",

    period: {
      months:
        selectedMonths,

      startDate:
        startDate.toISOString(),

      endDate:
        endDate.toISOString(),
    },

    summary: {
      customerCount:
        customers.length,

      repeatCustomers,

      repeatRate:
        customers.length > 0
          ? roundPercentage(
              (
                repeatCustomers /
                customers.length
              ) * 100
            )
          : 0,

      completedAppointments,

      earnedRevenue:
        roundMoney(
          earnedRevenue
        ),

      averageCustomerValue:
        customers.length > 0
          ? roundMoney(
              earnedRevenue /
                customers.length
            )
          : 0,

      averageVisitValue:
        completedAppointments > 0
          ? roundMoney(
              earnedRevenue /
                completedAppointments
            )
          : 0,

      segmentCounts,
      topCustomer,
    },

    customers,
  };
}

export {
  generateCustomerValueAnalytics,
};