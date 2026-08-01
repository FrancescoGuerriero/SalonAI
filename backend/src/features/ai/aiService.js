import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import Customer from "../../models/Customer.js";
import CustomerContactLog from "../../models/customerContactLog.js";
import AiPrediction from "./AiPrediction.js";
import ForecastSnapshot from "./ForecastSnapshot.js";
import { generateText } from "../../providers/aiProvider.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import { addDays } from "../../shared/dateUtils.js";

const RETENTION_MODEL_NAME = "salonai-retention-baseline";
const RETENTION_MODEL_VERSION = "2";
const RETENTION_PREDICTION_DAYS = 7;

const RETENTION_PREDICTION_TYPES = [
  "churn_risk",
  "return_probability",
  "recommended_channel",
  "recommended_campaign",
];

const ACTIVE_FUTURE_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
];

const ENGAGED_CONTACT_STATUSES = [
  "sent",
  "delivered",
  "opened",
  "responded",
];

const CONTACT_STATUS_WEIGHTS = {
  draft: 0,
  queued: 0,
  sent: 0.2,
  delivered: 0.45,
  opened: 0.7,
  responded: 1,
  failed: -0.35,
  cancelled: -0.1,
};

function serviceError(
  message,
  statusCode = 500,
  details = null
) {
  const error = createServiceError(
    message,
    statusCode
  );

  if (details) {
    error.details = details;
  }

  return error;
}

function text(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function clamp(
  value,
  minimum = 0,
  maximum = 1
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      Number(value) || 0
    )
  );
}

function round(
  value,
  places = 3
) {
  const multiplier =
    10 ** places;

  return (
    Math.round(
      (Number(value) || 0) *
        multiplier
    ) / multiplier
  );
}

function validDate(value) {
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

function daysBetween(
  first,
  second
) {
  const start =
    validDate(first);

  const end =
    validDate(second);

  if (!start || !end) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(
      (
        end.getTime() -
        start.getTime()
      ) /
        86400000
    )
  );
}

function appointmentStart(
  appointment
) {
  const explicitStart =
    validDate(
      appointment?.startsAt
    );

  if (explicitStart) {
    return explicitStart;
  }

  const appointmentDate =
    validDate(
      appointment?.appointmentDate
    );

  if (!appointmentDate) {
    return null;
  }

  const appointmentTime =
    text(
      appointment?.appointmentTime
    );

  if (
    /^([01]\d|2[0-3]):[0-5]\d$/.test(
      appointmentTime
    )
  ) {
    const [
      hours,
      minutes,
    ] = appointmentTime
      .split(":")
      .map(Number);

    appointmentDate.setHours(
      hours,
      minutes,
      0,
      0
    );
  }

  return appointmentDate;
}

function customerDisplayName(
  customer
) {
  return (
    customer?.preferredName ||
    [
      customer?.firstName,
      customer?.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    customer?.email ||
    "Customer"
  );
}

function percentage(value) {
  return `${Math.round(
    clamp(value) * 100
  )}%`;
}

function addRiskFactor(
  factors,
  {
    key,
    label,
    weight,
    detail,
    category = "behaviour",
  }
) {
  if (!weight) {
    return;
  }

  factors.push({
    key,
    label,
    category,

    impact:
      weight > 0
        ? "increase"
        : "decrease",

    weight:
      round(
        Math.abs(weight)
      ),

    signedWeight:
      round(weight),

    detail,
  });
}

function getRiskLabel(score) {
  if (score >= 0.7) {
    return "high";
  }

  if (score >= 0.4) {
    return "medium";
  }

  return "low";
}

function getReturnLabel(score) {
  if (score >= 0.8) {
    return "very_likely";
  }

  if (score >= 0.6) {
    return "likely";
  }

  if (score >= 0.4) {
    return "uncertain";
  }

  return "unlikely";
}

function calculateAverageVisitInterval(
  completedAppointments
) {
  const dates =
    completedAppointments
      .map(appointmentStart)
      .filter(Boolean)
      .sort(
        (
          left,
          right
        ) =>
          left.getTime() -
          right.getTime()
      );

  if (dates.length < 2) {
    return null;
  }

  const intervals = [];

  for (
    let index = 1;
    index < dates.length;
    index += 1
  ) {
    const interval =
      daysBetween(
        dates[index - 1],
        dates[index]
      );

    if (interval !== null) {
      intervals.push(
        interval
      );
    }
  }

  if (!intervals.length) {
    return null;
  }

  return round(
    intervals.reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    ) /
      intervals.length,
    1
  );
}

