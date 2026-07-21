import Appointment from "../models/appointment.js";
import Customer from "../models/customer.js";

function normalizePositiveInteger(
  value,
  fallback,
  maximum = 365
) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.min(parsedValue, maximum);
}

function getStartDate(days) {
  const safeDays = normalizePositiveInteger(days, 90);

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (safeDays - 1));

  return startDate;
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

function getValidAppointmentMatch() {
  return {
    customer: {
      $ne: null,
    },

    status: {
      $nin: ["cancelled", "no_show"],
    },
  };
}

function roundNumber(value, decimals = 2) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number(numericValue.toFixed(decimals));
}

class CustomerRetentionService {
  async getRetentionSummary(days = 90) {
    const safeDays = normalizePositiveInteger(days, 90);
    const periodStart = getStartDate(safeDays);
    const periodEnd = new Date();

    const customerHistory = await Appointment.aggregate([
      {
        $match: getValidAppointmentMatch(),
      },
      {
        $group: {
          _id: "$customer",

          firstAppointmentDate: {
            $min: "$appointmentDate",
          },

          lastAppointmentDate: {
            $max: "$appointmentDate",
          },

          totalAppointments: {
            $sum: 1,
          },

          periodAppointments: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $gte: [
                        "$appointmentDate",
                        periodStart,
                      ],
                    },
                    {
                      $lte: [
                        "$appointmentDate",
                        periodEnd,
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },

          appointmentsBeforePeriod: {
            $sum: {
              $cond: [
                {
                  $lt: [
                    "$appointmentDate",
                    periodStart,
                  ],
                },
                1,
                0,
              ],
            },
          },

          lifetimeValue: {
            $sum: {
              $cond: [
                {
                  $or: [
                    {
                      $eq: [
                        "$paymentStatus",
                        "paid",
                      ],
                    },
                    {
                      $eq: [
                        "$status",
                        "completed",
                      ],
                    },
                  ],
                },
                getRevenueExpression(),
                0,
              ],
            },
          },

          periodRevenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $gte: [
                        "$appointmentDate",
                        periodStart,
                      ],
                    },
                    {
                      $lte: [
                        "$appointmentDate",
                        periodEnd,
                      ],
                    },
                    {
                      $or: [
                        {
                          $eq: [
                            "$paymentStatus",
                            "paid",
                          ],
                        },
                        {
                          $eq: [
                            "$status",
                            "completed",
                          ],
                        },
                      ],
                    },
                  ],
                },
                getRevenueExpression(),
                0,
              ],
            },
          },
        },
      },
      {
        $match: {
          periodAppointments: {
            $gt: 0,
          },
        },
      },
      {
        $project: {
          _id: 1,
          firstAppointmentDate: 1,
          lastAppointmentDate: 1,
          totalAppointments: 1,
          periodAppointments: 1,
          appointmentsBeforePeriod: 1,
          lifetimeValue: {
            $round: ["$lifetimeValue", 2],
          },
          periodRevenue: {
            $round: ["$periodRevenue", 2],
          },
          customerType: {
            $cond: [
              {
                $gt: [
                  "$appointmentsBeforePeriod",
                  0,
                ],
              },
              "returning",
              "new",
            ],
          },
        },
      },
    ]);

    const activeCustomers = customerHistory.length;

    const newCustomers = customerHistory.filter(
      (customer) => customer.customerType === "new"
    ).length;

    const returningCustomers = customerHistory.filter(
      (customer) =>
        customer.customerType === "returning"
    ).length;

    const totalPeriodAppointments =
      customerHistory.reduce(
        (total, customer) =>
          total + customer.periodAppointments,
        0
      );

    const totalPeriodRevenue = customerHistory.reduce(
      (total, customer) =>
        total + Number(customer.periodRevenue || 0),
      0
    );

    const retentionRate =
      activeCustomers > 0
        ? roundNumber(
            (returningCustomers / activeCustomers) * 100,
            1
          )
        : 0;

    const averageVisitsPerCustomer =
      activeCustomers > 0
        ? roundNumber(
            totalPeriodAppointments / activeCustomers,
            1
          )
        : 0;

    const averageRevenuePerCustomer =
      activeCustomers > 0
        ? roundNumber(
            totalPeriodRevenue / activeCustomers,
            2
          )
        : 0;

    return {
      period: {
        days: safeDays,
        startDate: periodStart,
        endDate: periodEnd,
      },

      activeCustomers,
      newCustomers,
      returningCustomers,
      retentionRate,
      totalAppointments: totalPeriodAppointments,
      totalRevenue: roundNumber(totalPeriodRevenue),
      averageVisitsPerCustomer,
      averageRevenuePerCustomer,
    };
  }

  async getNewVsReturning(days = 90) {
    const summary = await this.getRetentionSummary(days);

    return [
      {
        type: "new",
        label: "New Customers",
        count: summary.newCustomers,
      },
      {
        type: "returning",
        label: "Returning Customers",
        count: summary.returningCustomers,
      },
    ];
  }

  async getDormantCustomers(
    dormantDays = 60,
    limit = 20
  ) {
    const safeDormantDays = normalizePositiveInteger(
      dormantDays,
      60,
      730
    );

    const safeLimit = normalizePositiveInteger(
      limit,
      20,
      100
    );

    const dormantBefore = new Date();
    dormantBefore.setHours(23, 59, 59, 999);
    dormantBefore.setDate(
      dormantBefore.getDate() - safeDormantDays
    );

    return Appointment.aggregate([
      {
        $match: getValidAppointmentMatch(),
      },
      {
        $group: {
          _id: "$customer",

          lastAppointmentDate: {
            $max: "$appointmentDate",
          },

          totalAppointments: {
            $sum: 1,
          },

          lifetimeValue: {
            $sum: {
              $cond: [
                {
                  $or: [
                    {
                      $eq: [
                        "$paymentStatus",
                        "paid",
                      ],
                    },
                    {
                      $eq: [
                        "$status",
                        "completed",
                      ],
                    },
                  ],
                },
                getRevenueExpression(),
                0,
              ],
            },
          },
        },
      },
      {
        $match: {
          lastAppointmentDate: {
            $lt: dormantBefore,
          },
        },
      },
      {
        $lookup: {
          from: Customer.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "customerDetails",
        },
      },
      {
        $unwind: {
          path: "$customerDetails",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          "customerDetails.archived": {
            $ne: true,
          },
        },
      },
      {
        $addFields: {
          customerName: {
            $ifNull: [
              "$customerDetails.fullName",
              {
                $ifNull: [
                  "$customerDetails.name",
                  {
                    $concat: [
                      {
                        $ifNull: [
                          "$customerDetails.firstName",
                          "",
                        ],
                      },
                      " ",
                      {
                        $ifNull: [
                          "$customerDetails.lastName",
                          "",
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },

          daysSinceLastVisit: {
            $dateDiff: {
              startDate: "$lastAppointmentDate",
              endDate: "$$NOW",
              unit: "day",
            },
          },
        },
      },
      {
        $sort: {
          lifetimeValue: -1,
          lastAppointmentDate: 1,
        },
      },
      {
        $limit: safeLimit,
      },
      {
        $project: {
          _id: 0,

          customerId: "$customerDetails._id",

          customerName: {
            $trim: {
              input: "$customerName",
            },
          },

          email: "$customerDetails.email",
          phone: "$customerDetails.phone",

          lastAppointmentDate: 1,
          daysSinceLastVisit: 1,
          totalAppointments: 1,

          lifetimeValue: {
            $round: ["$lifetimeValue", 2],
          },
        },
      },
    ]);
  }

  async getTopCustomers(days = 365, limit = 10) {
    const safeDays = normalizePositiveInteger(
      days,
      365,
      1825
    );

    const safeLimit = normalizePositiveInteger(
      limit,
      10,
      50
    );

    const startDate = getStartDate(safeDays);

    return Appointment.aggregate([
      {
        $match: {
          ...getValidAppointmentMatch(),

          appointmentDate: {
            $gte: startDate,
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
        $group: {
          _id: "$customer",

          appointments: {
            $sum: 1,
          },

          revenue: {
            $sum: getRevenueExpression(),
          },

          lastAppointmentDate: {
            $max: "$appointmentDate",
          },
        },
      },
      {
        $lookup: {
          from: Customer.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "customerDetails",
        },
      },
      {
        $unwind: {
          path: "$customerDetails",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $addFields: {
          customerName: {
            $ifNull: [
              "$customerDetails.fullName",
              {
                $ifNull: [
                  "$customerDetails.name",
                  {
                    $concat: [
                      {
                        $ifNull: [
                          "$customerDetails.firstName",
                          "",
                        ],
                      },
                      " ",
                      {
                        $ifNull: [
                          "$customerDetails.lastName",
                          "",
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },

          averageAppointmentValue: {
            $cond: [
              {
                $gt: ["$appointments", 0],
              },
              {
                $divide: [
                  "$revenue",
                  "$appointments",
                ],
              },
              0,
            ],
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
        $limit: safeLimit,
      },
      {
        $project: {
          _id: 0,

          customerId: "$customerDetails._id",

          customerName: {
            $trim: {
              input: "$customerName",
            },
          },

          email: "$customerDetails.email",

          appointments: 1,

          revenue: {
            $round: ["$revenue", 2],
          },

          averageAppointmentValue: {
            $round: [
              "$averageAppointmentValue",
              2,
            ],
          },

          lastAppointmentDate: 1,
        },
      },
    ]);
  }

  async getAnalytics({
    days = 90,
    dormantDays = 60,
    dormantLimit = 20,
    topCustomerLimit = 10,
  } = {}) {
    const [
      summary,
      newVsReturning,
      dormantCustomers,
      topCustomers,
    ] = await Promise.all([
      this.getRetentionSummary(days),

      this.getNewVsReturning(days),

      this.getDormantCustomers(
        dormantDays,
        dormantLimit
      ),

      this.getTopCustomers(
        Math.max(Number(days) || 90, 365),
        topCustomerLimit
      ),
    ]);

    return {
      summary,
      newVsReturning,
      dormantCustomers,
      topCustomers,
    };
  }
}

export default new CustomerRetentionService();