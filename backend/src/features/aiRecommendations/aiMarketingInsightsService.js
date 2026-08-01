import Appointment from "../../models/Appointment.js";
import User from "../../models/User.js";

import {
  analyseMarketingInsights,
} from "../../services/aiMicroserviceClient.js";


const DEFAULT_LOOKBACK_DAYS =
  180;

const DEFAULT_RECENT_WINDOW_DAYS =
  30;

const DEFAULT_MINIMUM_HISTORY_DAYS =
  90;


const SUPPORTED_CHANNELS =
  new Set([
    "email",
    "sms",
    "whatsapp",
    "push",
    "social",
    "referral",
    "organic",
    "paid_search",
    "paid_social",
    "other",
  ]);


const COMPLETED_APPOINTMENT_STATUSES =
  new Set([
    "completed",
    "complete",
    "fulfilled",
  ]);


const CANCELLED_APPOINTMENT_STATUSES =
  new Set([
    "cancelled",
    "canceled",
    "declined",
  ]);


const NO_SHOW_APPOINTMENT_STATUSES =
  new Set([
    "no-show",
    "no_show",
    "noshow",
  ]);


function asNumber(
  value,
  fallback = 0
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}


function asNonNegativeNumber(
  value,
  fallback = 0
) {
  return Math.max(
    0,
    asNumber(
      value,
      fallback
    )
  );
}


function asNonNegativeInteger(
  value,
  fallback = 0
) {
  return Math.max(
    0,
    Math.round(
      asNonNegativeNumber(
        value,
        fallback
      )
    )
  );
}


function asBoolean(
  value,
  fallback = false
) {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  if (
    typeof value ===
    "string"
  ) {
    const normalised =
      value
        .trim()
        .toLowerCase();

    if (
      normalised ===
      "true"
    ) {
      return true;
    }

    if (
      normalised ===
      "false"
    ) {
      return false;
    }
  }

  return fallback;
}


function startOfUtcDay(
  value
) {
  const date =
    value
      ? new Date(value)
      : new Date();

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "Invalid date value."
    );
  }

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );
}


function endOfUtcDay(
  value
) {
  const date =
    startOfUtcDay(
      value
    );

  date.setUTCHours(
    23,
    59,
    59,
    999
  );

  return date;
}


function addUtcDays(
  value,
  amount
) {
  const date =
    startOfUtcDay(
      value
    );

  date.setUTCDate(
    date.getUTCDate() +
      amount
  );

  return date;
}


function toDateKey(
  value
) {
  return startOfUtcDay(
    value
  )
    .toISOString()
    .slice(
      0,
      10
    );
}


function normaliseText(
  value
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}


function entityId(
  value
) {
  if (!value) {
    return null;
  }

  if (
    typeof value ===
    "string"
  ) {
    return value;
  }

  if (
    typeof value ===
    "object"
  ) {
    return String(
      value._id ||
        value.id ||
        value
    );
  }

  return String(value);
}


function extractAppointmentDate(
  appointment
) {
  return (
    appointment
      ?.appointmentDate ||
    appointment?.date ||
    appointment?.scheduledAt ||
    appointment?.startTime ||
    appointment?.createdAt ||
    null
  );
}


function extractAppointmentStatus(
  appointment
) {
  return normaliseText(
    appointment?.status ||
      appointment
        ?.appointmentStatus
  );
}


function extractAppointmentValue(
  appointment
) {
  const directCandidates = [
    appointment?.totalPrice,
    appointment?.total,
    appointment?.amount,
    appointment?.price,
    appointment
      ?.paymentAmount,
  ];

  for (
    const candidate of
    directCandidates
  ) {
    const parsed =
      asNumber(
        candidate,
        Number.NaN
      );

    if (
      Number.isFinite(
        parsed
      ) &&
      parsed >= 0
    ) {
      return parsed;
    }
  }

  if (
    Array.isArray(
      appointment?.services
    )
  ) {
    return appointment
      .services
      .reduce(
        (
          total,
          service
        ) =>
          total +
          asNonNegativeNumber(
            service?.price ||
              service
                ?.service
                ?.price
          ),
        0
      );
  }

  return asNonNegativeNumber(
    appointment
      ?.service
      ?.price
  );
}


function extractCustomerId(
  appointment
) {
  return entityId(
    appointment?.customer ||
      appointment?.user ||
      appointment?.client
  );
}