function buildAppointmentFeatures(
  customer,
  appointments,
  now = new Date()
) {
  const completedAppointments =
    appointments
      .filter(
        (
          appointment
        ) =>
          appointment.status ===
          "completed"
      )
      .sort(
        (
          left,
          right
        ) =>
          (
            appointmentStart(
              right
            )?.getTime() ||
            0
          ) -
          (
            appointmentStart(
              left
            )?.getTime() ||
            0
          )
      );

  const futureAppointments =
    appointments
      .filter(
        (
          appointment
        ) => {
          const start =
            appointmentStart(
              appointment
            );

          return (
            start &&
            start > now &&
            ACTIVE_FUTURE_STATUSES.includes(
              appointment.status
            )
          );
        }
      )
      .sort(
        (
          left,
          right
        ) =>
          appointmentStart(
            left
          ).getTime() -
          appointmentStart(
            right
          ).getTime()
      );

  const cancelledAppointments =
    appointments.filter(
      (
        appointment
      ) =>
        appointment.status ===
        "cancelled"
    );

  const noShowAppointments =
    appointments.filter(
      (
        appointment
      ) =>
        appointment.status ===
        "no_show"
    );

  const lastCompletedAt =
    appointmentStart(
      completedAppointments[0]
    ) ||
    validDate(
      customer.lastVisit
    );

  const customerNextAppointment =
    validDate(
      customer.nextAppointment
    );

  const nextAppointmentAt =
    appointmentStart(
      futureAppointments[0]
    ) ||
    (
      customerNextAppointment &&
      customerNextAppointment >
        now
        ? customerNextAppointment
        : null
    );

  const completedSpend =
    completedAppointments.reduce(
      (
        sum,
        appointment
      ) =>
        sum +
        Math.max(
          0,
          Number(
            appointment.totalPrice ??
              appointment.price ??
              0
          ) || 0
        ),
      0
    );

  const appointmentCount =
    appointments.length;

  const completedCount =
    completedAppointments.length;

  const cancelledCount =
    cancelledAppointments.length;

  const noShowCount =
    noShowAppointments.length;

  const averageVisitIntervalDays =
    calculateAverageVisitInterval(
      completedAppointments
    );

  const daysSinceLastCompleted =
    lastCompletedAt
      ? daysBetween(
          lastCompletedAt,
          now
        )
      : null;

  const expectedReturnBy =
    lastCompletedAt &&
    averageVisitIntervalDays
      ? addDays(
          lastCompletedAt,
          Math.round(
            averageVisitIntervalDays
          )
        )
      : null;

  return {
    appointmentCount,
    completedCount,
    cancelledCount,
    noShowCount,

    futureAppointmentCount:
      futureAppointments.length,

    hasFutureAppointment:
      futureAppointments.length >
      0,

    lastCompletedAt,
    nextAppointmentAt,
    daysSinceLastCompleted,
    averageVisitIntervalDays,
    expectedReturnBy,

    daysPastExpectedReturn:
      expectedReturnBy &&
      expectedReturnBy < now
        ? daysBetween(
            expectedReturnBy,
            now
          )
        : 0,

    cancellationRate:
      appointmentCount > 0
        ? round(
            cancelledCount /
              appointmentCount
          )
        : 0,

    noShowRate:
      appointmentCount > 0
        ? round(
            noShowCount /
              appointmentCount
          )
        : 0,

    completedSpend:
      round(
        completedSpend,
        2
      ),

    averageCompletedSpend:
      completedCount > 0
        ? round(
            completedSpend /
              completedCount,
            2
          )
        : 0,
  };
}

function channelEligibility(
  customer
) {
  const preferences =
    customer.communicationPreferences ||
    {};

  const marketing =
    customer.marketing ||
    {};

  const globallyUnsubscribed =
    Boolean(
      preferences.unsubscribed
    );

  const promotionalMessagesAllowed =
    preferences.promotionalMessages !==
    false;

  const preferredChannel =
    text(
      preferences.preferredChannel ||
        customer
          .bookingPreferences
          ?.preferredReminderChannel ||
        "email"
    ).toLowerCase();

  return {
    preferredChannel,

    email:
      Boolean(
        customer.email &&
          !globallyUnsubscribed &&
          !preferences
            .emailUnsubscribed &&
          promotionalMessagesAllowed &&
          marketing.emailConsent !==
            false
      ),

    sms:
      Boolean(
        customer.phone &&
          !globallyUnsubscribed &&
          !preferences
            .smsUnsubscribed &&
          promotionalMessagesAllowed &&
          marketing.smsConsent ===
            true
      ),

    phone:
      Boolean(
        customer.phone &&
          !globallyUnsubscribed &&
          promotionalMessagesAllowed &&
          preferredChannel ===
            "phone"
      ),

    whatsapp:
      Boolean(
        customer.phone &&
          !globallyUnsubscribed &&
          promotionalMessagesAllowed &&
          preferredChannel ===
            "whatsapp"
      ),
  };
}

function buildCommunicationFeatures(
  customer,
  contacts
) {
  const channelStats = {};

  let outboundCount = 0;
  let engagedCount = 0;
  let respondedCount = 0;
  let failedCount = 0;

  for (
    const contact of contacts
  ) {
    const channel =
      text(
        contact.channel
      ).toLowerCase() ||
      "unknown";

    if (
      !channelStats[
        channel
      ]
    ) {
      channelStats[
        channel
      ] = {
        total: 0,
        outbound: 0,
        sent: 0,
        delivered: 0,
        opened: 0,
        responded: 0,
        failed: 0,
        engagementScore: 0,
      };
    }

    const stats =
      channelStats[
        channel
      ];

    const status =
      text(
        contact.status
      ).toLowerCase();

    stats.total += 1;

    if (
      contact.direction !==
      "inbound"
    ) {
      stats.outbound += 1;
      outboundCount += 1;
    }

    if (
      Object.hasOwn(
        stats,
        status
      )
    ) {
      stats[
        status
      ] += 1;
    }

    if (
      ENGAGED_CONTACT_STATUSES.includes(
        status
      )
    ) {
      engagedCount += 1;
    }

    if (
      status ===
        "responded" ||
      contact.direction ===
        "inbound"
    ) {
      respondedCount += 1;
    }

    if (
      status ===
      "failed"
    ) {
      failedCount += 1;
    }

    stats.engagementScore +=
      CONTACT_STATUS_WEIGHTS[
        status
      ] || 0;
  }

  for (
    const stats of
    Object.values(
      channelStats
    )
  ) {
    stats.engagementScore =
      round(
        stats.outbound > 0
          ? stats
              .engagementScore /
              stats.outbound
          : 0
      );
  }

  const eligibility =
    channelEligibility(
      customer
    );

  const candidateChannels =
    [
      "email",
      "sms",
      "phone",
      "whatsapp",
    ].filter(
      (
        channel
      ) =>
        eligibility[
          channel
        ]
    );

  const rankedChannels =
    candidateChannels
      .map(
        (
          channel
        ) => {
          const stats =
            channelStats[
              channel
            ] || {
              outbound: 0,
              responded: 0,
              engagementScore: 0,
            };

          const preferenceBonus =
            eligibility
              .preferredChannel ===
            channel
              ? 0.2
              : 0;

          const responseBonus =
            stats.responded >
            0
              ? 0.15
              : 0;

          return {
            channel,

            score:
              round(
                stats
                  .engagementScore +
                  preferenceBonus +
                  responseBonus
              ),

            historyCount:
              stats.outbound,
          };
        }
      )
      .sort(
        (
          left,
          right
        ) =>
          right.score -
            left.score ||
          right.historyCount -
            left.historyCount
      );

  return {
    contactCount:
      contacts.length,

    outboundCount,
    engagedCount,
    respondedCount,
    failedCount,

    engagementRate:
      outboundCount > 0
        ? round(
            engagedCount /
              outboundCount
          )
        : 0,

    responseRate:
      outboundCount > 0
        ? round(
            respondedCount /
              outboundCount
          )
        : 0,

    failureRate:
      outboundCount > 0
        ? round(
            failedCount /
              outboundCount
          )
        : 0,

    channelStats,

    eligibleChannels:
      candidateChannels,

    preferredChannel:
      eligibility
        .preferredChannel,

    recommendedChannel:
      rankedChannels[0]
        ?.channel ||
      "none",

    recommendedChannelScore:
      rankedChannels[0]
        ?.score ||
      0,
  };
}

