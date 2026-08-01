import Appointment from "../../models/Appointment.js";

const DEFAULT_HISTORY_MONTHS = 12;
const DEFAULT_FORECAST_MONTHS = 6;

const MIN_HISTORY_MONTHS = 3;
const MAX_HISTORY_MONTHS = 24;

const MIN_FORECAST_MONTHS = 1;
const MAX_FORECAST_MONTHS = 12;

const DEFAULT_COMPLETION_RATE = 0.85;

const BOOKED_STATUSES = new Set([
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
]);

const LOST_STATUSES = new Set([
  "cancelled",
  "no_show",
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
    (Number(value) || 0) *
      100
  ) / 100;
}

function roundPercentage(value) {
  return Math.round(
    (Number(value) || 0) *
      100
  ) / 100;
}

function startOfUtcMonth(value) {
  const date =
    new Date(value);

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      1,
      0,
      0,
      0,
      0
    )
  );
}

function addUtcMonths(
  value,
  monthCount
) {
  const date =
    startOfUtcMonth(value);

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() +
        monthCount,
      1,
      0,
      0,
      0,
      0
    )
  );
}

function getMonthKey(value) {
  const date =
    new Date(value);

  return [
    date.getUTCFullYear(),
    String(
      date.getUTCMonth() + 1
    ).padStart(2, "0"),
  ].join("-");
}

function getMonthLabel(value) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(
    new Date(value)
  );
}

function createHistoricalBucket(
  monthStart
) {
  return {
    month:
      getMonthKey(
        monthStart
      ),

    label:
      getMonthLabel(
        monthStart
      ),

    monthStart:
      monthStart.toISOString(),

    totalAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    noShowAppointments: 0,

    scheduledRevenue: 0,
    earnedRevenue: 0,
    collectedRevenue: 0,
    outstandingRevenue: 0,

    completionRate: 0,
    cancellationRate: 0,
    noShowRate: 0,
  };
}

function createForecastBucket(
  monthStart
) {
  return {
    month:
      getMonthKey(
        monthStart
      ),

    label:
      getMonthLabel(
        monthStart
      ),

    monthStart:
      monthStart.toISOString(),

    totalAppointments: 0,
    bookedAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    noShowAppointments: 0,

    actualRevenue: 0,
    collectedRevenue: 0,
    bookedRevenue: 0,

    modelForecast: 0,
    expectedRevenue: 0,
    potentialRevenue: 0,
  };
}

function getAppointmentRevenue(
  appointment
) {
  const finalPrice =
    Number(
      appointment.finalPrice
    );

  if (
    Number.isFinite(
      finalPrice
    ) &&
    finalPrice >= 0
  ) {
    return finalPrice;
  }

  return Math.max(
    Number(
      appointment.totalPrice
    ) || 0,
    0
  );
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return (
    values.reduce(
      (total, value) =>
        total +
        Number(value || 0),
      0
    ) / values.length
  );
}

function standardDeviation(
  values
) {
  if (
    values.length < 2
  ) {
    return 0;
  }

  const mean =
    average(values);

  const variance =
    average(
      values.map(
        (value) =>
          Math.pow(
            Number(value || 0) -
              mean,
            2
          )
      )
    );

  return Math.sqrt(
    variance
  );
}

function calculateTrend(
  values
) {
  if (
    values.length < 2
  ) {
    return {
      slope: 0,
      intercept:
        values[0] || 0,
    };
  }

  const pointCount =
    values.length;

  const xValues =
    values.map(
      (_, index) => index
    );

  const averageX =
    average(xValues);

  const averageY =
    average(values);

  let numerator = 0;
  let denominator = 0;

  values.forEach(
    (value, index) => {
      numerator +=
        (index -
          averageX) *
        (value -
          averageY);

      denominator +=
        Math.pow(
          index -
            averageX,
          2
        );
    }
  );

  const rawSlope =
    denominator === 0
      ? 0
      : numerator /
        denominator;

  /*
  |--------------------------------------------------------------------------
  | Trend guardrail
  |--------------------------------------------------------------------------
  |
  | A single unusual month should not produce an unrealistic forecast.
  | Monthly trend is therefore limited to 25% of the historical average.
  |
  */

  const maximumSlope =
    Math.max(
      averageY * 0.25,
      1
    );

  const slope =
    Math.min(
      maximumSlope,
      Math.max(
        -maximumSlope,
        rawSlope
      )
    );

  const intercept =
    averageY -
    slope *
      averageX;

  return {
    slope,
    intercept,
  };
}