function normaliseChannel(
  value
) {
  const channel =
    normaliseText(
      value
    )
      .replace(
        /\s+/g,
        "_"
      )
      .replace(
        /-/g,
        "_"
      );

  if (
    SUPPORTED_CHANNELS.has(
      channel
    )
  ) {
    return channel;
  }

  if (
    [
      "google",
      "google_ads",
      "search",
      "ppc",
    ].includes(
      channel
    )
  ) {
    return "paid_search";
  }

  if (
    [
      "facebook",
      "instagram",
      "tiktok",
      "meta",
      "social_media",
    ].includes(
      channel
    )
  ) {
    return "social";
  }

  if (
    [
      "friend",
      "word_of_mouth",
      "wordofmouth",
    ].includes(
      channel
    )
  ) {
    return "referral";
  }

  return "organic";
}


function extractMarketingChannel(
  appointment
) {
  return normaliseChannel(
    appointment
      ?.marketingChannel ||
      appointment
        ?.acquisitionChannel ||
      appointment
        ?.bookingSource ||
      appointment?.source ||
      appointment
        ?.utmSource ||
      appointment
        ?.metadata
        ?.marketingChannel
  );
}


function emptyObservation(
  businessDate
) {
  return {
    business_date:
      businessDate,

    active_customers: 0,
    new_customers: 0,
    returning_customers: 0,

    enquiries: 0,
    bookings: 0,
    completed_appointments: 0,
    cancelled_appointments: 0,
    no_show_appointments: 0,

    messages_sent: 0,
    messages_delivered: 0,
    messages_opened: 0,
    messages_clicked: 0,

    unsubscribes: 0,
    failed_deliveries: 0,

    marketing_cost: 0,
    attributed_revenue: 0,
    total_revenue: 0,
    discounts_redeemed: 0,
    refunds: 0,

    channels: [],
    campaigns: [],
  };
}


function emptyChannel(
  channel
) {
  return {
    channel,

    audience_size: 0,

    messages_sent: 0,
    messages_delivered: 0,
    messages_opened: 0,
    messages_clicked: 0,

    enquiries: 0,
    bookings: 0,
    completed_appointments: 0,

    new_customers: 0,
    returning_customers: 0,

    unsubscribes: 0,
    failed_deliveries: 0,

    marketing_cost: 0,
    attributed_revenue: 0,
    discounts_redeemed: 0,
    refunds: 0,
  };
}


function getOrCreateChannel(
  channelMap,
  channel
) {
  if (
    !channelMap.has(
      channel
    )
  ) {
    channelMap.set(
      channel,
      emptyChannel(
        channel
      )
    );
  }

  return channelMap.get(
    channel
  );
}


function buildDateRange(
  startDate,
  endDate
) {
  const values = [];

  let current =
    startOfUtcDay(
      startDate
    );

  const finalDate =
    startOfUtcDay(
      endDate
    );

  while (
    current <=
    finalDate
  ) {
    values.push(
      toDateKey(
        current
      )
    );

    current =
      addUtcDays(
        current,
        1
      );
  }

  return values;
}


function customerCreatedDate(
  customer
) {
  return (
    customer?.createdAt ||
    customer
      ?.registeredAt ||
    customer
      ?.joinedAt ||
    null
  );
}


function buildCustomerCreationIndex(
  customers
) {
  const index =
    new Map();

  for (
    const customer of
    customers
  ) {
    const id =
      entityId(
        customer
      );

    const createdAt =
      customerCreatedDate(
        customer
      );

    if (
      !id ||
      !createdAt
    ) {
      continue;
    }

    const parsed =
      new Date(
        createdAt
      );

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      continue;
    }

    index.set(
      id,
      parsed
    );
  }

  return index;
}


function classifyAppointment(
  appointment
) {
  const status =
    extractAppointmentStatus(
      appointment
    );

  return {
    completed:
      COMPLETED_APPOINTMENT_STATUSES.has(
        status
      ),

    cancelled:
      CANCELLED_APPOINTMENT_STATUSES.has(
        status
      ),

    noShow:
      NO_SHOW_APPOINTMENT_STATUSES.has(
        status
      ),
  };
}


function isAttributedMarketingBooking(
  appointment
) {
  const channel =
    extractMarketingChannel(
      appointment
    );

  if (
    channel !==
    "organic"
  ) {
    return true;
  }

  return Boolean(
    appointment
      ?.campaignId ||
      appointment
        ?.campaign ||
      appointment
        ?.utmCampaign ||
      appointment
        ?.promotionCode ||
      appointment
        ?.discountCode ||
      appointment
        ?.referralCode
  );
}