function calculateRetentionRisk(
  customer,
  appointmentFeatures,
  communicationFeatures
) {
  const factors = [];

  let score = 0.2;

  const daysSinceLastCompleted =
    appointmentFeatures
      .daysSinceLastCompleted;

  if (
    daysSinceLastCompleted ===
    null
  ) {
    score += 0.38;

    addRiskFactor(
      factors,
      {
        key:
          "no_completed_visits",

        label:
          "No completed appointment history",

        weight: 0.38,

        detail:
          "The customer has no completed salon visit recorded.",

        category:
          "recency",
      }
    );
  } else if (
    daysSinceLastCompleted >
    365
  ) {
    score += 0.5;

    addRiskFactor(
      factors,
      {
        key:
          "very_long_absence",

        label:
          "More than one year since the last visit",

        weight: 0.5,

        detail:
          `${daysSinceLastCompleted} days have passed since the last completed appointment.`,

        category:
          "recency",
      }
    );
  } else if (
    daysSinceLastCompleted >
    180
  ) {
    score += 0.38;

    addRiskFactor(
      factors,
      {
        key:
          "long_absence",

        label:
          "Long time since the last visit",

        weight: 0.38,

        detail:
          `${daysSinceLastCompleted} days have passed since the last completed appointment.`,

        category:
          "recency",
      }
    );
  } else if (
    daysSinceLastCompleted >
    120
  ) {
    score += 0.28;

    addRiskFactor(
      factors,
      {
        key:
          "overdue_visit",

        label:
          "Customer is overdue for a return visit",

        weight: 0.28,

        detail:
          `${daysSinceLastCompleted} days have passed since the last completed appointment.`,

        category:
          "recency",
      }
    );
  } else if (
    daysSinceLastCompleted >
    90
  ) {
    score += 0.2;

    addRiskFactor(
      factors,
      {
        key:
          "declining_recency",

        label:
          "Visit recency is declining",

        weight: 0.2,

        detail:
          `${daysSinceLastCompleted} days have passed since the last completed appointment.`,

        category:
          "recency",
      }
    );
  } else if (
    daysSinceLastCompleted >
    60
  ) {
    score += 0.12;

    addRiskFactor(
      factors,
      {
        key:
          "return_window",

        label:
          "Customer is approaching the rebooking window",

        weight: 0.12,

        detail:
          `${daysSinceLastCompleted} days have passed since the last completed appointment.`,

        category:
          "recency",
      }
    );
  } else if (
    daysSinceLastCompleted <=
    30
  ) {
    score -= 0.12;

    addRiskFactor(
      factors,
      {
        key:
          "recent_visit",

        label:
          "Recent completed visit",

        weight:
          -0.12,

        detail:
          "The customer visited within the last 30 days.",

        category:
          "recency",
      }
    );
  }

  if (
    appointmentFeatures
      .hasFutureAppointment
  ) {
    score -= 0.35;

    addRiskFactor(
      factors,
      {
        key:
          "future_booking",

        label:
          "Future appointment already booked",

        weight:
          -0.35,

        detail:
          `The next appointment is scheduled for ${appointmentFeatures.nextAppointmentAt.toISOString()}.`,

        category:
          "booking",
      }
    );
  }

  if (
    appointmentFeatures
      .completedCount <= 1
  ) {
    score += 0.1;

    addRiskFactor(
      factors,
      {
        key:
          "limited_history",

        label:
          "Limited completed-visit history",

        weight: 0.1,

        detail:
          `${appointmentFeatures.completedCount} completed appointment(s) are recorded.`,

        category:
          "loyalty",
      }
    );
  } else if (
    appointmentFeatures
      .completedCount >= 8
  ) {
    score -= 0.1;

    addRiskFactor(
      factors,
      {
        key:
          "established_customer",

        label:
          "Established repeat customer",

        weight:
          -0.1,

        detail:
          `${appointmentFeatures.completedCount} completed appointments are recorded.`,

        category:
          "loyalty",
      }
    );
  }

  if (
    appointmentFeatures
      .noShowRate >= 0.25
  ) {
    score += 0.18;

    addRiskFactor(
      factors,
      {
        key:
          "high_no_show_rate",

        label:
          "High no-show rate",

        weight: 0.18,

        detail:
          `${percentage(
            appointmentFeatures
              .noShowRate
          )} of recorded appointments were no-shows.`,

        category:
          "booking",
      }
    );
  } else if (
    appointmentFeatures
      .noShowCount > 0
  ) {
    score += 0.08;

    addRiskFactor(
      factors,
      {
        key:
          "no_show_history",

        label:
          "Previous no-show",

        weight: 0.08,

        detail:
          `${appointmentFeatures.noShowCount} no-show appointment(s) are recorded.`,

        category:
          "booking",
      }
    );
  }

  if (
    appointmentFeatures
      .cancellationRate >=
    0.4
  ) {
    score += 0.15;

    addRiskFactor(
      factors,
      {
        key:
          "high_cancellation_rate",

        label:
          "High cancellation rate",

        weight: 0.15,

        detail:
          `${percentage(
            appointmentFeatures
              .cancellationRate
          )} of recorded appointments were cancelled.`,

        category:
          "booking",
      }
    );
  }

  if (
    appointmentFeatures
      .averageVisitIntervalDays &&
    appointmentFeatures
      .daysPastExpectedReturn >
      0
  ) {
    const cadenceWeight =
      Math.min(
        0.18,
        (
          appointmentFeatures
            .daysPastExpectedReturn /
          Math.max(
            appointmentFeatures
              .averageVisitIntervalDays,
            1
          )
        ) *
          0.12
      );

    score += cadenceWeight;

    addRiskFactor(
      factors,
      {
        key:
          "past_expected_return",

        label:
          "Past the usual return interval",

        weight:
          cadenceWeight,

        detail:
          `The customer is approximately ${appointmentFeatures.daysPastExpectedReturn} day(s) past their usual return interval.`,

        category:
          "recency",
      }
    );
  }

  if (
    communicationFeatures
      .outboundCount >= 3 &&
    communicationFeatures
      .responseRate === 0
  ) {
    score += 0.1;

    addRiskFactor(
      factors,
      {
        key:
          "no_communication_response",

        label:
          "No response to recent communications",

        weight: 0.1,

        detail:
          `${communicationFeatures.outboundCount} outbound communications are recorded without a response.`,

        category:
          "engagement",
      }
    );
  } else if (
    communicationFeatures
      .responseRate >= 0.3
  ) {
    score -= 0.08;

    addRiskFactor(
      factors,
      {
        key:
          "strong_response_rate",

        label:
          "Strong communication response rate",

        weight:
          -0.08,

        detail:
          `The recorded response rate is ${percentage(
            communicationFeatures
              .responseRate
          )}.`,

        category:
          "engagement",
      }
    );
  }

  if (
    communicationFeatures
      .failureRate >= 0.4
  ) {
    score += 0.07;

    addRiskFactor(
      factors,
      {
        key:
          "delivery_failures",

        label:
          "Frequent communication-delivery failures",

        weight: 0.07,

        detail:
          `${percentage(
            communicationFeatures
              .failureRate
          )} of outbound communications failed.`,

        category:
          "engagement",
      }
    );
  }

  if (
    !communicationFeatures
      .eligibleChannels.length
  ) {
    score += 0.06;

    addRiskFactor(
      factors,
      {
        key:
          "no_eligible_channel",

        label:
          "No consented retention channel available",

        weight: 0.06,

        detail:
          "No eligible email, SMS, phone or WhatsApp retention channel is currently available.",

        category:
          "consent",
      }
    );
  }

  if (
    customer.membershipStatus ===
    "active"
  ) {
    score -= 0.08;

    addRiskFactor(
      factors,
      {
        key:
          "active_membership",

        label:
          "Active salon membership",

        weight:
          -0.08,

        detail:
          customer.membershipName
            ? `The customer has an active ${customer.membershipName} membership.`
            : "The customer has an active salon membership.",

        category:
          "loyalty",
      }
    );
  }

  if (
    [
      "gold",
      "platinum",
    ].includes(
      customer.loyaltyTier
    )
  ) {
    score -= 0.05;

    addRiskFactor(
      factors,
      {
        key:
          "high_loyalty_tier",

        label:
          "High loyalty tier",

        weight:
          -0.05,

        detail:
          `The customer is in the ${customer.loyaltyTier} loyalty tier.`,

        category:
          "loyalty",
      }
    );
  }

  if (
    customer.status ===
    "inactive"
  ) {
    score += 0.22;

    addRiskFactor(
      factors,
      {
        key:
          "inactive_customer",

        label:
          "Customer profile is inactive",

        weight: 0.22,

        detail:
          "The customer profile is currently marked inactive.",

        category:
          "profile",
      }
    );
  }

  const finalScore =
    round(
      clamp(score)
    );

  return {
    score:
      finalScore,

    label:
      getRiskLabel(
        finalScore
      ),

    factors:
      factors.sort(
        (
          left,
          right
        ) =>
          Math.abs(
            right.signedWeight
          ) -
          Math.abs(
            left.signedWeight
          )
      ),
  };
}

