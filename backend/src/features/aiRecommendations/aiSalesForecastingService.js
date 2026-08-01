import Appointment from "../../models/Appointment.js";
import Order from "../commerce/Order.js";
import Payment from "../commerce/Payment.js";
import { forecastSales } from "../../services/aiMicroserviceClient.js";

const TIMEZONE = "Europe/London";
const CURRENCY = "GBP";
const DAY_MS = 86_400_000;

const ORDER_STATUSES = [
  "paid",
  "processing",
  "ready",
  "completed",
  "refunded",
];

const PAYMENT_STATUSES = [
  "paid",
  "refunded",
  "partially_refunded",
];

const DIRECT_PAYMENT_PURPOSES = new Set([
  "membership",
  "other",
]);

const CHANNEL_FIELD = {
  services: "service_sales",
  retail: "retail_sales",
  memberships: "membership_sales",
  gift_cards: "gift_card_sales",
  other: "other_sales",
};

export const DEFAULT_AI_SALES_FORECAST_OPTIONS =
  Object.freeze({
    lookbackDays: 365,
    horizonDays: 90,
    minimumHistoryDays: 90,
    recentWindowDays: 30,
    baselineWindowDays: 180,
    confidenceLevel: 0.9,
    weekdaySeasonalityWeight: 0.55,
    recentTrendWeight: 0.45,
    scenarioAdjustment: 0,
    businessDays: [
      0,
      1,
      2,
      3,
      4,
      5,
    ],
    includeProfitForecast: true,
    includeCategoryForecast: true,
  });

export class AiSalesForecastingError extends Error {
  constructor(
    message,
    {
      code = "AI_SALES_FORECASTING_ERROR",
      status = 400,
      details = null,
      cause = null,
    } = {}
  ) {
    super(message, {
      cause,
    });

    this.name =
      "AiSalesForecastingError";

    this.code = code;
    this.status = status;
    this.statusCode = status;
    this.details = details;
  }
}

function number(
  value,
  fallback = 0
) {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function positive(
  value,
  fallback = 0
) {
  return Math.max(
    0,
    number(
      value,
      fallback
    )
  );
}

function money(value) {
  return (
    Math.round(
      positive(value) * 100
    ) / 100
  );
}

function quantity(value) {
  return (
    Math.round(
      positive(value) * 100
    ) / 100
  );
}

function clamp(
  value,
  minimum,
  maximum,
  fallback
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      parsed
    )
  );
}

function clampInteger(
  value,
  minimum,
  maximum,
  fallback
) {
  return Math.round(
    clamp(
      value,
      minimum,
      maximum,
      fallback
    )
  );
}

function optionalBoolean(
  value,
  fallback
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  const normalised =
    String(value)
      .trim()
      .toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "on",
    ].includes(
      normalised
    )
  ) {
    return true;
  }

  if (
    [
      "false",
      "0",
      "no",
      "off",
    ].includes(
      normalised
    )
  ) {
    return false;
  }

  return fallback;
}

function validDate(value) {
  if (!value) {
    return null;
  }

  const parsed =
    new Date(value);

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}

function dateParts(
  value,
  timeZone = TIMEZONE
) {
  const date =
    validDate(value);

  if (!date) {
    return null;
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }
    ).formatToParts(
      date
    );

  return Object.fromEntries(
    parts.map(
      (part) => [
        part.type,
        part.value,
      ]
    )
  );
}

function dateKey(value) {
  const parts =
    dateParts(value);

  if (!parts) {
    return "";
  }

  return [
    parts.year,
    parts.month,
    parts.day,
  ].join("-");
}

function parseDateKey(
  value,
  fieldName = "asOfDate"
) {
  const text =
    String(
      value || ""
    ).trim();

  const match =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!match) {
    throw new AiSalesForecastingError(
      `${fieldName} must use YYYY-MM-DD format.`,
      {
        code:
          "INVALID_SALES_FORECAST_DATE",

        status: 400,

        details: {
          field: fieldName,
        },
      }
    );
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const probe =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        12
      )
    );

  if (
    probe.getUTCFullYear() !==
      year ||
    probe.getUTCMonth() !==
      month - 1 ||
    probe.getUTCDate() !==
      day
  ) {
    throw new AiSalesForecastingError(
      `${fieldName} must be a valid calendar date.`,
      {
        code:
          "INVALID_SALES_FORECAST_DATE",

        status: 400,

        details: {
          field: fieldName,
        },
      }
    );
  }

  return text;
}

function shiftDateKey(
  value,
  days
) {
  const [
    year,
    month,
    day,
  ] = parseDateKey(
    value,
    "date"
  )
    .split("-")
    .map(Number);

  const shifted =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + Number(days),
        12
      )
    );

  return [
    shifted.getUTCFullYear(),

    String(
      shifted.getUTCMonth() +
        1
    ).padStart(2, "0"),

    String(
      shifted.getUTCDate()
    ).padStart(2, "0"),
  ].join("-");
}