function applyAppointment(
  observation,
  channelMap,
  appointment,
  customerCreationIndex
) {
  const classification =
    classifyAppointment(
      appointment
    );

  const channel =
    extractMarketingChannel(
      appointment
    );

  const channelObservation =
    getOrCreateChannel(
      channelMap,
      channel
    );

  const customerId =
    extractCustomerId(
      appointment
    );

  const bookingDate =
    new Date(
      extractAppointmentDate(
        appointment
      )
    );

  const customerCreatedAt =
    customerId
      ? customerCreationIndex.get(
          customerId
        )
      : null;

  const isNewCustomer =
    customerCreatedAt
      ? toDateKey(
          customerCreatedAt
        ) ===
        toDateKey(
          bookingDate
        )
      : false;

  const appointmentValue =
    extractAppointmentValue(
      appointment
    );

  observation.bookings += 1;
  channelObservation.bookings += 1;

  if (
    classification.completed
  ) {
    observation
      .completed_appointments +=
      1;

    channelObservation
      .completed_appointments +=
      1;

    observation.total_revenue +=
      appointmentValue;

    if (
      isAttributedMarketingBooking(
        appointment
      )
    ) {
      observation
        .attributed_revenue +=
        appointmentValue;

      channelObservation
        .attributed_revenue +=
        appointmentValue;
    }
  }

  if (
    classification.cancelled
  ) {
    observation
      .cancelled_appointments +=
      1;
  }

  if (
    classification.noShow
  ) {
    observation
      .no_show_appointments +=
      1;
  }

  if (
    isNewCustomer
  ) {
    observation.new_customers +=
      1;

    channelObservation
      .new_customers +=
      1;
  } else {
    observation
      .returning_customers +=
      1;

    channelObservation
      .returning_customers +=
      1;
  }
}


function finaliseObservation(
  observation,
  channelMap
) {
  const channels =
    [
      ...channelMap.values(),
    ]
      .map(
        (channel) => ({
          ...channel,

          audience_size:
            Math.max(
              channel
                .new_customers +
                channel
                  .returning_customers,

              channel
                .bookings
            ),
        })
      )
      .sort(
        (
          left,
          right
        ) =>
          right
            .attributed_revenue -
          left
            .attributed_revenue
      );

  const activeCustomers =
    observation
      .new_customers +
    observation
      .returning_customers;

  return {
    ...observation,

    active_customers:
      Math.max(
        activeCustomers,
        observation.bookings
      ),

    channels,
  };
}


export function buildMarketingInsightsSettings(
  options = {}
) {
  const recentWindowDays =
    asNonNegativeInteger(
      options.recentWindowDays,
      DEFAULT_RECENT_WINDOW_DAYS
    );

  const baselineWindowDays =
    Math.max(
      28,

      asNonNegativeInteger(
        options.baselineWindowDays,
        DEFAULT_LOOKBACK_DAYS
      )
    );

  const minimumHistoryDays =
    Math.min(
      baselineWindowDays,

      Math.max(
        28,

        asNonNegativeInteger(
          options.minimumHistoryDays,
          DEFAULT_MINIMUM_HISTORY_DAYS
        )
      )
    );

  return {
    recent_window_days:
      Math.min(
        baselineWindowDays,
        Math.max(
          7,
          recentWindowDays
        )
      ),

    baseline_window_days:
      baselineWindowDays,

    minimum_history_days:
      minimumHistoryDays,

    minimum_campaign_messages:
      Math.max(
        1,

        asNonNegativeInteger(
          options
            .minimumCampaignMessages,
          20
        )
      ),

    minimum_channel_messages:
      Math.max(
        1,

        asNonNegativeInteger(
          options
            .minimumChannelMessages,
          30
        )
      ),

    strong_open_rate:
      asNonNegativeNumber(
        options.strongOpenRate,
        0.35
      ),

    strong_click_rate:
      asNonNegativeNumber(
        options.strongClickRate,
        0.08
      ),

    strong_conversion_rate:
      asNonNegativeNumber(
        options
          .strongConversionRate,
        0.05
      ),

    high_unsubscribe_rate:
      asNonNegativeNumber(
        options
          .highUnsubscribeRate,
        0.02
      ),

    high_failure_rate:
      asNonNegativeNumber(
        options.highFailureRate,
        0.08
      ),

    include_campaign_insights:
      asBoolean(
        options
          .includeCampaignInsights,
        true
      ),

    include_channel_insights:
      asBoolean(
        options
          .includeChannelInsights,
        true
      ),

    include_recommendations:
      asBoolean(
        options
          .includeRecommendations,
        true
      ),

    currency:
      "GBP",

    timezone:
      "Europe/London",
  };
}