function buildRecommendedActions(
  customer,
  appointmentFeatures,
  communicationFeatures,
  risk
) {
  const actions = [];

  if (
    appointmentFeatures
      .hasFutureAppointment
  ) {
    actions.push({
      action:
        "protect_future_booking",

      priority:
        "normal",

      title:
        "Protect the existing booking",

      description:
        "Send a timely appointment reminder and make rescheduling easy if the customer cannot attend.",
    });
  } else if (
    risk.label ===
    "high"
  ) {
    actions.push({
      action:
        "personal_win_back",

      priority:
        "urgent",

      title:
        "Start a personalised win-back",

      description:
        "Contact the customer personally, acknowledge the length of absence and offer a clear rebooking route.",
    });
  } else if (
    risk.label ===
    "medium"
  ) {
    actions.push({
      action:
        "rebooking_prompt",

      priority:
        "high",

      title:
        "Send a rebooking prompt",

      description:
        "Recommend a suitable return appointment based on the customer’s normal visit interval.",
    });
  }

  if (
    appointmentFeatures
      .completedSpend >= 300 &&
    risk.label !==
      "low"
  ) {
    actions.push({
      action:
        "high_value_recovery",

      priority:
        "high",

      title:
        "Prioritise high-value recovery",

      description:
        "This customer has meaningful historical spend, so use a tailored offer rather than a generic promotion.",
    });
  }

  if (
    appointmentFeatures
      .noShowCount > 0
  ) {
    actions.push({
      action:
        "reduce_no_show_risk",

      priority:
        "normal",

      title:
        "Reduce future no-show risk",

      description:
        "Use confirmation messages, a convenient reschedule link and an appropriate deposit policy.",
    });
  }

  if (
    appointmentFeatures
      .cancellationRate >=
    0.4
  ) {
    actions.push({
      action:
        "offer_flexible_scheduling",

      priority:
        "normal",

      title:
        "Offer flexible scheduling",

      description:
        "Ask whether another day, time or stylist would make booking easier.",
    });
  }

  if (
    communicationFeatures
      .recommendedChannel !==
    "none"
  ) {
    actions.push({
      action:
        "use_recommended_channel",

      priority:
        "normal",

      title:
        `Use ${communicationFeatures.recommendedChannel}`,

      description:
        `Use the customer’s consented ${communicationFeatures.recommendedChannel} channel for the next retention contact.`,
    });
  } else {
    actions.push({
      action:
        "refresh_contact_consent",

      priority:
        "high",

      title:
        "Refresh contact details and consent",

      description:
        "Confirm the customer’s current contact details and communication preferences before sending retention marketing.",
    });
  }

  if (
    customer.membershipStatus ===
    "active"
  ) {
    actions.push({
      action:
        "highlight_membership_value",

      priority:
        "normal",

      title:
        "Highlight membership value",

      description:
        "Remind the customer about unused membership benefits or upcoming expiry dates.",
    });
  }

  return actions.slice(
    0,
    6
  );
}