function zonedDateTimeToUtc(
  dateKeyValue,
  {
    hour = 0,
    minute = 0,
    second = 0,
  } = {}
) {
  const [
    year,
    month,
    day,
  ] = parseDateKey(
    dateKeyValue,
    "date"
  )
    .split("-")
    .map(Number);

  const desired =
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second
    );

  let candidate =
    new Date(
      desired
    );

  for (
    let attempt = 0;
    attempt < 3;
    attempt += 1
  ) {
    const parts =
      dateParts(
        candidate
      );

    if (!parts) {
      break;
    }

    const represented =
      Date.UTC(
        Number(
          parts.year
        ),

        Number(
          parts.month
        ) - 1,

        Number(
          parts.day
        ),

        Number(
          parts.hour
        ),

        Number(
          parts.minute
        ),

        Number(
          parts.second
        )
      );

    const difference =
      desired -
      represented;

    if (
      difference === 0
    ) {
      break;
    }

    candidate =
      new Date(
        candidate.getTime() +
          difference
      );
  }

  return candidate;
}

function londonDayBounds(
  value
) {
  return {
    start:
      zonedDateTimeToUtc(
        value
      ),

    end:
      zonedDateTimeToUtc(
        shiftDateKey(
          value,
          1
        )
      ),
  };
}

function currentLondonDateKey(
  now = new Date()
) {
  return dateKey(now);
}

function appointmentBusinessDate(
  appointment
) {
  const direct =
    validDate(
      appointment?.completedAt
    ) ||
    validDate(
      appointment?.startsAt
    );

  if (direct) {
    return dateKey(
      direct
    );
  }

  const appointmentDate =
    validDate(
      appointment
        ?.appointmentDate
    );

  if (!appointmentDate) {
    return "";
  }

  return dateKey(
    appointmentDate
  );
}

function orderBusinessDate(
  order
) {
  return dateKey(
    order?.updatedAt ||
      order?.createdAt
  );
}

function paymentBusinessDate(
  payment
) {
  return dateKey(
    payment?.paidAt ||
      payment?.updatedAt ||
      payment?.createdAt
  );
}

function entityId(value) {
  return String(
    value?._id ||
      value?.id ||
      value ||
      ""
  ).trim();
}

function slug(
  value,
  fallback = "uncategorised"
) {
  const result =
    String(
      value || ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )
      .slice(
        0,
        100
      );

  return (
    result ||
    fallback
  );
}

function label(
  value,
  fallback =
    "Uncategorised"
) {
  return (
    String(
      value || ""
    ).trim() ||
    fallback
  ).slice(
    0,
    160
  );
}

function emptyObservation(
  businessDate
) {
  return {
    business_date:
      businessDate,

    gross_sales: 0,
    discounts: 0,
    refunds: 0,
    net_sales: 0,
    collected_sales: 0,
    cost_of_goods: 0,
    transactions: 0,

    completed_appointments:
      0,

    paid_orders: 0,
    units_sold: 0,

    service_sales: 0,
    retail_sales: 0,
    membership_sales: 0,
    gift_card_sales: 0,
    other_sales: 0,

    channels: [],
    categories: [],
  };
}

function emptyChannel(
  channel
) {
  return {
    channel,
    gross_sales: 0,
    discounts: 0,
    refunds: 0,
    net_sales: 0,
    cost_of_goods: 0,
    transactions: 0,
    units_sold: 0,
  };
}

function emptyCategory(
  categoryKey,
  categoryName,
  channel
) {
  return {
    category_key:
      categoryKey,

    category_name:
      categoryName,

    channel,

    gross_sales: 0,
    discounts: 0,
    refunds: 0,
    net_sales: 0,
    cost_of_goods: 0,
    transactions: 0,
    units_sold: 0,
  };
}