export async function buildMarketingObservations(
  {
    asOfDate =
      new Date(),

    lookbackDays =
      DEFAULT_LOOKBACK_DAYS,
  } = {}
) {
  const finalDate =
    endOfUtcDay(
      asOfDate
    );

  const safeLookbackDays =
    Math.max(
      28,

      asNonNegativeInteger(
        lookbackDays,
        DEFAULT_LOOKBACK_DAYS
      )
    );

  const startDate =
    addUtcDays(
      finalDate,
      -(
        safeLookbackDays -
        1
      )
    );

  const [
    appointments,
    customers,
  ] =
    await Promise.all([
      Appointment.find({
        $or: [
          {
            appointmentDate: {
              $gte:
                startDate,

              $lte:
                finalDate,
            },
          },

          {
            date: {
              $gte:
                startDate,

              $lte:
                finalDate,
            },
          },

          {
            scheduledAt: {
              $gte:
                startDate,

              $lte:
                finalDate,
            },
          },

          {
            createdAt: {
              $gte:
                startDate,

              $lte:
                finalDate,
            },
          },
        ],
      })
        .lean()
        .exec(),

      User.find({
        createdAt: {
          $lte:
            finalDate,
        },
      })
        .select(
          "_id createdAt registeredAt joinedAt"
        )
        .lean()
        .exec(),
    ]);

  const customerCreationIndex =
    buildCustomerCreationIndex(
      customers
    );

  const observationsByDate =
    new Map();

  const channelMapsByDate =
    new Map();

  for (
    const dateKey of
    buildDateRange(
      startDate,
      finalDate
    )
  ) {
    observationsByDate.set(
      dateKey,
      emptyObservation(
        dateKey
      )
    );

    channelMapsByDate.set(
      dateKey,
      new Map()
    );
  }

  for (
    const appointment of
    appointments
  ) {
    const appointmentDate =
      extractAppointmentDate(
        appointment
      );

    if (
      !appointmentDate
    ) {
      continue;
    }

    let dateKey;

    try {
      dateKey =
        toDateKey(
          appointmentDate
        );
    } catch {
      continue;
    }

    const observation =
      observationsByDate.get(
        dateKey
      );

    const channelMap =
      channelMapsByDate.get(
        dateKey
      );

    if (
      !observation ||
      !channelMap
    ) {
      continue;
    }

    applyAppointment(
      observation,
      channelMap,
      appointment,
      customerCreationIndex
    );
  }

  return [
    ...observationsByDate
      .entries(),
  ]
    .sort(
      (
        [left],
        [right]
      ) =>
        left.localeCompare(
          right
        )
    )
    .map(
      (
        [
          dateKey,
          observation,
        ]
      ) =>
        finaliseObservation(
          observation,
          channelMapsByDate.get(
            dateKey
          )
        )
    );
}


export async function buildMarketingInsightsPayload(
  options = {}
) {
  const settings =
    buildMarketingInsightsSettings(
      options
    );

  const lookbackDays =
    Math.max(
      settings
        .baseline_window_days,

      asNonNegativeInteger(
        options.lookbackDays,
        settings
          .baseline_window_days
      )
    );

  const asOfDate =
    startOfUtcDay(
      options.asOfDate ||
        new Date()
    );

  const observations =
    await buildMarketingObservations({
      asOfDate,
      lookbackDays,
    });

  return {
    as_of_date:
      toDateKey(
        asOfDate
      ),

    observations,

    settings,
  };
}


export async function generateMarketingInsights(
  options = {}
) {
  const payload =
    await buildMarketingInsightsPayload(
      options
    );

  const insights =
    await analyseMarketingInsights(
      payload,
      {
        requestId:
          options.requestId,
      }
    );

  return {
    insights,

    source: {
      historyDays:
        payload
          .observations
          .length,

      appointmentRecords:
        payload
          .observations
          .reduce(
            (
              total,
              observation
            ) =>
              total +
              observation
                .bookings,
            0
          ),

      activeCustomerRecords:
        payload
          .observations
          .reduce(
            (
              total,
              observation
            ) =>
              total +
              observation
                .active_customers,
            0
          ),

      asOfDate:
        payload.as_of_date,

      lookbackDays:
        payload
          .observations
          .length,

      aggregateOnly:
        true,
    },

    parameters: {
      recentWindowDays:
        payload
          .settings
          .recent_window_days,

      baselineWindowDays:
        payload
          .settings
          .baseline_window_days,

      minimumHistoryDays:
        payload
          .settings
          .minimum_history_days,

      includeCampaignInsights:
        payload
          .settings
          .include_campaign_insights,

      includeChannelInsights:
        payload
          .settings
          .include_channel_insights,

      includeRecommendations:
        payload
          .settings
          .include_recommendations,
    },
  };
}


export default {
  buildMarketingInsightsPayload,
  buildMarketingInsightsSettings,
  buildMarketingObservations,
  generateMarketingInsights,
};