function selectRecommendedCampaign(
  appointmentFeatures,
  risk,
  communicationFeatures
) {
  if (
    appointmentFeatures
      .hasFutureAppointment
  ) {
    return {
      label:
        "appointment_reminder",

      score: 0.95,

      explanation:
        "The customer already has a future booking, so retention activity should protect attendance rather than send a win-back promotion.",
    };
  }

  if (
    risk.label ===
      "high" &&
    appointmentFeatures
      .completedSpend >= 300
  ) {
    return {
      label:
        "high_value_win_back",

      score:
        risk.score,

      explanation:
        "The customer has high churn risk and meaningful historical spend, making a personalised high-value win-back appropriate.",
    };
  }

  if (
    risk.label ===
    "high"
  ) {
    return {
      label:
        "dormant_customer",

      score:
        risk.score,

      explanation:
        "The customer has high churn risk and no current appointment, so a dormant-customer reactivation campaign is recommended.",
    };
  }

  if (
    appointmentFeatures
      .noShowCount > 0
  ) {
    return {
      label:
        "no_show_recovery",

      score:
        clamp(
          0.55 +
            appointmentFeatures
              .noShowRate
        ),

      explanation:
        "A no-show recovery message should make rebooking straightforward and reduce the risk of another missed visit.",
    };
  }

  if (
    risk.label ===
    "medium"
  ) {
    return {
      label:
        "rebooking_prompt",

      score:
        risk.score,

      explanation:
        "The customer has medium churn risk and should receive a timely rebooking prompt.",
    };
  }

  return {
    label:
      communicationFeatures
        .responseRate >= 0.3
        ? "loyalty_nurture"
        : "general_reengagement",

    score:
      clamp(
        1 -
          risk.score
      ),

    explanation:
      "The customer currently has low churn risk, so light-touch loyalty or general engagement is appropriate.",
  };
}

function buildExplanation(
  risk,
  appointmentFeatures,
  communicationFeatures
) {
  const strongestFactors =
    risk.factors
      .filter(
        (
          factor
        ) =>
          factor.impact ===
          "increase"
      )
      .slice(
        0,
        3
      )
      .map(
        (
          factor
        ) =>
          factor.label
            .toLowerCase()
      );

  const factorText =
    strongestFactors.length
      ? strongestFactors.join(
          ", "
        )
      : "recent visits and positive engagement signals";

  return `Retention risk is ${risk.label} (${percentage(
    risk.score
  )}). The strongest signals are ${factorText}. ${
    appointmentFeatures
      .hasFutureAppointment
      ? "A future appointment materially reduces the immediate churn risk."
      : "No future appointment is currently recorded."
  } Recommended contact channel: ${communicationFeatures.recommendedChannel}.`;
}

async function loadRetentionSourceData(
  customerId
) {
  const [
    appointments,
    contacts,
  ] = await Promise.all([
    Appointment.find({
      customer:
        customerId,
    })
      .sort({
        startsAt: -1,
        appointmentDate: -1,
      })
      .lean(),

    CustomerContactLog.find({
      customer:
        customerId,
    })
      .sort({
        createdAt:
          -1,
      })
      .lean(),
  ]);

  return {
    appointments,
    contacts,
  };
}