function addEntry(
  observation,
  channelMap,
  categoryMap,
  {
    channel,
    categoryKey,
    categoryName,
    grossSales = 0,
    discounts = 0,
    refunds = 0,
    netSales = 0,
    collectedSales = 0,
    costOfGoods = 0,
    transactions = 0,
    unitsSold = 0,

    completedAppointments =
      0,

    paidOrders = 0,
  }
) {
  const entry = {
    gross_sales:
      money(
        grossSales
      ),

    discounts:
      money(
        discounts
      ),

    refunds:
      money(
        refunds
      ),

    net_sales:
      money(
        netSales
      ),

    collected_sales:
      money(
        collectedSales
      ),

    cost_of_goods:
      money(
        costOfGoods
      ),

    transactions:
      quantity(
        transactions
      ),

    units_sold:
      quantity(
        unitsSold
      ),
  };

  observation
    .gross_sales +=
      entry.gross_sales;

  observation
    .discounts +=
      entry.discounts;

  observation
    .refunds +=
      entry.refunds;

  observation
    .net_sales +=
      entry.net_sales;

  observation
    .collected_sales +=
      entry.collected_sales;

  observation
    .cost_of_goods +=
      entry.cost_of_goods;

  observation
    .transactions +=
      entry.transactions;

  observation
    .units_sold +=
      entry.units_sold;

  observation
    .completed_appointments +=
      positive(
        completedAppointments
      );

  observation
    .paid_orders +=
      positive(
        paidOrders
      );

  observation[
    CHANNEL_FIELD[
      channel
    ]
  ] += entry.net_sales;

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

  const channelTarget =
    channelMap.get(
      channel
    );

  channelTarget
    .gross_sales +=
      entry.gross_sales;

  channelTarget
    .discounts +=
      entry.discounts;

  channelTarget
    .refunds +=
      entry.refunds;

  channelTarget
    .net_sales +=
      entry.net_sales;

  channelTarget
    .cost_of_goods +=
      entry.cost_of_goods;

  channelTarget
    .transactions +=
      entry.transactions;

  channelTarget
    .units_sold +=
      entry.units_sold;

  if (!categoryKey) {
    return;
  }

  if (
    !categoryMap.has(
      categoryKey
    )
  ) {
    categoryMap.set(
      categoryKey,
      emptyCategory(
        categoryKey,
        categoryName,
        channel
      )
    );
  }

  const categoryTarget =
    categoryMap.get(
      categoryKey
    );

  categoryTarget
    .gross_sales +=
      entry.gross_sales;

  categoryTarget
    .discounts +=
      entry.discounts;

  categoryTarget
    .refunds +=
      entry.refunds;

  categoryTarget
    .net_sales +=
      entry.net_sales;

  categoryTarget
    .cost_of_goods +=
      entry.cost_of_goods;

  categoryTarget
    .transactions +=
      entry.transactions;

  categoryTarget
    .units_sold +=
      entry.units_sold;
}

function paymentRefundAmount(
  payment
) {
  const status =
    String(
      payment?.status ||
        ""
    ).toLowerCase();

  const amount =
    positive(
      payment?.amount
    );

  if (
    status ===
    "refunded"
  ) {
    return amount;
  }

  if (
    status !==
    "partially_refunded"
  ) {
    return 0;
  }

  const metadata =
    payment?.metadata ||
    {};

  return Math.min(
    amount,

    positive(
      metadata
        .refundedAmount ??
        metadata
          .refundAmount ??
        metadata
          .refunded_amount
    )
  );
}

function paymentCollectedAmount(
  payment
) {
  const status =
    String(
      payment?.status ||
        ""
    ).toLowerCase();

  if (
    status ===
    "refunded"
  ) {
    return 0;
  }

  if (
    ![
      "paid",
      "partially_refunded",
    ].includes(
      status
    )
  ) {
    return 0;
  }

  return Math.max(
    0,

    positive(
      payment?.amount
    ) -
      paymentRefundAmount(
        payment
      )
  );
}

function paymentReferenceTotals(
  payments
) {
  const appointments =
    new Map();

  const orders =
    new Map();

  function add(
    map,
    key,
    payment
  ) {
    if (!key) {
      return;
    }

    const current =
      map.get(key) || {
        collected: 0,
        refunded: 0,
      };

    current.collected +=
      paymentCollectedAmount(
        payment
      );

    current.refunded +=
      paymentRefundAmount(
        payment
      );

    map.set(
      key,
      current
    );
  }

  for (
    const payment
    of payments
  ) {
    if (
      String(
        payment?.currency ||
          CURRENCY
      ).toUpperCase() !==
      CURRENCY
    ) {
      continue;
    }

    if (
      !PAYMENT_STATUSES.includes(
        String(
          payment?.status ||
            ""
        ).toLowerCase()
      )
    ) {
      continue;
    }

    add(
      appointments,
      entityId(
        payment?.appointment
      ),
      payment
    );

    add(
      orders,
      entityId(
        payment?.order
      ),
      payment
    );
  }

  return {
    appointments,
    orders,
  };
}

function directPaymentChannel(
  payment
) {
  if (
    payment?.purpose ===
    "membership"
  ) {
    return "memberships";
  }

  const metadata =
    payment?.metadata ||
    {};

  const candidate =
    String(
      metadata
        .saleChannel ||
        metadata
          .salesChannel ||
        metadata.channel ||
        ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        "_"
      );

  if (
    candidate ===
      "gift_card" ||
    candidate ===
      "gift_cards" ||
    metadata.giftCard ===
      true ||
    metadata.isGiftCard ===
      true
  ) {
    return "gift_cards";
  }

  if (
    [
      "memberships",
      "other",
    ].includes(
      candidate
    )
  ) {
    return candidate;
  }

  return "other";
}

