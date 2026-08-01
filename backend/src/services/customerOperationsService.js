import mongoose from "mongoose";

import Appointment from "../models/Appointment.js";
import Customer from "../models/Customer.js";
import CustomerNote from "../models/CustomerNote.js";
import CustomerContactLog from "../models/customerContactLog.js";

const ACTIVE_APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
];

function createServiceError(
  message,
  statusCode = 400,
  code = "CUSTOMER_OPERATIONS_ERROR"
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;

  return error;
}

function assertObjectId(value) {
  if (
    !mongoose.Types.ObjectId.isValid(
      value
    )
  ) {
    throw createServiceError(
      "A valid customer ID is required.",
      400,
      "INVALID_CUSTOMER_ID"
    );
  }

  return new mongoose.Types.ObjectId(
    value
  );
}

function startOfToday() {
  const date = new Date();

  date.setHours(0, 0, 0, 0);

  return date;
}

function appointmentValueExpression() {
  return {
    $ifNull: [
      "$finalPrice",
      {
        $ifNull: [
          "$totalPrice",
          0,
        ],
      },
    ],
  };
}

function normaliseAppointment(
  appointment
) {
  if (!appointment) {
    return null;
  }

  return {
    id: appointment._id,

    appointmentDate:
      appointment.appointmentDate,

    appointmentTime:
      appointment.appointmentTime,

    startsAt:
      appointment.startsAt,

    endsAt:
      appointment.endsAt,

    duration:
      appointment.duration,

    status:
      appointment.status,

    paymentStatus:
      appointment.paymentStatus,

    totalPrice:
      appointment.totalPrice,

    finalPrice:
      appointment.finalPrice,

    amountPaid:
      appointment.amountPaid,

    balanceDue:
      appointment.balanceDue,

    service: appointment.service
      ? {
          id:
            appointment.service._id,

          name:
            appointment.service.name,

          duration:
            appointment.service
              .duration,

          price:
            appointment.service.price,
        }
      : null,

    stylist: appointment.stylist
      ? {
          id:
            appointment.stylist._id,

          name:
            appointment.stylist.name ||
            [
              appointment.stylist
                .firstName,

              appointment.stylist
                .lastName,
            ]
              .filter(Boolean)
              .join(" "),
        }
      : null,
  };
}