async function upsertPrediction({
  customerId,
  predictionType,
  score,
  label,
  explanation,
  features,
  expiresAt,
}) {
  return AiPrediction.findOneAndUpdate(
    {
      customer:
        customerId,

      predictionType,
    },
    {
      $set: {
        score,
        label,
        explanation,

        modelName:
          RETENTION_MODEL_NAME,

        modelVersion:
          RETENTION_MODEL_VERSION,

        features,
        expiresAt,
      },

      $setOnInsert: {
        customer:
          customerId,

        predictionType,
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

async function calculateAndStoreRetention(
  customer
) {
  const now =
    new Date();

  const {
    appointments,
    contacts,
  } =
    await loadRetentionSourceData(
      customer._id
    );

  const appointmentFeatures =
    buildAppointmentFeatures(
      customer,
      appointments,
      now
    );

  const communicationFeatures =
    buildCommunicationFeatures(
      customer,
      contacts
    );

  const risk =
    calculateRetentionRisk(
      customer,
      appointmentFeatures,
      communicationFeatures
    );

  const returnScore =
    round(
      clamp(
        1 -
          risk.score +
          (
            appointmentFeatures
              .hasFutureAppointment
              ? 0.18
              : 0
          ) +
          Math.min(
            0.08,
            communicationFeatures
              .responseRate *
              0.2
          )
      )
    );

  const campaign =
    selectRecommendedCampaign(
      appointmentFeatures,
      risk,
      communicationFeatures
    );

  const recommendedActions =
    buildRecommendedActions(
      customer,
      appointmentFeatures,
      communicationFeatures,
      risk
    );

  const explanation =
    buildExplanation(
      risk,
      appointmentFeatures,
      communicationFeatures
    );

  const expiresAt =
    addDays(
      now,
      RETENTION_PREDICTION_DAYS
    );

  const commonFeatures = {
    generatedAt:
      now,

    customerStatus:
      customer.status,

    appointment:
      appointmentFeatures,

    communication:
      communicationFeatures,

    riskFactors:
      risk.factors,

    recommendedActions,
  };

  const [
    riskPrediction,
    returnPrediction,
    channelPrediction,
    campaignPrediction,
  ] =
    await Promise.all([
      upsertPrediction({
        customerId:
          customer._id,

        predictionType:
          "churn_risk",

        score:
          risk.score,

        label:
          risk.label,

        explanation,

        features:
          commonFeatures,

        expiresAt,
      }),

      upsertPrediction({
        customerId:
          customer._id,

        predictionType:
          "return_probability",

        score:
          returnScore,

        label:
          getReturnLabel(
            returnScore
          ),

        explanation:
          `Estimated return probability is ${percentage(
            returnScore
          )}, based on booking recency, visit cadence, future bookings and engagement history.`,

        features:
          commonFeatures,

        expiresAt,
      }),

      upsertPrediction({
        customerId:
          customer._id,

        predictionType:
          "recommended_channel",

        score:
          clamp(
            communicationFeatures
              .recommendedChannelScore
          ),

        label:
          communicationFeatures
            .recommendedChannel,

        explanation:
          communicationFeatures
            .recommendedChannel ===
          "none"
            ? "No consented retention channel is currently available."
            : `The recommended channel is ${communicationFeatures.recommendedChannel}, based on consent, contact availability, preference and recorded engagement.`,

        features: {
          generatedAt:
            now,

          communication:
            communicationFeatures,
        },

        expiresAt,
      }),

      upsertPrediction({
        customerId:
          customer._id,

        predictionType:
          "recommended_campaign",

        score:
          round(
            clamp(
              campaign.score
            )
          ),

        label:
          campaign.label,

        explanation:
          campaign.explanation,

        features: {
          generatedAt:
            now,

          riskLabel:
            risk.label,

          recommendedActions,

          appointment:
            appointmentFeatures,
        },

        expiresAt,
      }),
    ]);

  return {
    customer: {
      _id:
        customer._id,

      firstName:
        customer.firstName,

      lastName:
        customer.lastName,

      preferredName:
        customer.preferredName,

      displayName:
        customerDisplayName(
          customer
        ),

      email:
        customer.email ||
        "",

      phone:
        customer.phone ||
        "",

      status:
        customer.status,

      loyaltyTier:
        customer.loyaltyTier,

      membershipStatus:
        customer.membershipStatus,

      totalSpent:
        Number(
          customer.totalSpent ||
            0
        ),
    },

    risk:
      riskPrediction,

    returnProbability:
      returnPrediction,

    recommendedChannel:
      channelPrediction,

    recommendedCampaign:
      campaignPrediction,

    riskFactors:
      risk.factors,

    recommendedActions,

    features:
      commonFeatures,

    generatedAt:
      now,

    expiresAt,
    fresh: true,
  };
}

export async function getStoredRetentionPrediction(
  customerId
) {
  if (
    !mongoose.isValidObjectId(
      customerId
    )
  ) {
    throw serviceError(
      "Customer identifier is invalid.",
      400
    );
  }

  const predictions =
    await AiPrediction.find({
      customer:
        customerId,

      predictionType: {
        $in:
          RETENTION_PREDICTION_TYPES,
      },
    })
      .sort({
        updatedAt:
          -1,
      })
      .lean();

  if (
    !predictions.length
  ) {
    return null;
  }

  const byType =
    Object.fromEntries(
      predictions.map(
        (
          prediction
        ) => [
          prediction
            .predictionType,
          prediction,
        ]
      )
    );

  const expiresAt =
    predictions
      .map(
        (
          prediction
        ) =>
          validDate(
            prediction.expiresAt
          )
      )
      .filter(Boolean)
      .sort(
        (
          left,
          right
        ) =>
          left.getTime() -
          right.getTime()
      )[0];

  return {
    risk:
      byType.churn_risk ||
      null,

    returnProbability:
      byType
        .return_probability ||
      null,

    recommendedChannel:
      byType
        .recommended_channel ||
      null,

    recommendedCampaign:
      byType
        .recommended_campaign ||
      null,

    generatedAt:
      byType.churn_risk
        ?.updatedAt ||
      null,

    expiresAt:
      expiresAt ||
      null,

    fresh:
      Boolean(
        RETENTION_PREDICTION_TYPES.every(
          (
            type
          ) =>
            byType[type]
        ) &&
          expiresAt &&
          expiresAt >
            new Date()
      ),
  };
}

export async function predictRetention(
  customerId,
  {
    force = true,
  } = {}
) {
  if (
    !mongoose.isValidObjectId(
      customerId
    )
  ) {
    throw serviceError(
      "Customer identifier is invalid.",
      400
    );
  }

  const customer =
    assertFound(
      await Customer.findById(
        customerId
      ).lean(),

      "Customer not found."
    );

  if (
    customer.status ===
    "deleted"
  ) {
    throw serviceError(
      "Retention cannot be predicted for a deleted customer.",
      409
    );
  }

  if (!force) {
    const stored =
      await getStoredRetentionPrediction(
        customerId
      );

    if (stored?.fresh) {
      return {
        customer: {
          _id:
            customer._id,

          firstName:
            customer.firstName,

          lastName:
            customer.lastName,

          preferredName:
            customer.preferredName,

          displayName:
            customerDisplayName(
              customer
            ),

          email:
            customer.email ||
            "",

          phone:
            customer.phone ||
            "",

          status:
            customer.status,
        },

        ...stored,
      };
    }
  }

  return calculateAndStoreRetention(
    customer
  );
}

export async function predictRetentionBatch({
  customerIds = [],
  status = "active",
  limit = 100,
  force = false,
  concurrency = 5,
} = {}) {
  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) ||
          100,
        1
      ),
      500
    );

  const safeConcurrency =
    Math.min(
      Math.max(
        Number(concurrency) ||
          5,
        1
      ),
      20
    );

  const query = {};

  if (
    Array.isArray(
      customerIds
    ) &&
    customerIds.length
  ) {
    const validIds =
      Array.from(
        new Set(
          customerIds.map(
            String
          )
        )
      ).filter(
        (
          id
        ) =>
          mongoose.isValidObjectId(
            id
          )
      );

    if (
      !validIds.length
    ) {
      throw serviceError(
        "No valid customer identifiers were supplied.",
        400
      );
    }

    query._id = {
      $in:
        validIds,
    };
  } else if (
    status &&
    status !==
      "all"
  ) {
    query.status =
      status;
  }

  const customers =
    await Customer.find(
      query
    )
      .sort({
        lastVisit: 1,
        createdAt: 1,
      })
      .limit(
        safeLimit
      )
      .lean();

  const results = [];

  for (
    let index = 0;
    index <
      customers.length;
    index +=
      safeConcurrency
  ) {
    const batch =
      customers.slice(
        index,
        index +
          safeConcurrency
      );

    const settled =
      await Promise.allSettled(
        batch.map(
          async (
            customer
          ) => {
            if (!force) {
              const stored =
                await getStoredRetentionPrediction(
                  customer._id
                );

              if (
                stored?.fresh
              ) {
                return {
                  customerId:
                    String(
                      customer._id
                    ),

                  success:
                    true,

                  refreshed:
                    false,

                  risk:
                    stored.risk,
                };
              }
            }

            const prediction =
              await calculateAndStoreRetention(
                customer
              );

            return {
              customerId:
                String(
                  customer._id
                ),

              success:
                true,

              refreshed:
                true,

              risk:
                prediction.risk,
            };
          }
        )
      );

    settled.forEach(
      (
        result,
        batchIndex
      ) => {
        const customer =
          batch[
            batchIndex
          ];

        if (
          result.status ===
          "fulfilled"
        ) {
          results.push(
            result.value
          );
        } else {
          results.push({
            customerId:
              String(
                customer._id
              ),

            success:
              false,

            refreshed:
              false,

            error:
              result.reason
                ?.message ||
              "Prediction failed.",
          });
        }
      }
    );
  }

  return {
    requested:
      customers.length,

    succeeded:
      results.filter(
        (
          result
        ) =>
          result.success
      ).length,

    failed:
      results.filter(
        (
          result
        ) =>
          !result.success
      ).length,

    refreshed:
      results.filter(
        (
          result
        ) =>
          result.refreshed
      ).length,

    reused:
      results.filter(
        (
          result
        ) =>
          result.success &&
          result.refreshed ===
            false
      ).length,

    results,
  };
}

export async function listRetentionPredictions(
  query = {}
) {
  const page =
    Math.max(
      Number(
        query.page
      ) || 1,
      1
    );

  const limit =
    Math.min(
      Math.max(
        Number(
          query.limit
        ) || 25,
        1
      ),
      100
    );

  const skip =
    (page - 1) *
    limit;

  const match = {
    predictionType:
      "churn_risk",
  };

  if (
    query.label &&
    query.label !==
      "all"
  ) {
    if (
      ![
        "low",
        "medium",
        "high",
      ].includes(
        query.label
      )
    ) {
      throw serviceError(
        "Risk label must be low, medium or high.",
        400
      );
    }

    match.label =
      query.label;
  }

  if (
    query.minScore !==
      undefined ||
    query.maxScore !==
      undefined
  ) {
    match.score = {};

    if (
      query.minScore !==
      undefined
    ) {
      match.score.$gte =
        clamp(
          query.minScore
        );
    }

    if (
      query.maxScore !==
      undefined
    ) {
      match.score.$lte =
        clamp(
          query.maxScore
        );
    }
  }

  if (
    String(
      query.includeExpired
    ).toLowerCase() !==
    "true"
  ) {
    match.expiresAt = {
      $gt:
        new Date(),
    };
  }

  if (
    query.customer
  ) {
    if (
      !mongoose.isValidObjectId(
        query.customer
      )
    ) {
      throw serviceError(
        "Customer identifier is invalid.",
        400
      );
    }

    match.customer =
      query.customer;
  }

  const search =
    text(
      query.search ||
        query.q
    );

  if (search) {
    const escaped =
      search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    const pattern =
      new RegExp(
        escaped,
        "i"
      );

    const customerIds =
      await Customer.find({
        $or: [
          {
            firstName:
              pattern,
          },
          {
            lastName:
              pattern,
          },
          {
            preferredName:
              pattern,
          },
          {
            email:
              pattern,
          },
          {
            phone:
              pattern,
          },
        ],
      }).distinct(
        "_id"
      );

    match.customer = {
      $in:
        customerIds,
    };
  }

  const sort =
    query.sort ===
    "oldest"
      ? {
          updatedAt:
            1,
        }
      : query.sort ===
          "newest"
        ? {
            updatedAt:
              -1,
          }
        : {
            score:
              -1,

            updatedAt:
              -1,
          };

  const [
    items,
    total,
  ] = await Promise.all([
    AiPrediction.find(
      match
    )
      .populate(
        "customer",
        "firstName lastName preferredName email phone status totalSpent loyaltyTier membershipStatus lastVisit nextAppointment"
      )
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),

    AiPrediction
      .countDocuments(
        match
      ),
  ]);

  return {
    items:
      items.map(
        (
          item
        ) => ({
          ...item,

          fresh:
            Boolean(
              validDate(
                item.expiresAt
              ) >
                new Date()
            ),

          riskFactors:
            item.features
              ?.riskFactors ||
            [],

          recommendedActions:
            item.features
              ?.recommendedActions ||
            [],
        })
      ),

    pagination: {
      page,
      limit,
      total,

      pages:
        Math.ceil(
          total /
            limit
        ),

      hasNextPage:
        page * limit <
        total,

      hasPreviousPage:
        page > 1,
    },
  };
}