function directPaymentCategory(
  payment,
  channel
) {
  const metadata =
    payment?.metadata ||
    {};

  const rawName =
    metadata
      .categoryName ||
    metadata.category ||
    metadata.planName ||
    metadata.productName ||
    (
      channel ===
      "memberships"
        ? "Memberships"
        : channel ===
            "gift_cards"
          ? "Gift cards"
          : "Other sales"
    );

  return {
    key:
      `${channel}:${slug(
        metadata
          .categoryKey ||
          rawName
      )}`,

    name:
      label(
        rawName
      ),
  };
}

function allocate(
  total,
  weights
) {
  const target =
    money(total);

  if (
    weights.length === 0
  ) {
    return [];
  }

  const cleaned =
    weights.map(
      (value) =>
        positive(value)
    );

  const weightTotal =
    cleaned.reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    );

  if (
    weightTotal <= 0
  ) {
    return cleaned.map(
      (
        _,
        index
      ) =>
        index === 0
          ? target
          : 0
    );
  }

  let used = 0;

  return cleaned.map(
    (
      weight,
      index
    ) => {
      if (
        index ===
        cleaned.length - 1
      ) {
        return money(
          target -
            used
        );
      }

      const share =
        money(
          target *
            (
              weight /
              weightTotal
            )
        );

      used += share;

      return share;
    }
  );
}

function normaliseBusinessDays(
  value
) {
  const source =
    Array.isArray(value)
      ? value
      : value ===
            undefined ||
          value === null ||
          value === ""
        ? DEFAULT_AI_SALES_FORECAST_OPTIONS
            .businessDays
        : String(
            value
          ).split(",");

  const days =
    Array.from(
      new Set(
        source
          .map(
            (item) =>
              Number.parseInt(
                String(
                  item
                ).trim(),
                10
              )
          )
          .filter(
            (item) =>
              Number.isInteger(
                item
              ) &&
              item >= 0 &&
              item <= 6
          )
      )
    ).sort(
      (
        left,
        right
      ) =>
        left -
        right
    );

  return days.length > 0
    ? days
    : [
        ...DEFAULT_AI_SALES_FORECAST_OPTIONS
          .businessDays,
      ];
}

function buildSettings(
  options = {}
) {
  const lookbackDays =
    clampInteger(
      options.lookbackDays,
      90,
      730,
      DEFAULT_AI_SALES_FORECAST_OPTIONS
        .lookbackDays
    );

  const baselineWindowDays =
    clampInteger(
      options
        .baselineWindowDays,
      28,
      lookbackDays,
      Math.min(
        DEFAULT_AI_SALES_FORECAST_OPTIONS
          .baselineWindowDays,
        lookbackDays
      )
    );

  const recentWindowDays =
    clampInteger(
      options
        .recentWindowDays,
      7,
      Math.min(
        180,
        baselineWindowDays
      ),
      Math.min(
        DEFAULT_AI_SALES_FORECAST_OPTIONS
          .recentWindowDays,
        baselineWindowDays
      )
    );

  const minimumHistoryDays =
    Math.max(
      recentWindowDays,

      clampInteger(
        options
          .minimumHistoryDays,
        28,
        lookbackDays,
        Math.min(
          DEFAULT_AI_SALES_FORECAST_OPTIONS
            .minimumHistoryDays,
          lookbackDays
        )
      )
    );

  let weekdayWeight =
    clamp(
      options
        .weekdaySeasonalityWeight,
      0,
      1,
      DEFAULT_AI_SALES_FORECAST_OPTIONS
        .weekdaySeasonalityWeight
    );

  let recentWeight =
    clamp(
      options
        .recentTrendWeight,
      0,
      1,
      DEFAULT_AI_SALES_FORECAST_OPTIONS
        .recentTrendWeight
    );

  const weightTotal =
    weekdayWeight +
    recentWeight;

  if (
    weightTotal <= 0
  ) {
    weekdayWeight =
      0.55;

    recentWeight =
      0.45;
  } else {
    weekdayWeight /=
      weightTotal;

    recentWeight /=
      weightTotal;
  }

  return {
    lookbackDays,

    settings: {
      horizon_days:
        clampInteger(
          options.horizonDays,
          7,
          365,
          DEFAULT_AI_SALES_FORECAST_OPTIONS
            .horizonDays
        ),

      minimum_history_days:
        minimumHistoryDays,

      recent_window_days:
        recentWindowDays,

      baseline_window_days:
        baselineWindowDays,

      confidence_level:
        clamp(
          options
            .confidenceLevel,
          0.5,
          0.99,
          DEFAULT_AI_SALES_FORECAST_OPTIONS
            .confidenceLevel
        ),

      weekday_seasonality_weight:
        Number(
          weekdayWeight.toFixed(
            6
          )
        ),

      recent_trend_weight:
        Number(
          recentWeight.toFixed(
            6
          )
        ),

      scenario_adjustment:
        clamp(
          options
            .scenarioAdjustment,
          -0.5,
          0.5,
          DEFAULT_AI_SALES_FORECAST_OPTIONS
            .scenarioAdjustment
        ),

      business_days:
        normaliseBusinessDays(
          options.businessDays
        ),

      include_profit_forecast:
        optionalBoolean(
          options
            .includeProfitForecast,

          DEFAULT_AI_SALES_FORECAST_OPTIONS
            .includeProfitForecast
        ),

      include_category_forecast:
        optionalBoolean(
          options
            .includeCategoryForecast,

          DEFAULT_AI_SALES_FORECAST_OPTIONS
            .includeCategoryForecast
        ),

      currency:
        CURRENCY,

      timezone:
        TIMEZONE,
    },
  };
}