function calculateCompletionRate(
  historicalBuckets
) {
  const totals =
    historicalBuckets.reduce(
      (summary, bucket) => {
        summary.completed +=
          bucket.completedAppointments;

        summary.cancelled +=
          bucket.cancelledAppointments;

        summary.noShow +=
          bucket.noShowAppointments;

        return summary;
      },
      {
        completed: 0,
        cancelled: 0,
        noShow: 0,
      }
    );

  const terminalAppointments =
    totals.completed +
    totals.cancelled +
    totals.noShow;

  if (
    terminalAppointments ===
    0
  ) {
    return DEFAULT_COMPLETION_RATE;
  }

  return (
    totals.completed /
    terminalAppointments
  );
}

function calculateConfidence({
  historicalValues,
  completionRate,
}) {
  const dataPointScore =
    Math.min(
      historicalValues.length /
        12,
      1
    );

  const nonZeroMonths =
    historicalValues.filter(
      (value) =>
        Number(value) > 0
    ).length;

  const coverageScore =
    historicalValues.length
      ? nonZeroMonths /
        historicalValues.length
      : 0;

  const mean =
    average(
      historicalValues
    );

  const volatility =
    mean > 0
      ? standardDeviation(
          historicalValues
        ) / mean
      : 1;

  const volatilityScore =
    Math.max(
      0,
      1 -
        Math.min(
          volatility,
          1
        )
    );

  const confidence =
    0.25 +
    dataPointScore * 0.3 +
    coverageScore * 0.2 +
    volatilityScore * 0.15 +
    completionRate * 0.1;

  return Math.round(
    Math.min(
      0.92,
      Math.max(
        0.2,
        confidence
      )
    ) * 100
  );
}

function finaliseHistoricalBucket(
  bucket
) {
  const terminalAppointments =
    bucket.completedAppointments +
    bucket.cancelledAppointments +
    bucket.noShowAppointments;

  bucket.scheduledRevenue =
    roundMoney(
      bucket.scheduledRevenue
    );

  bucket.earnedRevenue =
    roundMoney(
      bucket.earnedRevenue
    );

  bucket.collectedRevenue =
    roundMoney(
      bucket.collectedRevenue
    );

  bucket.outstandingRevenue =
    roundMoney(
      bucket.outstandingRevenue
    );

  bucket.completionRate =
    terminalAppointments > 0
      ? roundPercentage(
          (bucket.completedAppointments /
            terminalAppointments) *
            100
        )
      : 0;

  bucket.cancellationRate =
    terminalAppointments > 0
      ? roundPercentage(
          (bucket.cancelledAppointments /
            terminalAppointments) *
            100
        )
      : 0;

  bucket.noShowRate =
    terminalAppointments > 0
      ? roundPercentage(
          (bucket.noShowAppointments /
            terminalAppointments) *
            100
        )
      : 0;

  return bucket;
}

function findBestMonth(
  historicalBuckets
) {
  if (
    !historicalBuckets.length
  ) {
    return null;
  }

  return historicalBuckets.reduce(
    (bestMonth, month) =>
      month.earnedRevenue >
      bestMonth.earnedRevenue
        ? month
        : bestMonth
  );
}

function findWeakestMonth(
  historicalBuckets
) {
  const monthsWithRevenue =
    historicalBuckets.filter(
      (month) =>
        month.earnedRevenue > 0
    );

  if (
    !monthsWithRevenue.length
  ) {
    return null;
  }

  return monthsWithRevenue.reduce(
    (weakestMonth, month) =>
      month.earnedRevenue <
      weakestMonth.earnedRevenue
        ? month
        : weakestMonth
  );
}