export async function getRetentionSummary() {
  const now =
    new Date();

  const [
    grouped,
    totalCustomers,
    stale,
    topRisk,
  ] = await Promise.all([
    AiPrediction.aggregate([
      {
        $match: {
          predictionType:
            "churn_risk",

          expiresAt: {
            $gt:
              now,
          },
        },
      },
      {
        $group: {
          _id:
            "$label",

          count: {
            $sum: 1,
          },

          averageScore: {
            $avg:
              "$score",
          },
        },
      },
    ]),

    Customer.countDocuments({
      status:
        "active",
    }),

    AiPrediction.countDocuments({
      predictionType:
        "churn_risk",

      expiresAt: {
        $lte:
          now,
      },
    }),

    AiPrediction.find({
      predictionType:
        "churn_risk",

      expiresAt: {
        $gt:
          now,
      },
    })
      .populate(
        "customer",
        "firstName lastName preferredName email phone status totalSpent lastVisit nextAppointment"
      )
      .sort({
        score:
          -1,
      })
      .limit(10)
      .lean(),
  ]);

  const byRisk = {
    low: {
      count: 0,
      averageScore: 0,
    },

    medium: {
      count: 0,
      averageScore: 0,
    },

    high: {
      count: 0,
      averageScore: 0,
    },
  };

  grouped.forEach(
    (
      row
    ) => {
      if (
        byRisk[
          row._id
        ]
      ) {
        byRisk[
          row._id
        ] = {
          count:
            row.count,

          averageScore:
            round(
              row.averageScore
            ),
        };
      }
    }
  );

  const predictedCustomers =
    Object.values(
      byRisk
    ).reduce(
      (
        sum,
        group
      ) =>
        sum +
        group.count,
      0
    );

  return {
    totalCustomers,
    predictedCustomers,

    coverageRate:
      totalCustomers > 0
        ? round(
            predictedCustomers /
              totalCustomers
          )
        : 0,

    stalePredictions:
      stale,

    byRisk,

    topRisk:
      topRisk.map(
        (
          prediction
        ) => ({
          ...prediction,

          riskFactors:
            prediction.features
              ?.riskFactors ||
            [],

          recommendedActions:
            prediction.features
              ?.recommendedActions ||
            [],
        })
      ),

    generatedAt:
      now,
  };
}