function appointmentEntry(
  appointment,
  paymentTotals
) {
  if (
    String(
      appointment?.status ||
        ""
    ).toLowerCase() !==
    "completed"
  ) {
    return null;
  }

  const gross =
    money(
      positive(
        appointment
          ?.totalPrice
      ) +
        positive(
          appointment?.tax
        )
    );

  const discount =
    Math.min(
      gross,
      money(
        appointment
          ?.discount
      )
    );

  const expectedNet =
    Math.max(
      0,
      gross -
        discount
    );

  const reference =
    paymentTotals.get(
      entityId(
        appointment
      )
    ) || null;

  const refunded =
    Math.min(
      expectedNet,

      reference
        ? money(
            reference.refunded
          )
        : String(
              appointment
                ?.paymentStatus ||
                ""
            ).toLowerCase() ===
            "refunded"
          ? expectedNet
          : 0
    );

  const net =
    Math.max(
      0,
      expectedNet -
        refunded
    );

  const collected =
    Math.min(
      net,

      reference
        ? money(
            reference.collected
          )
        : money(
            appointment
              ?.amountPaid
          )
    );

  const service =
    appointment?.service ||
    {};

  const serviceId =
    entityId(
      service
    ) ||
    "unknown-service";

  const serviceName =
    label(
      service?.name ||
        service?.title,
      "Unknown service"
    );

  const serviceCategory =
    label(
      service?.category,
      "Hair services"
    );

  return {
    channel:
      "services",

    categoryKey:
      `services:${slug(
        service?.category ||
          serviceId
      )}`,

    categoryName:
      serviceCategory,

    grossSales:
      gross,

    discounts:
      discount,

    refunds:
      refunded,

    netSales:
      net,

    collectedSales:
      collected,

    costOfGoods:
      0,

    transactions:
      1,

    unitsSold:
      0,

    completedAppointments:
      1,

    paidOrders:
      0,

    serviceName,
  };
}