async function generateRevenueForecast({
  months =
    DEFAULT_HISTORY_MONTHS,

  forecastMonths =
    DEFAULT_FORECAST_MONTHS,

  now =
    new Date(),
} = {}) {
  const historyMonthCount =
    clampInteger(
      months,
      MIN_HISTORY_MONTHS,
      MAX_HISTORY_MONTHS,
      DEFAULT_HISTORY_MONTHS
    );

  const forecastMonthCount =
    clampInteger(
      forecastMonths,
      MIN_FORECAST_MONTHS,
      MAX_FORECAST_MONTHS,
      DEFAULT_FORECAST_MONTHS
    );

  const currentMonthStart =
    startOfUtcMonth(now);

  const historicalStart =
    addUtcMonths(
      currentMonthStart,
      -historyMonthCount
    );

  const forecastEnd =
    addUtcMonths(
      currentMonthStart,
      forecastMonthCount
    );

  const historicalBuckets =
    Array.from(
      {
        length:
          historyMonthCount,
      },
      (_, index) =>
        createHistoricalBucket(
          addUtcMonths(
            historicalStart,
            index
          )
        )
    );

  const forecastBuckets =
    Array.from(
      {
        length:
          forecastMonthCount,
      },
      (_, index) =>
        createForecastBucket(
          addUtcMonths(
            currentMonthStart,
            index
          )
        )
    );

  const historicalMap =
    new Map(
      historicalBuckets.map(
        (bucket) => [
          bucket.month,
          bucket,
        ]
      )
    );

  const forecastMap =
    new Map(
      forecastBuckets.map(
        (bucket) => [
          bucket.month,
          bucket,
        ]
      )
    );

  const appointments =
    await Appointment.find({
      appointmentDate: {
        $gte:
          historicalStart,

        $lt:
          forecastEnd,
      },
    })
      .select(
        [
          "appointmentDate",
          "status",
          "paymentStatus",
          "totalPrice",
          "finalPrice",
          "amountPaid",
          "balanceDue",
        ].join(" ")
      )
      .sort({
        appointmentDate: 1,
      })
      .lean();

  appointments.forEach(
    (appointment) => {
      const appointmentDate =
        new Date(
          appointment.appointmentDate
        );

      if (
        Number.isNaN(
          appointmentDate.getTime()
        )
      ) {
        return;
      }

      const monthKey =
        getMonthKey(
          appointmentDate
        );

      const status =
        String(
          appointment.status ||
            "pending"
        )
          .trim()
          .toLowerCase();

      const paymentStatus =
        String(
          appointment.paymentStatus ||
            "pending"
        )
          .trim()
          .toLowerCase();

      const appointmentRevenue =
        getAppointmentRevenue(
          appointment
        );

      const amountPaid =
        Math.max(
          Number(
            appointment.amountPaid
          ) || 0,
          0
        );

      const balanceDue =
        Math.max(
          Number(
            appointment.balanceDue
          ) || 0,
          0
        );

      const historicalBucket =
        historicalMap.get(
          monthKey
        );

      if (historicalBucket) {
        historicalBucket.totalAppointments +=
          1;

        if (
          !LOST_STATUSES.has(
            status
          )
        ) {
          historicalBucket.scheduledRevenue +=
            appointmentRevenue;
        }

        if (
          status ===
          "completed"
        ) {
          historicalBucket.completedAppointments +=
            1;

          historicalBucket.earnedRevenue +=
            appointmentRevenue;

          if (
            ![
              "refunded",
              "cancelled",
            ].includes(
              paymentStatus
            )
          ) {
            historicalBucket.collectedRevenue +=
              amountPaid;
          }

          historicalBucket.outstandingRevenue +=
            balanceDue;
        }

        if (
          status ===
          "cancelled"
        ) {
          historicalBucket.cancelledAppointments +=
            1;
        }

        if (
          status ===
          "no_show"
        ) {
          historicalBucket.noShowAppointments +=
            1;
        }

        return;
      }

      const forecastBucket =
        forecastMap.get(
          monthKey
        );

      if (!forecastBucket) {
        return;
      }

      forecastBucket.totalAppointments +=
        1;

      if (
        status ===
        "completed"
      ) {
        forecastBucket.completedAppointments +=
          1;

        forecastBucket.actualRevenue +=
          appointmentRevenue;

        if (
          ![
            "refunded",
            "cancelled",
          ].includes(
            paymentStatus
          )
        ) {
          forecastBucket.collectedRevenue +=
            amountPaid;
        }

        return;
      }

      if (
        BOOKED_STATUSES.has(
          status
        )
      ) {
        forecastBucket.bookedAppointments +=
          1;

        forecastBucket.bookedRevenue +=
          appointmentRevenue;

        return;
      }

      if (
        status ===
        "cancelled"
      ) {
        forecastBucket.cancelledAppointments +=
          1;
      }

      if (
        status ===
        "no_show"
      ) {
        forecastBucket.noShowAppointments +=
          1;
      }
    }
  );

  historicalBuckets.forEach(
    finaliseHistoricalBucket
  );

  const historicalValues =
    historicalBuckets.map(
      (bucket) =>
        bucket.earnedRevenue
    );

  const recentValues =
    historicalValues.slice(
      -Math.min(
        3,
        historicalValues.length
      )
    );

  const recentAverage =
    average(recentValues);

  const historicalAverage =
    average(
      historicalValues
    );

  const {
    slope,
    intercept,
  } =
    calculateTrend(
      historicalValues
    );

  const completionRate =
    calculateCompletionRate(
      historicalBuckets
    );

  const forecastRevenue =
    forecastBuckets.map(
      (bucket, index) => {
        const projectedIndex =
          historicalValues.length +
          index;

        const trendForecast =
          Math.max(
            0,
            intercept +
              slope *
                projectedIndex
          );

        const blendedForecast =
          historicalValues.some(
            (value) =>
              value > 0
          )
            ? trendForecast *
                0.65 +
              recentAverage *
                0.35
            : 0;

        const bookedExpectedRevenue =
          bucket.actualRevenue +
          bucket.bookedRevenue *
            completionRate;

        bucket.actualRevenue =
          roundMoney(
            bucket.actualRevenue
          );

        bucket.collectedRevenue =
          roundMoney(
            bucket.collectedRevenue
          );

        bucket.bookedRevenue =
          roundMoney(
            bucket.bookedRevenue
          );

        bucket.modelForecast =
          roundMoney(
            blendedForecast
          );

        bucket.potentialRevenue =
          roundMoney(
            bucket.actualRevenue +
              bucket.bookedRevenue
          );

        bucket.expectedRevenue =
          roundMoney(
            Math.max(
              bookedExpectedRevenue,
              blendedForecast
            )
          );

        return bucket;
      }
    );

  const historicalTotal =
    roundMoney(
      historicalBuckets.reduce(
        (total, bucket) =>
          total +
          bucket.earnedRevenue,
        0
      )
    );

  const collectedTotal =
    roundMoney(
      historicalBuckets.reduce(
        (total, bucket) =>
          total +
          bucket.collectedRevenue,
        0
      )
    );

  const outstandingTotal =
    roundMoney(
      historicalBuckets.reduce(
        (total, bucket) =>
          total +
          bucket.outstandingRevenue,
        0
      )
    );

  const bookedTotal =
    roundMoney(
      forecastRevenue.reduce(
        (total, bucket) =>
          total +
          bucket.bookedRevenue,
        0
      )
    );

  const forecastTotal =
    roundMoney(
      forecastRevenue.reduce(
        (total, bucket) =>
          total +
          bucket.expectedRevenue,
        0
      )
    );

  const lastHistoricalRevenue =
    historicalBuckets.at(-1)
      ?.earnedRevenue || 0;

  const firstForecastRevenue =
    forecastRevenue[0]
      ?.expectedRevenue || 0;

  const growthRate =
    lastHistoricalRevenue > 0
      ? roundPercentage(
          ((firstForecastRevenue -
            lastHistoricalRevenue) /
            lastHistoricalRevenue) *
            100
        )
      : 0;

  const bestMonth =
    findBestMonth(
      historicalBuckets
    );

  const weakestMonth =
    findWeakestMonth(
      historicalBuckets
    );

  const confidence =
    calculateConfidence({
      historicalValues,
      completionRate,
    });

  return {
    generatedAt:
      new Date().toISOString(),

    currency: "GBP",
    timezone:
      "Europe/London",

    parameters: {
      historyMonths:
        historyMonthCount,

      forecastMonths:
        forecastMonthCount,

      historicalStart:
        historicalStart.toISOString(),

      forecastStart:
        currentMonthStart.toISOString(),

      forecastEnd:
        forecastEnd.toISOString(),
    },

    methodology: {
      name:
        "Blended linear trend",

      description:
        "Combines historical monthly revenue trend, the recent three-month average, current bookings and the historical appointment completion rate.",

      completionRate:
        roundPercentage(
          completionRate * 100
        ),

      confidence,

      assumptions: [
        "Completed appointments recognise final appointment revenue.",
        "Cancelled and no-show appointments do not contribute revenue.",
        "Future booked revenue is weighted by the historical completion rate.",
        "The monthly trend is restricted to reduce the effect of unusual months.",
      ],
    },

    historicalRevenue:
      historicalBuckets,

    bookedRevenue:
      forecastRevenue.map(
        (bucket) => ({
          month:
            bucket.month,

          label:
            bucket.label,

          monthStart:
            bucket.monthStart,

          bookedAppointments:
            bucket.bookedAppointments,

          bookedRevenue:
            bucket.bookedRevenue,

          actualRevenue:
            bucket.actualRevenue,
        })
      ),

    forecastRevenue,

    summary: {
      historicalTotal,
      historicalAverage:
        roundMoney(
          historicalAverage
        ),

      recentAverage:
        roundMoney(
          recentAverage
        ),

      collectedTotal,
      outstandingTotal,
      bookedTotal,
      forecastTotal,

      expectedTotal:
        forecastTotal,

      completionRate:
        roundPercentage(
          completionRate * 100
        ),

      growthRate,
      confidence,

      currentMonthExpected:
        firstForecastRevenue,
    },

    insights: {
      bestHistoricalMonth:
        bestMonth
          ? {
              month:
                bestMonth.month,

              label:
                bestMonth.label,

              revenue:
                bestMonth.earnedRevenue,
            }
          : null,

      weakestHistoricalMonth:
        weakestMonth
          ? {
              month:
                weakestMonth.month,

              label:
                weakestMonth.label,

              revenue:
                weakestMonth.earnedRevenue,
            }
          : null,

      projectedDirection:
        slope > 0
          ? "growing"
          : slope < 0
            ? "declining"
            : "stable",

      monthlyTrend:
        roundMoney(slope),
    },
  };
}

export {
  DEFAULT_FORECAST_MONTHS,
  DEFAULT_HISTORY_MONTHS,
  generateRevenueForecast,
};
