import Customer from "../models/customer.js";
import Stylist from "../models/stylist.js";
import Appointment from "../models/appointment.js";
import Service from "../models/service.js";

function normalizePositiveInteger(value, fallback, maximum = 365) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.min(parsedValue, maximum);
}

function getStartDate(days = 30) {
  const safeDays = normalizePositiveInteger(days, 30);

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (safeDays - 1));

  return startDate;
}

function getAppointmentValue(appointment) {
  const finalPrice = Number(appointment.finalPrice);

  if (Number.isFinite(finalPrice)) {
    return finalPrice;
  }

  const totalPrice = Number(appointment.totalPrice);

  return Number.isFinite(totalPrice) ? totalPrice : 0;
}

class DashboardService {
  async getStats() {
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const [
      customers,
      stylists,
      services,
      appointmentsToday,
      completedAppointments,
    ] = await Promise.all([
      Customer.countDocuments({ archived: false }),
      Stylist.countDocuments({ active: true }),
      Service.countDocuments({ active: true }),
      Appointment.find({
        appointmentDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      }).lean(),
      Appointment.countDocuments({
        status: "completed",
        appointmentDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      }),
    ]);

    const revenueToday = appointmentsToday
      .filter(
        (appointment) =>
          appointment.paymentStatus === "paid" ||
          appointment.status === "completed"
      )
      .reduce(
        (total, appointment) =>
          total + getAppointmentValue(appointment),
        0
      );

    const pendingPayments = appointmentsToday
      .filter(
        (appointment) =>
          appointment.paymentStatus !== "paid" &&
          appointment.status !== "cancelled"
      )
      .reduce((total, appointment) => {
        const balanceDue = Number(appointment.balanceDue);

        if (Number.isFinite(balanceDue)) {
          return total + balanceDue;
        }

        return total + getAppointmentValue(appointment);
      }, 0);

    return {
      customers,
      stylists,
      services,
      appointmentsToday: appointmentsToday.length,
      completedAppointments,
      revenueToday,
      pendingPayments,
    };
  }

  async getTodayAppointments() {
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    return Appointment.find({
      appointmentDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    })
      .populate("customer")
      .populate("stylist")
      .populate("service")
      .sort({
        appointmentDate: 1,
        appointmentTime: 1,
      })
      .lean();
  }

  async getRecentActivity(limit = 10) {
    const safeLimit = normalizePositiveInteger(limit, 10, 50);

    return Appointment.find()
      .populate("customer")
      .populate("stylist")
      .populate("service")
      .sort({
        updatedAt: -1,
      })
      .limit(safeLimit)
      .lean();
  }

  async getRevenue(days = 30) {
    const safeDays = normalizePositiveInteger(days, 30);
    const startDate = getStartDate(safeDays);

    const appointments = await Appointment.find({
      appointmentDate: {
        $gte: startDate,
      },
      $or: [
        { paymentStatus: "paid" },
        { status: "completed" },
      ],
    })
      .select(
        "appointmentDate finalPrice totalPrice paymentStatus status"
      )
      .sort({ appointmentDate: 1 })
      .lean();

    const revenueByDate = new Map();

    for (let index = 0; index < safeDays; index += 1) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + index);

      const dateKey = currentDate.toISOString().split("T")[0];
      revenueByDate.set(dateKey, 0);
    }

    appointments.forEach((appointment) => {
      if (!appointment.appointmentDate) {
        return;
      }

      const dateKey = new Date(appointment.appointmentDate)
        .toISOString()
        .split("T")[0];

      const currentTotal = revenueByDate.get(dateKey) ?? 0;

      revenueByDate.set(
        dateKey,
        currentTotal + getAppointmentValue(appointment)
      );
    });

    return Array.from(revenueByDate.entries()).map(
      ([date, total]) => ({
        date,
        total: Number(total.toFixed(2)),
      })
    );
  }

  async getRevenueByService(days = 30) {
    const startDate = getStartDate(days);

    return Appointment.aggregate([
      {
        $match: {
          appointmentDate: {
            $gte: startDate,
          },
          service: {
            $ne: null,
          },
          $or: [
            { paymentStatus: "paid" },
            { status: "completed" },
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
        $addFields: {
          calculatedRevenue: {
            $ifNull: [
              "$finalPrice",
              {
                $ifNull: ["$totalPrice", 0],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$serviceDetails.name",
          serviceId: {
            $first: "$serviceDetails._id",
          },
          revenue: {
            $sum: "$calculatedRevenue",
          },
          appointments: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          revenue: -1,
        },
      },
      {
        $project: {
          _id: 1,
          serviceId: 1,
          revenue: {
            $round: ["$revenue", 2],
          },
          appointments: 1,
        },
      },
    ]);
  }

  async getAppointmentsByStatus(days = 30) {
    const startDate = getStartDate(days);

    return Appointment.aggregate([
      {
        $match: {
          appointmentDate: {
            $gte: startDate,
          },
        },
      },
      {
        $group: {
          _id: {
            $ifNull: ["$status", "unknown"],
          },
          count: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
      {
        $project: {
          _id: 1,
          status: "$_id",
          count: 1,
        },
      },
    ]);
  }

  async getTopStylists(days = 30, limit = 10) {
    const startDate = getStartDate(days);
    const safeLimit = normalizePositiveInteger(limit, 10, 25);

    return Appointment.aggregate([
      {
        $match: {
          appointmentDate: {
            $gte: startDate,
          },
          stylist: {
            $ne: null,
          },
          $or: [
            { paymentStatus: "paid" },
            { status: "completed" },
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
          calculatedRevenue: {
            $ifNull: [
              "$finalPrice",
              {
                $ifNull: ["$totalPrice", 0],
              },
            ],
          },
          stylistDisplayName: {
            $ifNull: [
              "$stylistDetails.fullName",
              {
                $ifNull: [
                  "$stylistDetails.name",
                  {
                    $concat: [
                      {
                        $ifNull: ["$stylistDetails.firstName", ""],
                      },
                      " ",
                      {
                        $ifNull: ["$stylistDetails.lastName", ""],
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
          stylist: {
            $first: "$stylistDisplayName",
          },
          appointments: {
            $sum: 1,
          },
          revenue: {
            $sum: "$calculatedRevenue",
          },
        },
      },
      {
        $addFields: {
          averageServiceValue: {
            $cond: [
              { $gt: ["$appointments", 0] },
              {
                $divide: ["$revenue", "$appointments"],
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
          _id: 1,
          stylist: {
            $trim: {
              input: "$stylist",
            },
          },
          appointments: 1,
          revenue: {
            $round: ["$revenue", 2],
          },
          averageServiceValue: {
            $round: ["$averageServiceValue", 2],
          },
        },
      },
    ]);
  }

  async getAlerts() {
    const now = new Date();

    const [
      overdueAppointments,
      pendingAppointments,
    ] = await Promise.all([
      Appointment.countDocuments({
        appointmentDate: {
          $lt: now,
        },
        status: {
          $nin: ["completed", "cancelled"],
        },
      }),
      Appointment.countDocuments({
        status: "pending",
      }),
    ]);

    return {
      overdueAppointments,
      pendingAppointments,
      lowStockProducts: 0,
      unreadNotifications: 0,
    };
  }
}

export default new DashboardService();