function orderEntries(
  order,
  paymentTotals
) {
  const status =
    String(
      order?.status ||
        ""
    ).toLowerCase();

  if (
    !ORDER_STATUSES.includes(
      status
    )
  ) {
    return [];
  }

  const items =
    Array.isArray(
      order?.items
    )
      ? order.items
      : [];

  if (
    items.length === 0
  ) {
    return [];
  }

  const subtotal =
    money(
      order?.subtotal
    );

  const discountTotal =
    Math.min(
      subtotal,
      money(
        order
          ?.discountTotal
      )
    );

  const expectedNet =
    money(
      order?.total ??
        Math.max(
          0,
          subtotal -
            discountTotal
        )
    );

  const reference =
    paymentTotals.get(
      entityId(order)
    ) || null;

  const refundTotal =
    Math.min(
      expectedNet,

      status ===
      "refunded"
        ? expectedNet
        : reference
          ? money(
              reference
                .refunded
            )
          : 0
    );

  const netTotal =
    Math.max(
      0,
      expectedNet -
        refundTotal
    );

  const collectedTotal =
    Math.min(
      netTotal,

      reference
        ? money(
            reference
              .collected
          )
        : [
            "paid",
            "processing",
            "ready",
            "completed",
          ].includes(
            status
          )
          ? netTotal
          : 0
    );

  const weights =
    items.map(
      (item) =>
        positive(
          item?.lineTotal
        )
    );

  const grossAllocations =
    allocate(
      subtotal,
      weights
    );

  const discountAllocations =
    allocate(
      discountTotal,
      weights
    );

  const refundAllocations =
    allocate(
      refundTotal,
      weights
    );

  const netAllocations =
    allocate(
      netTotal,
      weights
    );

  const collectedAllocations =
    allocate(
      collectedTotal,
      weights
    );

  return items.map(
    (
      item,
      index
    ) => {
      const product =
        item?.product ||
        {};

      const itemQuantity =
        Math.max(
          1,
          positive(
            item?.quantity,
            1
          )
        );

      const categoryName =
        label(
          product?.category,
          "Retail products"
        );

      const productId =
        entityId(
          product
        ) ||
        slug(
          item?.name,
          "unknown-product"
        );

      const costOfGoods =
        money(
          positive(
            product
              ?.costPrice
          ) *
            itemQuantity
        );

      return {
        channel:
          "retail",

        categoryKey:
          `retail:${slug(
            product?.category ||
              productId
          )}`,

        categoryName,

        grossSales:
          grossAllocations[
            index
          ] || 0,

        discounts:
          discountAllocations[
            index
          ] || 0,

        refunds:
          refundAllocations[
            index
          ] || 0,

        netSales:
          netAllocations[
            index
          ] || 0,

        collectedSales:
          collectedAllocations[
            index
          ] || 0,

        costOfGoods,

        transactions:
          index === 0
            ? 1
            : 0,

        unitsSold:
          itemQuantity,

        completedAppointments:
          0,

        paidOrders:
          index === 0
            ? 1
            : 0,
      };
    }
  );
}

function directPaymentEntry(
  payment
) {
  /*
   * Appointment and order payments are already reconciled against their
   * corresponding appointment or order records. They must never be added
   * again as independent sales, regardless of their recorded purpose.
   */
  if (
    entityId(
      payment?.appointment
    ) ||
    entityId(
      payment?.order
    )
  ) {
    return null;
  }

  if (
    !DIRECT_PAYMENT_PURPOSES.has(
      String(
        payment?.purpose ||
          ""
      )
    )
  ) {
    return null;
  }

  if (
    String(
      payment?.currency ||
        CURRENCY
    ).toUpperCase() !==
    CURRENCY
  ) {
    return null;
  }

  const status =
    String(
      payment?.status ||
        ""
    ).toLowerCase();

  if (
    !PAYMENT_STATUSES.includes(
      status
    )
  ) {
    return null;
  }

  const gross =
    money(
      payment?.amount
    );

  const refunds =
    paymentRefundAmount(
      payment
    );

  const net =
    Math.max(
      0,
      gross -
        refunds
    );

  const collected =
    paymentCollectedAmount(
      payment
    );

  const channel =
    directPaymentChannel(
      payment
    );

  const category =
    directPaymentCategory(
      payment,
      channel
    );

  return {
    channel,

    categoryKey:
      category.key,

    categoryName:
      category.name,

    grossSales:
      gross,

    discounts:
      0,

    refunds,

    netSales:
      net,

    collectedSales:
      collected,

    costOfGoods:
      0,

    transactions:
      1,

    unitsSold:
      1,

    completedAppointments:
      0,

    paidOrders:
      0,
  };
}

function finaliseObservation(
  observation,
  channelMap,
  categoryMap
) {
  function roundRecord(
    record
  ) {
    return {
      ...record,

      gross_sales:
        money(
          record
            .gross_sales
        ),

      discounts:
        money(
          record
            .discounts
        ),

      refunds:
        money(
          record
            .refunds
        ),

      net_sales:
        money(
          record
            .net_sales
        ),

      cost_of_goods:
        money(
          record
            .cost_of_goods
        ),

      transactions:
        quantity(
          record
            .transactions
        ),

      units_sold:
        quantity(
          record
            .units_sold
        ),
    };
  }

  observation.channels =
    Array.from(
      channelMap.values()
    )
      .map(
        roundRecord
      )
      .filter(
        (item) =>
          item.gross_sales >
            0 ||
          item.net_sales >
            0 ||
          item.refunds >
            0 ||
          item.transactions >
            0
      );

  observation.categories =
    Array.from(
      categoryMap.values()
    )
      .map(
        roundRecord
      )
      .filter(
        (item) =>
          item.gross_sales >
            0 ||
          item.net_sales >
            0 ||
          item.refunds >
            0 ||
          item.transactions >
            0
      )
      .sort(
        (
          left,
          right
        ) =>
          right.net_sales -
          left.net_sales
      );

  observation.gross_sales =
    money(
      observation
        .channels
        .reduce(
          (
            sum,
            item
          ) =>
            sum +
            item.gross_sales,
          0
        )
    );

  observation.discounts =
    money(
      observation
        .channels
        .reduce(
          (
            sum,
            item
          ) =>
            sum +
            item.discounts,
          0
        )
    );

  observation.refunds =
    money(
      observation
        .channels
        .reduce(
          (
            sum,
            item
          ) =>
            sum +
            item.refunds,
          0
        )
    );

  observation.net_sales =
    money(
      observation
        .channels
        .reduce(
          (
            sum,
            item
          ) =>
            sum +
            item.net_sales,
          0
        )
    );

  observation.cost_of_goods =
    money(
      observation
        .channels
        .reduce(
          (
            sum,
            item
          ) =>
            sum +
            item.cost_of_goods,
          0
        )
    );

  observation.collected_sales =
    money(
      Math.min(
        observation
          .net_sales,

        observation
          .collected_sales
      )
    );

  observation.transactions =
    quantity(
      observation
        .transactions
    );

  observation.units_sold =
    quantity(
      observation
        .units_sold
    );

  observation.completed_appointments =
    Math.round(
      positive(
        observation
          .completed_appointments
      )
    );

  observation.paid_orders =
    Math.round(
      positive(
        observation
          .paid_orders
      )
    );

  for (
    const [
      channel,
      field,
    ] of Object.entries(
      CHANNEL_FIELD
    )
  ) {
    observation[field] =
      money(
        observation
          .channels
          .filter(
            (item) =>
              item.channel ===
              channel
          )
          .reduce(
            (
              sum,
              item
            ) =>
              sum +
              item.net_sales,
            0
          )
      );
  }

  return observation;
}

