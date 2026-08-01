import Appointment from "../../models/Appointment.js";
import Customer from "../../models/customer.js";
import ScheduledCommunication from "../scheduler/ScheduledCommunication.js";
import {
  buildCustomerContext,
  renderTemplate,
} from "../../shared/templateRenderer.js";
import { addDays } from "../../shared/dateUtils.js";

function recipient(customer, channel) {
  return channel === "email"
    ? customer.email
    : customer.phone ||
        customer.phoneNumber ||
        customer.mobile;
}

export async function dormantCustomers({
  dormantDays = 60,
  limit = 100,
} = {}) {
  const cutoff = addDays(
    new Date(),
    -Math.max(1, Number(dormantDays))
  );

  const recentCustomerIds =
    await Appointment.distinct("customer", {
      appointmentDate: {
        $gte: cutoff,
      },
      status: {
        $nin: ["cancelled", "no_show"],
      },
    });

  return Customer.find({
    _id: {
      $nin: recentCustomerIds,
    },
  })
    .select(
      "firstName lastName fullName name email phone phoneNumber mobile"
    )
    .limit(Math.min(Number(limit) || 100, 1000))
    .lean();
}

export async function queueDormantOutreach({
  dormantDays = 60,
  channel = "email",
  scheduledFor = new Date(),
  subject = "We miss you, {{customer.firstName}}",
  message = "Hi {{customer.firstName}}, we would love to welcome you back to {{salon.name}}. Reply to arrange your next appointment.",
} = {}) {
  const customers = await dormantCustomers({
    dormantDays,
    limit: 1000,
  });

  const jobs = [];

  for (const customer of customers) {
    const target = recipient(customer, channel);

    if (!target) {
      continue;
    }

    const context = buildCustomerContext(customer);

    jobs.push({
      customer: customer._id,
      communicationType: "follow_up",
      channel,
      recipient: target,
      subject: renderTemplate(subject, context),
      message: renderTemplate(message, context),
      scheduledFor: new Date(scheduledFor),
      status: "queued",
      metadata: {
        dormantDays: Number(dormantDays),
      },
    });
  }

  if (!jobs.length) {
    return {
      queued: 0,
      items: [],
    };
  }

  const items =
    await ScheduledCommunication.insertMany(
      jobs,
      {
        ordered: false,
      }
    );

  return {
    queued: items.length,
    items,
  };
}

export async function queuePostAppointmentFollowUps({
  daysAfter = 1,
  channel = "email",
} = {}) {
  const targetStart = addDays(
    new Date(),
    -Number(daysAfter)
  );
  targetStart.setHours(0, 0, 0, 0);

  const targetEnd = new Date(targetStart);
  targetEnd.setHours(23, 59, 59, 999);

  const appointments = await Appointment.find({
    status: "completed",
    appointmentDate: {
      $gte: targetStart,
      $lte: targetEnd,
    },
  })
    .populate(
      "customer",
      "firstName lastName fullName name email phone phoneNumber mobile"
    )
    .populate("service", "name")
    .populate(
      "stylist",
      "name firstName lastName"
    );

  const results = [];

  for (const appointment of appointments) {
    const customer = appointment.customer;
    const target = recipient(customer, channel);

    if (!target) {
      continue;
    }

    const context = buildCustomerContext(
      customer,
      appointment,
      appointment.service,
      appointment.stylist
    );

    const item =
      await ScheduledCommunication.findOneAndUpdate(
        {
          appointment: appointment._id,
          communicationType: "follow_up",
          channel,
        },
        {
          $setOnInsert: {
            customer: customer._id,
            appointment: appointment._id,
            communicationType: "follow_up",
            channel,
            recipient: target,
            subject: "How was your SalonAI visit?",
            message: renderTemplate(
              "Hi {{customer.firstName}}, thank you for visiting {{salon.name}}. We hope you loved your service. Reply if there is anything we can help with.",
              context
            ),
            scheduledFor: new Date(),
            status: "queued",
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      ).lean();

    results.push(item);
  }

  return {
    queued: results.length,
    items: results,
  };
}