export async function getCustomerOperations(
  customerId
) {
  const customerObjectId =
    assertObjectId(customerId);

  const customer =
    await Customer.findById(
      customerObjectId
    )
      .select(
        [
          "firstName",
          "lastName",
          "preferredName",
          "email",
          "phone",
          "status",
          "totalSpent",
          "visitCount",
          "loyaltyPoints",
          "lastVisit",
          "nextAppointment",
        ].join(" ")
      )
      .lean();

  if (!customer) {
    throw createServiceError(
      "Customer profile not found.",
      404,
      "CUSTOMER_NOT_FOUND"
    );
  }

  const now = new Date();
  const today = startOfToday();

  const [
    appointmentSummaryRows,
    upcomingAppointments,
    recentAppointments,
    noteSummaryRows,
    recentNotes,
    contactCount,
    recentContacts,
  ] = await Promise.all([
    Appointment.aggregate([
      {
        $match: {
          customer:
            customerObjectId,
        },
      },

      {
        $group: {
          _id: null,

          totalAppointments: {
            $sum: 1,
          },

          completedAppointments: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$status",
                    "completed",
                  ],
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
                  $eq: [
                    "$status",
                    "cancelled",
                  ],
                },
                1,
                0,
              ],
            },
          },

          noShowAppointments: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$status",
                    "no_show",
                  ],
                },
                1,
                0,
              ],
            },
          },

          totalBookedValue: {
            $sum:
              appointmentValueExpression(),
          },

          totalPaid: {
            $sum: {
              $ifNull: [
                "$amountPaid",
                0,
              ],
            },
          },

          outstandingBalance: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    [
                      "cancelled",
                      "no_show",
                    ],
                  ],
                },
                0,
                {
                  $ifNull: [
                    "$balanceDue",
                    0,
                  ],
                },
              ],
            },
          },
        },
      },
    ]),

    Appointment.find({
      customer: customerObjectId,

      status: {
        $in:
          ACTIVE_APPOINTMENT_STATUSES,
      },

      $or: [
        {
          startsAt: {
            $gte: now,
          },
        },

        {
          startsAt: null,

          appointmentDate: {
            $gte: today,
          },
        },
      ],
    })
      .populate(
        "service",
        "name duration price"
      )
      .populate(
        "stylist",
        "name firstName lastName"
      )
      .sort({
        startsAt: 1,
        appointmentDate: 1,
        appointmentTime: 1,
      })
      .limit(5)
      .lean(),

    Appointment.find({
      customer: customerObjectId,
    })
      .populate(
        "service",
        "name duration price"
      )
      .populate(
        "stylist",
        "name firstName lastName"
      )
      .sort({
        appointmentDate: -1,
        appointmentTime: -1,
      })
      .limit(8)
      .lean(),

    CustomerNote.aggregate([
      {
        $match: {
          customer:
            customerObjectId,

          deletedAt: null,
        },
      },

      {
        $group: {
          _id: null,

          totalNotes: {
            $sum: 1,
          },

          pinnedNotes: {
            $sum: {
              $cond: [
                "$pinned",
                1,
                0,
              ],
            },
          },

          openFollowUps: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: [
                        "$requiresFollowUp",
                        true,
                      ],
                    },

                    {
                      $eq: [
                        "$followUpCompleted",
                        false,
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },

          overdueFollowUps: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: [
                        "$requiresFollowUp",
                        true,
                      ],
                    },

                    {
                      $eq: [
                        "$followUpCompleted",
                        false,
                      ],
                    },

                    {
                      $lt: [
                        "$followUpAt",
                        now,
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),

    CustomerNote.find({
      customer: customerObjectId,
      deletedAt: null,
    })
      .select(
        [
          "title",
          "content",
          "type",
          "visibility",
          "pinned",
          "requiresFollowUp",
          "followUpAt",
          "followUpCompleted",
          "createdAt",
        ].join(" ")
      )
      .sort({
        pinned: -1,
        createdAt: -1,
      })
      .limit(5)
      .lean(),

    CustomerContactLog.countDocuments({
      customer:
        customerObjectId,
    }),

    CustomerContactLog.find({
      customer:
        customerObjectId,
    })
      .select(
        [
          "channel",
          "direction",
          "campaignType",
          "subject",
          "message",
          "status",
          "recipient",
          "sentAt",
          "createdAt",
        ].join(" ")
      )
      .sort({
        createdAt: -1,
      })
      .limit(5)
      .lean(),
  ]);

  const appointmentSummary =
    appointmentSummaryRows[0] || {};

  const noteSummary =
    noteSummaryRows[0] || {};

  const totalAppointments =
    Number(
      appointmentSummary
        .totalAppointments
    ) || 0;

  const completedAppointments =
    Number(
      appointmentSummary
        .completedAppointments
    ) || 0;

  return {
    generatedAt: new Date(),

    customer: {
      id: customer._id,

      name:
        customer.preferredName ||
        [
          customer.firstName,
          customer.lastName,
        ]
          .filter(Boolean)
          .join(" ") ||
        "Customer",

      email:
        customer.email || "",

      phone:
        customer.phone || "",

      status:
        customer.status,

      totalSpent:
        Number(
          customer.totalSpent
        ) || 0,

      visitCount:
        Number(
          customer.visitCount
        ) || 0,

      loyaltyPoints:
        Number(
          customer.loyaltyPoints
        ) || 0,

      lastVisit:
        customer.lastVisit || null,

      nextAppointment:
        customer.nextAppointment ||
        null,
    },

    appointments: {
      total: totalAppointments,

      completed:
        completedAppointments,

      cancelled:
        Number(
          appointmentSummary
            .cancelledAppointments
        ) || 0,

      noShows:
        Number(
          appointmentSummary
            .noShowAppointments
        ) || 0,

      completionRate:
        totalAppointments > 0
          ? Number(
              (
                (
                  completedAppointments /
                  totalAppointments
                ) * 100
              ).toFixed(1)
            )
          : 0,

      totalBookedValue:
        Number(
          appointmentSummary
            .totalBookedValue
        ) || 0,

      totalPaid:
        Number(
          appointmentSummary
            .totalPaid
        ) || 0,

      outstandingBalance:
        Number(
          appointmentSummary
            .outstandingBalance
        ) || 0,

      upcoming:
        upcomingAppointments.map(
          normaliseAppointment
        ),

      recent:
        recentAppointments.map(
          normaliseAppointment
        ),
    },

    notes: {
      total:
        Number(
          noteSummary.totalNotes
        ) || 0,

      pinned:
        Number(
          noteSummary.pinnedNotes
        ) || 0,

      openFollowUps:
        Number(
          noteSummary.openFollowUps
        ) || 0,

      overdueFollowUps:
        Number(
          noteSummary
            .overdueFollowUps
        ) || 0,

      recent: recentNotes,
    },

    communications: {
      total:
        Number(contactCount) || 0,

      recent: recentContacts,
    },
  };
}

export default {
  getCustomerOperations,
};