export function buildSalesForecastPayload({
  appointments = [],
  orders = [],
  payments = [],
  asOfDate,
  ...options
} = {}) {
  const asOfDateKey =
    asOfDate
      ? parseDateKey(
          asOfDate
        )
      : currentLondonDateKey();

  const {
    lookbackDays,
    settings,
  } = buildSettings(
    options
  );

  const firstDateKey =
    shiftDateKey(
      asOfDateKey,
      -(
        lookbackDays -
        1
      )
    );

  const observations =
    new Map();

  const channels =
    new Map();

  const categories =
    new Map();

  for (
    let index = 0;
    index < lookbackDays;
    index += 1
  ) {
    const businessDate =
      shiftDateKey(
        firstDateKey,
        index
      );

    observations.set(
      businessDate,
      emptyObservation(
        businessDate
      )
    );

    channels.set(
      businessDate,
      new Map()
    );

    categories.set(
      businessDate,
      new Map()
    );
  }

  const references =
    paymentReferenceTotals(
      payments
    );

  for (
    const appointment
    of appointments
  ) {
    const businessDate =
      appointmentBusinessDate(
        appointment
      );

    const observation =
      observations.get(
        businessDate
      );

    if (!observation) {
      continue;
    }

    const entry =
      appointmentEntry(
        appointment,
        references
          .appointments
      );

    if (!entry) {
      continue;
    }

    addEntry(
      observation,
      channels.get(
        businessDate
      ),
      categories.get(
        businessDate
      ),
      entry
    );
  }

  for (
    const order
    of orders
  ) {
    const businessDate =
      orderBusinessDate(
        order
      );

    const observation =
      observations.get(
        businessDate
      );

    if (!observation) {
      continue;
    }

    for (
      const entry
      of orderEntries(
        order,
        references.orders
      )
    ) {
      addEntry(
        observation,
        channels.get(
          businessDate
        ),
        categories.get(
          businessDate
        ),
        entry
      );
    }
  }

  for (
    const payment
    of payments
  ) {
    const businessDate =
      paymentBusinessDate(
        payment
      );

    const observation =
      observations.get(
        businessDate
      );

    if (!observation) {
      continue;
    }

    const entry =
      directPaymentEntry(
        payment
      );

    if (!entry) {
      continue;
    }

    addEntry(
      observation,
      channels.get(
        businessDate
      ),
      categories.get(
        businessDate
      ),
      entry
    );
  }

  return {
    as_of_date:
      asOfDateKey,

    observations:
      Array.from(
        observations.entries()
      ).map(
        ([
          businessDate,
          observation,
        ]) =>
          finaliseObservation(
            observation,
            channels.get(
              businessDate
            ),
            categories.get(
              businessDate
            )
          )
      ),

    settings,
  };
}