export async function generateCampaignCopy({
  campaignType = "general",
  channel = "email",
  tone = "friendly",
  offer = "",
  objective = "",
}) {
  const fallbackSubject =
    channel === "email"
      ? "A message from {{salon.name}}"
      : "";

  const fallbackMessage =
    campaignType ===
    "dormant_customer"
      ? "Hi {{customer.firstName}}, we would love to welcome you back to {{salon.name}}. Reply to arrange your next appointment."
      : campaignType ===
          "appointment_reminder"
        ? "Hi {{customer.firstName}}, this is a reminder about your appointment on {{appointment.date}} at {{appointment.time}}."
        : `Hi {{customer.firstName}}, ${
            offer ||
            objective ||
            "we have an update for you from {{salon.name}}."
          }`;

  const result =
    await generateText({
      system:
        "You write concise, accurate salon customer communications. Preserve template variables inside double braces.",

      prompt:
        JSON.stringify({
          campaignType,
          channel,
          tone,
          offer,
          objective,
        }),

      fallback:
        JSON.stringify({
          subject:
            fallbackSubject,

          message:
            fallbackMessage,
        }),
    });

  try {
    return {
      provider:
        result.provider,

      ...JSON.parse(
        result.text
      ),
    };
  } catch {
    return {
      provider:
        result.provider,

      subject:
        fallbackSubject,

      message:
        result.text ||
        fallbackMessage,
    };
  }
}

export async function generateRevenueForecast({
  historyDays = 90,
  horizonDays = 30,
} = {}) {
  const safeHistoryDays =
    Math.min(
      Math.max(
        7,
        Number(
          historyDays
        ) || 90
      ),
      730
    );

  const safeHorizonDays =
    Math.min(
      Math.max(
        1,
        Number(
          horizonDays
        ) || 30
      ),
      365
    );

  const startDate =
    addDays(
      new Date(),
      -safeHistoryDays
    );

  const history =
    await Appointment.aggregate([
      {
        $match: {
          appointmentDate: {
            $gte:
              startDate,
          },

          status: {
            $in: [
              "confirmed",
              "completed",
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format:
                "%Y-%m-%d",

              date:
                "$appointmentDate",
            },
          },

          revenue: {
            $sum: {
              $ifNull: [
                "$totalPrice",
                {
                  $ifNull: [
                    "$price",
                    0,
                  ],
                },
              ],
            },
          },

          appointments: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]);

  const averageRevenue =
    history.reduce(
      (
        sum,
        row
      ) =>
        sum +
        Number(
          row.revenue ||
            0
        ),
      0
    ) /
    safeHistoryDays;

  const averageAppointments =
    history.reduce(
      (
        sum,
        row
      ) =>
        sum +
        Number(
          row.appointments ||
            0
        ),
      0
    ) /
    safeHistoryDays;

  const points =
    Array.from(
      {
        length:
          safeHorizonDays,
      },
      (
        _,
        index
      ) => {
        const date =
          addDays(
            new Date(),
            index + 1
          );

        const dayFactor =
          [
            0,
            6,
          ].includes(
            date.getDay()
          )
            ? 0.85
            : 1.05;

        const predictedRevenue =
          averageRevenue *
          dayFactor;

        return {
          date,

          predictedRevenue:
            round(
              predictedRevenue,
              2
            ),

          predictedAppointments:
            round(
              averageAppointments *
                dayFactor,
              1
            ),

          lowerBound:
            round(
              predictedRevenue *
                0.8,
              2
            ),

          upperBound:
            round(
              predictedRevenue *
                1.2,
              2
            ),
        };
      }
    );

  const snapshot =
    await ForecastSnapshot.create({
      period:
        "daily",

      horizonDays:
        points.length,

      modelName:
        "moving-average-baseline",

      points,

      metadata: {
        historyDays:
          safeHistoryDays,

        averageRevenue,
        averageAppointments,
        history,
      },
    });

  return snapshot.toObject();
}

export async function latestForecast() {
  return ForecastSnapshot.findOne()
    .sort({
      generatedAt:
        -1,
    })
    .lean();
}

export default {
  generateCampaignCopy,
  generateRevenueForecast,
  getRetentionSummary,
  getStoredRetentionPrediction,
  latestForecast,
  listRetentionPredictions,
  predictRetention,
  predictRetentionBatch,
};