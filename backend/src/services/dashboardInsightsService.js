import Appointment from "../models/appointment.js";
import Service from "../models/service.js";
import Stylist from "../models/stylist.js";

function normalizePositiveInteger(
  value,
  fallback = 30,
  maximum = 365
) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.min(parsedValue, maximum);
}

function roundNumber(value, decimals = 2) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number(numericValue.toFixed(decimals));
}

function calculatePercentageChange(current, previous) {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;

  if (previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return roundNumber(
    ((currentValue - previousValue) / previousValue) * 100,
    1
  );
}

function getTrendTone(change) {
  if (change > 5) {
    return "positive";
  }

  if (change < -5) {
    return "negative";
  }

  return "neutral";
}

function getPeriodRanges(days) {
  const safeDays = normalizePositiveInteger(days);

  const currentEnd = new Date();

  const currentStart = new Date(currentEnd);
  currentStart.setHours(0, 0, 0, 0);
  currentStart.setDate(
    currentStart.getDate() - (safeDays - 1)
  );

  const previousEnd = new Date(
    currentStart.getTime() - 1
  );

  const previousStart = new Date(currentStart);
  previousStart.setDate(
    previousStart.getDate() - safeDays
  );

  return {
    days: safeDays,
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
  };
}

function getRevenueCondition() {
  return {
    $or: [
      {
        $eq: ["$paymentStatus", "paid"],
      },
      {
        $eq: ["$status", "completed"],
      },
    ],
  };
}

function getRevenueExpression() {
  return {
    $ifNull: [
      "$finalPrice",
      {
        $ifNull: ["$totalPrice", 0],
      },
    ],
  };
}

async function getPeriodSummary(startDate, endDate) {
  const result = await Appointment.aggregate([
    {
      $match: {
        appointmentDate: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: null,

        appointments: {
          $sum: 1,
        },

        completedAppointments: {
          $sum: {
            $cond: [
              {
                $eq: ["$status", "completed"],
              },
              1,
              0,
            ],
          },
        },

        cancelledAppointments: {
          $sum: {
            $cond: [
              {
                $eq: ["$status", "cancelled"],
              },
              1,
              0,
            ],
          },
        },

        pendingAppointments: {
          $sum: {
            $cond: [
              {
                $eq: ["$status", "pending"],
              },
              1,
              0,
            ],
          },
        },

        revenue: {
          $sum: {
            $cond: [
              getRevenueCondition(),
              getRevenueExpression(),
              0,
            ],
          },
        },

        customers: {
          $addToSet: "$customer",
        },
      },
    },
    {
      $project: {
        _id: 0,
        appointments: 1,
        completedAppointments: 1,
        cancelledAppointments: 1,
        pendingAppointments: 1,

        revenue: {
          $round: ["$revenue", 2],
        },

        uniqueCustomers: {
          $size: {
            $filter: {
              input: "$customers",
              as: "customer",
              cond: {
                $ne: ["$$customer", null],
              },
            },
          },
        },
      },
    },
  ]);

  return (
    result[0] ?? {
      appointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      pendingAppointments: 0,
      revenue: 0,
      uniqueCustomers: 0,
    }
  );
}

async function getTopService(startDate, endDate) {
  const results = await Appointment.aggregate([
    {
      $match: {
        appointmentDate: {
          $gte: startDate,
          $lte: endDate,
        },

        service: {
          $ne: null,
        },

        $or: [
          {
            paymentStatus: "paid",
          },
          {
            status: "completed",
          },
        ],
      },
    },
    {
      $lookup: {
        from: Service.collection.name,
        localField: "service",
        foreignField: "_id",
        as: "serviceDetails",
      },
    },
    {
      $unwind: {
        path: "$serviceDetails",
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $group: {
        _id: "$serviceDetails._id",

        name: {
          $first: "$serviceDetails.name",
        },

        appointments: {
          $sum: 1,
        },

        revenue: {
          $sum: getRevenueExpression(),
        },
      },
    },
    {
      $sort: {
        revenue: -1,
        appointments: -1,
      },
    },
    {
      $limit: 1,
    },
    {
      $project: {
        _id: 1,
        name: 1,
        appointments: 1,

        revenue: {
          $round: ["$revenue", 2],
        },
      },
    },
  ]);

  return results[0] ?? null;
}

async function getTopStylist(startDate, endDate) {
  const results = await Appointment.aggregate([
    {
      $match: {
        appointmentDate: {
          $gte: startDate,
          $lte: endDate,
        },

        stylist: {
          $ne: null,
        },

        $or: [
          {
            paymentStatus: "paid",
          },
          {
            status: "completed",
          },
        ],
      },
    },
    {
      $lookup: {
        from: Stylist.collection.name,
        localField: "stylist",
        foreignField: "_id",
        as: "stylistDetails",
      },
    },
    {
      $unwind: {
        path: "$stylistDetails",
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $addFields: {
        stylistDisplayName: {
          $ifNull: [
            "$stylistDetails.fullName",
            {
              $ifNull: [
                "$stylistDetails.name",
                {
                  $concat: [
                    {
                      $ifNull: [
                        "$stylistDetails.firstName",
                        "",
                      ],
                    },
                    " ",
                    {
                      $ifNull: [
                        "$stylistDetails.lastName",
                        "",
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: "$stylistDetails._id",

        name: {
          $first: "$stylistDisplayName",
        },

        appointments: {
          $sum: 1,
        },

        revenue: {
          $sum: getRevenueExpression(),
        },
      },
    },
    {
      $sort: {
        revenue: -1,
        appointments: -1,
      },
    },
    {
      $limit: 1,
    },
    {
      $project: {
        _id: 1,

        name: {
          $trim: {
            input: "$name",
          },
        },

        appointments: 1,

        revenue: {
          $round: ["$revenue", 2],
        },
      },
    },
  ]);

  return results[0] ?? null;
}

class DashboardInsightsService {
  async getInsights(days = 30) {
    const {
      days: safeDays,
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
    } = getPeriodRanges(days);

    const [
      currentPeriod,
      previousPeriod,
      topService,
      topStylist,
    ] = await Promise.all([
      getPeriodSummary(currentStart, currentEnd),

      getPeriodSummary(previousStart, previousEnd),

      getTopService(currentStart, currentEnd),

      getTopStylist(currentStart, currentEnd),
    ]);

    const revenueChange = calculatePercentageChange(
      currentPeriod.revenue,
      previousPeriod.revenue
    );

    const appointmentChange = calculatePercentageChange(
      currentPeriod.appointments,
      previousPeriod.appointments
    );

    const customerChange = calculatePercentageChange(
      currentPeriod.uniqueCustomers,
      previousPeriod.uniqueCustomers
    );

    const cancellationRate =
      currentPeriod.appointments > 0
        ? roundNumber(
            (currentPeriod.cancelledAppointments /
              currentPeriod.appointments) *
              100,
            1
          )
        : 0;

    const completionRate =
      currentPeriod.appointments > 0
        ? roundNumber(
            (currentPeriod.completedAppointments /
              currentPeriod.appointments) *
              100,
            1
          )
        : 0;

    const insights = [
      {
        id: "revenue-trend",
        category: "revenue",
        tone: getTrendTone(revenueChange),
        title: "Revenue trend",
        message:
          revenueChange > 0
            ? `Revenue increased by ${revenueChange}% compared with the previous ${safeDays}-day period.`
            : revenueChange < 0
              ? `Revenue decreased by ${Math.abs(
                  revenueChange
                )}% compared with the previous ${safeDays}-day period.`
              : `Revenue was unchanged compared with the previous ${safeDays}-day period.`,
        value: currentPeriod.revenue,
        previousValue: previousPeriod.revenue,
        changePercentage: revenueChange,
      },

      {
        id: "appointment-demand",
        category: "appointments",
        tone: getTrendTone(appointmentChange),
        title: "Appointment demand",
        message:
          appointmentChange > 0
            ? `Appointment volume increased by ${appointmentChange}%.`
            : appointmentChange < 0
              ? `Appointment volume decreased by ${Math.abs(
                  appointmentChange
                )}%.`
              : "Appointment volume remained stable.",
        value: currentPeriod.appointments,
        previousValue: previousPeriod.appointments,
        changePercentage: appointmentChange,
      },

      {
        id: "customer-activity",
        category: "customers",
        tone: getTrendTone(customerChange),
        title: "Customer activity",
        message:
          customerChange > 0
            ? `The number of active customers increased by ${customerChange}%.`
            : customerChange < 0
              ? `The number of active customers decreased by ${Math.abs(
                  customerChange
                )}%.`
              : "The number of active customers remained stable.",
        value: currentPeriod.uniqueCustomers,
        previousValue: previousPeriod.uniqueCustomers,
        changePercentage: customerChange,
      },

      {
        id: "completion-rate",
        category: "operations",
        tone:
          completionRate >= 80
            ? "positive"
            : completionRate >= 60
              ? "neutral"
              : "negative",
        title: "Appointment completion",
        message: `${completionRate}% of appointments were completed during this period.`,
        value: completionRate,
        unit: "percent",
      },

      {
        id: "cancellation-rate",
        category: "operations",
        tone:
          cancellationRate <= 5
            ? "positive"
            : cancellationRate <= 15
              ? "neutral"
              : "negative",
        title: "Cancellation rate",
        message:
          cancellationRate > 15
            ? `The cancellation rate is ${cancellationRate}%. Consider introducing automated reminders or deposit requirements.`
            : `The cancellation rate is ${cancellationRate}%.`,
        value: cancellationRate,
        unit: "percent",
      },
    ];

    if (topService) {
      insights.push({
        id: "top-service",
        category: "services",
        tone: "positive",
        title: "Top-performing service",
        message: `${topService.name} generated the most revenue during this period.`,
        value: topService.revenue,
        appointments: topService.appointments,
        entity: {
          id: topService._id,
          name: topService.name,
        },
      });
    }

    if (topStylist) {
      insights.push({
        id: "top-stylist",
        category: "stylists",
        tone: "positive",
        title: "Top-performing stylist",
        message: `${topStylist.name} generated the highest stylist revenue during this period.`,
        value: topStylist.revenue,
        appointments: topStylist.appointments,
        entity: {
          id: topStylist._id,
          name: topStylist.name,
        },
      });
    }

    if (currentPeriod.pendingAppointments > 0) {
      insights.push({
        id: "pending-appointments",
        category: "operations",
        tone: "neutral",
        title: "Appointments awaiting confirmation",
        message: `${currentPeriod.pendingAppointments} appointment${
          currentPeriod.pendingAppointments === 1
            ? " is"
            : "s are"
        } still pending confirmation.`,
        value: currentPeriod.pendingAppointments,
      });
    }

    return {
      period: {
        days: safeDays,
        currentStart,
        currentEnd,
        previousStart,
        previousEnd,
      },

      summary: {
        current: currentPeriod,
        previous: previousPeriod,
        revenueChange,
        appointmentChange,
        customerChange,
        cancellationRate,
        completionRate,
      },

      insights,
    };
  }
}

export default new DashboardInsightsService();