export async function loadSalesForecastSourceData({
  asOfDate,

  lookbackDays =
    DEFAULT_AI_SALES_FORECAST_OPTIONS
      .lookbackDays,
} = {}) {
  const asOfDateKey =
    asOfDate
      ? parseDateKey(
          asOfDate
        )
      : currentLondonDateKey();

  const selectedLookbackDays =
    clampInteger(
      lookbackDays,
      90,
      730,
      DEFAULT_AI_SALES_FORECAST_OPTIONS
        .lookbackDays
    );

  const firstDateKey =
    shiftDateKey(
      asOfDateKey,
      -(
        selectedLookbackDays -
        1
      )
    );

  const queryStart =
    new Date(
      londonDayBounds(
        firstDateKey
      ).start.getTime() -
        DAY_MS
    );

  const queryEnd =
    new Date(
      londonDayBounds(
        shiftDateKey(
          asOfDateKey,
          1
        )
      ).end.getTime() +
        DAY_MS
    );

  const [
    appointments,
    orders,
    payments,
  ] = await Promise.all([
    Appointment.find({
      status:
        "completed",

      $or: [
        {
          completedAt: {
            $gte:
              queryStart,

            $lt:
              queryEnd,
          },
        },

        {
          startsAt: {
            $gte:
              queryStart,

            $lt:
              queryEnd,
          },
        },

        {
          appointmentDate: {
            $gte:
              queryStart,

            $lt:
              queryEnd,
          },
        },
      ],
    })
      .select(
        [
          "service",
          "appointmentDate",
          "appointmentTime",
          "startsAt",
          "completedAt",
          "status",
          "totalPrice",
          "discount",
          "tax",
          "finalPrice",
          "amountPaid",
          "paymentStatus",
        ].join(" ")
      )
      .populate(
        "service",
        "name title category price"
      )
      .lean(),

    Order.find({
      status: {
        $in:
          ORDER_STATUSES,
      },

      $or: [
        {
          updatedAt: {
            $gte:
              queryStart,

            $lt:
              queryEnd,
          },
        },

        {
          createdAt: {
            $gte:
              queryStart,

            $lt:
              queryEnd,
          },
        },
      ],
    })
      .select(
        [
          "items",
          "subtotal",
          "discountTotal",
          "total",
          "status",
          "payment",
          "createdAt",
          "updatedAt",
        ].join(" ")
      )
      .populate(
        "items.product",
        "name category price costPrice"
      )
      .lean(),

    Payment.find({
      status: {
        $in:
          PAYMENT_STATUSES,
      },

      currency:
        CURRENCY,

      $or: [
        {
          paidAt: {
            $gte:
              queryStart,

            $lt:
              queryEnd,
          },
        },

        {
          updatedAt: {
            $gte:
              queryStart,

            $lt:
              queryEnd,
          },
        },

        {
          createdAt: {
            $gte:
              queryStart,

            $lt:
              queryEnd,
          },
        },
      ],
    })
      .select(
        [
          "appointment",
          "order",
          "purpose",
          "amount",
          "currency",
          "status",
          "paidAt",
          "metadata",
          "createdAt",
          "updatedAt",
        ].join(" ")
      )
      .lean(),
  ]);

  return {
    appointments,
    orders,
    payments,

    asOfDate:
      asOfDateKey,

    lookbackDays:
      selectedLookbackDays,
  };
}

export async function createAiSalesForecast({
  requestId,
  ...options
} = {}) {
  const source =
    await loadSalesForecastSourceData(
      options
    );

  const payload =
    buildSalesForecastPayload({
      ...source,
      ...options,

      asOfDate:
        source.asOfDate,

      lookbackDays:
        source.lookbackDays,
    });

  try {
    const forecast =
      await forecastSales(
        payload,
        {
          requestId,
        }
      );

    return {
      forecast,

      source: {
        timezone:
          TIMEZONE,

        currency:
          CURRENCY,

        asOfDate:
          payload.as_of_date,

        historyStart:
          payload
            .observations[0]
            ?.business_date ||
          null,

        historyEnd:
          payload
            .observations
            .at(-1)
            ?.business_date ||
          null,

        historyDays:
          payload
            .observations
            .length,

        appointmentRecords:
          source
            .appointments
            .length,

        orderRecords:
          source
            .orders
            .length,

        paymentRecords:
          source
            .payments
            .length,

        privacy: {
          customerPiiSentToAi:
            false,

          staffPiiSentToAi:
            false,

          paymentCardDataSentToAi:
            false,

          freeTextSentToAi:
            false,
        },
      },
    };
  } catch (error) {
    if (
      error instanceof
      AiSalesForecastingError
    ) {
      throw error;
    }

    throw new AiSalesForecastingError(
      error?.message ||
        "Unable to generate the AI sales forecast.",
      {
        code:
          error?.code ||
          "AI_SALES_FORECASTING_FAILED",

        status:
          error?.statusCode ||
          error?.status ||
          502,

        details:
          error?.details ||
          null,

        cause:
          error,
      }
    );
  }
}

export default {
  buildSalesForecastPayload,
  createAiSalesForecast,
  loadSalesForecastSourceData,
};