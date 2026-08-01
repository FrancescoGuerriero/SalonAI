import Appointment from "../../models/Appointment.js";

const ACTIVE_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
];

const ELIGIBLE_STATUSES = [
  "completed",
  "cancelled",
  "no_show",
];

const PRIORITY_WEIGHT = {
  high: 3,
  medium: 2,
  low: 1,
};

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
  return (
    Math.round(
      (Number(value) || 0) * 100
    ) / 100
  );
}

function firstPositiveNumber(
  ...values
) {
  for (const value of values) {
    const numericValue =
      Number(value);

    if (
      Number.isFinite(numericValue) &&
      numericValue > 0
    ) {
      return numericValue;
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
    appointmentDate.setHours(
      Number(timeMatch[1]),
      Number(timeMatch[2]),
      0,
      0
    );
  }

  return appointmentDate;
}

function addDays(
  date,
  days
) {
  const result =
    new Date(date);

  result.setDate(
    result.getDate() + days
  );

  return result;
}

function daysBetween(
  earlierDate,
  laterDate
) {
  return Math.max(
    0,
    Math.floor(
      (
        laterDate.getTime() -
        earlierDate.getTime()
      ) /
        86400000
    )
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

function getAppointmentValue(
  appointment
) {
  return firstPositiveNumber(
    appointment.finalPrice,
    appointment.totalPrice,
    appointment.price,
    appointment.service?.price
  );
}

function getServiceRebookingDays(
  service
) {
  const configuredDays =
    firstPositiveNumber(
      service?.rebookAfterDays,
      service?.recommendedRebookDays,
      service?.repeatAfterDays
    );

  if (configuredDays > 0) {
    return clampInteger(
      configuredDays,
      7,
      365,
      42
    );
  }

  const searchableText =
    `${service?.name || ""} ${
      service?.category || ""
    }`.toLowerCase();

  if (
    searchableText.includes(
      "colour"
    ) ||
    searchableText.includes(
      "color"
    )
  ) {
    return 42;
  }

  if (
    searchableText.includes(
      "haircut"
    ) ||
    searchableText.includes(
      "cut"
    )
  ) {
    return 42;
  }

  if (
    searchableText.includes(
      "extension"
    )
  ) {
    return 56;
  }

  if (
    searchableText.includes(
      "nail"
    )
  ) {
    return 21;
  }

  if (
    searchableText.includes(
      "brow"
    ) ||
    searchableText.includes(
      "lash"
    )
  ) {
    return 28;
  }

  if (
    searchableText.includes(
      "treatment"
    )
  ) {
    return 28;
  }

  return 42;
}

function getPriority({
  sourceStatus,
  daysOverdue,
}) {
  if (
    sourceStatus === "no_show"
  ) {
    return "high";
  }

  if (
    sourceStatus === "cancelled"
  ) {
    return daysOverdue <= 30
      ? "high"
      : "medium";
  }

  if (daysOverdue >= 60) {
    return "high";
  }

  if (daysOverdue >= 21) {
    return "medium";
  }

  return "low";
}

function getReason({
  sourceStatus,
  serviceName,
  daysOverdue,
}) {
  if (
    sourceStatus === "no_show"
  ) {
    return `Customer missed their ${serviceName} appointment and has no future booking.`;
  }

  if (
    sourceStatus === "cancelled"
  ) {
    return `Customer cancelled their ${serviceName} appointment and has not rebooked.`;
  }

  return `${serviceName} is approximately ${daysOverdue} days overdue for rebooking.`;
}

function calculateScore({
  priority,
  daysOverdue,
  estimatedRevenue,
  contactable,
}) {
  return (
    PRIORITY_WEIGHT[
      priority
    ] *
      1000 +
    Math.min(
      daysOverdue,
      365
    ) *
      2 +
    Math.min(
      estimatedRevenue,
      1000
    ) +
    (contactable ? 100 : 0)
  );
}

function createOpportunity({
  appointment,
  now,
}) {
  const appointmentDate =
    getAppointmentDate(
      appointment
    );

  if (!appointmentDate) {
    return null;
  }

  const sourceStatus =
    String(
      appointment.status ||
        ""
    ).toLowerCase();

  const customer =
    appointment.customer;

  const service =
    appointment.service;

  const stylist =
    appointment.stylist;

  const customerId =
    getEntityId(customer);

  if (!customerId) {
    return null;
  }

  const serviceId =
    getEntityId(service);

  const serviceName =
    getEntityName(
      service,
      "Salon service"
    );

  let dueAt =
    appointmentDate;

  if (
    sourceStatus === "completed"
  ) {
    dueAt =
      addDays(
        appointmentDate,
        getServiceRebookingDays(
          service
        )
      );

    if (dueAt > now) {
      return null;
    }
  }

  const daysOverdue =
    daysBetween(
      dueAt,
      now
    );

  const priority =
    getPriority({
      sourceStatus,
      daysOverdue,
    });

  const hasEmail =
    Boolean(
      String(
        customer?.email ||
          ""
      ).trim()
    );

  const hasPhone =
    Boolean(
      String(
        customer?.phone ||
          ""
      ).trim()
    );

  const contactable =
    hasEmail ||
    hasPhone;

  const estimatedRevenue =
    getAppointmentValue(
      appointment
    );

  return {
    opportunityId:
      getEntityId(
        appointment
      ),

    customer: {
      customerId,

      name:
        getEntityName(
          customer,
          "Unknown customer"
        ),

      email:
        customer?.email ||
        "",

      phone:
        customer?.phone ||
        "",

      hasEmail,
      hasPhone,
      contactable,
    },

    service: {
      serviceId,

      name:
        serviceName,

      category:
        service?.category ||
        "",

      price:
        roundMoney(
          service?.price
        ),
    },

    stylist: {
      stylistId:
        getEntityId(
          stylist
        ),

      name:
        getEntityName(
          stylist,
          "Unassigned stylist"
        ),
    },

    sourceStatus,

    priority,

    reason:
      getReason({
        sourceStatus,
        serviceName,
        daysOverdue,
      }),

    appointmentDate:
      appointmentDate
        .toISOString(),

    dueAt:
      dueAt.toISOString(),

    daysSinceAppointment:
      daysBetween(
        appointmentDate,
        now
      ),

    daysOverdue,

    estimatedRevenue:
      roundMoney(
        estimatedRevenue
      ),

    score:
      calculateScore({
        priority,
        daysOverdue,
        estimatedRevenue,
        contactable,
      }),
  };
}

async function generateRebookingOpportunities({
  lookbackDays = 90,
} = {}) {
  const selectedLookbackDays =
    clampInteger(
      lookbackDays,
      7,
      365,
      90
    );

  const now =
    new Date();

  const lookbackStart =
    addDays(
      now,
      -selectedLookbackDays
    );

  const futureEnd =
    addDays(
      now,
      365
    );

  const [
    recentAppointments,
    upcomingAppointments,
  ] =
    await Promise.all([
      Appointment.find({
        status: {
          $in:
            ELIGIBLE_STATUSES,
        },

        $or: [
          {
            startsAt: {
              $gte:
                lookbackStart,

              $lte:
                now,
            },
          },
          {
            appointmentDate: {
              $gte:
                lookbackStart,

              $lte:
                now,
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
          [
            "name",
            "title",
            "category",
            "price",
            "rebookAfterDays",
            "recommendedRebookDays",
            "repeatAfterDays",
          ].join(" ")
        )
        .populate(
          "stylist",
          "firstName lastName name fullName displayName email"
        )
        .sort({
          startsAt: -1,
          appointmentDate: -1,
        })
        .lean(),

      Appointment.find({
        status: {
          $in:
            ACTIVE_STATUSES,
        },

        $or: [
          {
            startsAt: {
              $gt: now,
              $lte:
                futureEnd,
            },
          },
          {
            appointmentDate: {
              $gt: now,
              $lte:
                futureEnd,
            },
          },
        ],
      })
        .select(
          "customer service startsAt appointmentDate status"
        )
        .lean(),
    ]);

  const upcomingCustomerIds =
    new Set(
      upcomingAppointments
        .map(
          (appointment) =>
            getEntityId(
              appointment.customer
            )
        )
        .filter(Boolean)
    );

  const opportunityMap =
    new Map();

  for (
    const appointment
    of recentAppointments
  ) {
    const customerId =
      getEntityId(
        appointment.customer
      );

    if (
      !customerId ||
      upcomingCustomerIds.has(
        customerId
      )
    ) {
      continue;
    }

    const opportunity =
      createOpportunity({
        appointment,
        now,
      });

    if (!opportunity) {
      continue;
    }

    const key =
      [
        opportunity.customer
          .customerId,

        opportunity.service
          .serviceId ||
          "unassigned",
      ].join(":");

    const existing =
      opportunityMap.get(
        key
      );

    if (
      !existing ||
      opportunity.score >
        existing.score
    ) {
      opportunityMap.set(
        key,
        opportunity
      );
    }
  }

  const opportunities =
    Array.from(
      opportunityMap.values()
    ).sort(
      (first, second) =>
        second.score -
          first.score ||
        second.estimatedRevenue -
          first.estimatedRevenue
    );

  const priorityCounts = {
    high: 0,
    medium: 0,
    low: 0,
  };

  const sourceCounts = {
    completed: 0,
    cancelled: 0,
    no_show: 0,
  };

  let estimatedRecoverableRevenue =
    0;

  let contactableOpportunities =
    0;

  for (
    const opportunity
    of opportunities
  ) {
    priorityCounts[
      opportunity.priority
    ] += 1;

    if (
      Object.hasOwn(
        sourceCounts,
        opportunity.sourceStatus
      )
    ) {
      sourceCounts[
        opportunity.sourceStatus
      ] += 1;
    }

    estimatedRecoverableRevenue +=
      opportunity.estimatedRevenue;

    if (
      opportunity.customer
        .contactable
    ) {
      contactableOpportunities +=
        1;
    }
  }

  return {
    generatedAt:
      now.toISOString(),

    currency: "GBP",

    timezone:
      "Europe/London",

    parameters: {
      lookbackDays:
        selectedLookbackDays,
    },

    summary: {
      opportunityCount:
        opportunities.length,

      highPriority:
        priorityCounts.high,

      contactableOpportunities,

      estimatedRecoverableRevenue:
        roundMoney(
          estimatedRecoverableRevenue
        ),

      averageOpportunityValue:
        opportunities.length > 0
          ? roundMoney(
              estimatedRecoverableRevenue /
                opportunities.length
            )
          : 0,

      priorityCounts,
      sourceCounts,

      topOpportunity:
        opportunities[0] ||
        null,
    },

    opportunities,
  };
}

export {
  generateRebookingOpportunities,
};