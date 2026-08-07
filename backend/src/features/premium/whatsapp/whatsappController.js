import mongoose from "mongoose";
import twilio from "twilio";

import Appointment from "../../../models/Appointment.js";
import Customer from "../../../models/customer.js";
import Service from "../../../models/service.js";
import Stylist from "../../../models/Stylist.js";
import {
  findConflict,
} from "../../appointments/appointmentManagementService.js";
import {
  assertAppointmentWithinStaffAvailability,
} from "../../staff/staffService.js";
import {
  parseBookingDate,
  stylistOffersService,
} from "../../../services/bookingAvailabilityService.js";
import { sendWhatsApp } from "../../../providers/whatsappProvider.js";
import WhatsAppConversation from "./WhatsAppConversation.js";
import {
  buildBookingConfirmationMessage,
  normaliseIncomingWhatsApp,
  splitCustomerName,
  validateBookingSessionInput,
} from "./whatsappService.js";

const CONVERSATION_STATUSES = new Set([
  "open",
  "collecting_details",
  "awaiting_confirmation",
  "confirming",
  "booked",
  "completed",
  "closed",
  "failed",
]);

function createHttpError(message, statusCode = 500, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  error.details = details;
  return error;
}

function assertConversationId(value) {
  if (!mongoose.isValidObjectId(value)) {
    throw createHttpError(
      "The WhatsApp conversation identifier is invalid.",
      400,
      { field: "conversationId" }
    );
  }

  return value;
}

function escapeRegularExpression(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function providerMode() {
  return String(process.env.WHATSAPP_PROVIDER_MODE || "console").toLowerCase();
}

function publicWebhookUrl(request) {
  if (process.env.WHATSAPP_WEBHOOK_URL) {
    return process.env.WHATSAPP_WEBHOOK_URL;
  }

  if (process.env.TWILIO_WEBHOOK_BASE_URL) {
    return `${String(process.env.TWILIO_WEBHOOK_BASE_URL).replace(/\/+$/, "")}${
      request.originalUrl.startsWith("/") ? "" : "/"
    }${request.originalUrl}`;
  }

  const forwardedProtocol = String(
    request.headers["x-forwarded-proto"] || request.protocol || "https"
  ).split(",")[0].trim();

  return `${forwardedProtocol}://${request.get("host")}${request.originalUrl}`;
}

function verifyWebhookRequest(request) {
  if (!["twilio", "live"].includes(providerMode())) {
    return true;
  }

  const signature = String(request.headers["x-twilio-signature"] || "");
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || "");

  if (!signature || !authToken) {
    return false;
  }

  return twilio.validateRequest(
    authToken,
    signature,
    publicWebhookUrl(request),
    request.body || {}
  );
}

function combineBookingDateAndTime(dateValue, timeValue) {
  const date = parseBookingDate(dateValue);
  const [hours, minutes] = String(timeValue).split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function stylistName(stylist = {}) {
  return [stylist.firstName, stylist.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

async function populateConversation(conversationId) {
  return WhatsAppConversation.findById(conversationId)
    .populate("customer", "firstName lastName preferredName phone email")
    .populate("assignedTo", "name email role")
    .populate("bookingSession.serviceId", "name category price duration")
    .populate(
      "bookingSession.stylistId",
      "firstName lastName profileImage specialties rating"
    )
    .populate(
      "bookingSession.appointmentId",
      "appointmentDate appointmentTime startsAt endsAt status totalPrice"
    )
    .lean();
}

async function bookingResources(input) {
  const { serviceId, stylistId, appointmentDate, appointmentTime } =
    validateBookingSessionInput(input);

  if (!mongoose.isValidObjectId(serviceId)) {
    throw createHttpError("The service identifier is invalid.", 400, {
      field: "serviceId",
    });
  }

  if (!mongoose.isValidObjectId(stylistId)) {
    throw createHttpError("The stylist identifier is invalid.", 400, {
      field: "stylistId",
    });
  }

  const [service, stylist] = await Promise.all([
    Service.findOne({ _id: serviceId, active: { $ne: false } }),
    Stylist.findOne({ _id: stylistId, isActive: { $ne: false } }),
  ]);

  if (!service) {
    throw createHttpError("The selected service was not found or is inactive.", 404);
  }

  if (!stylist) {
    throw createHttpError("The selected stylist was not found or is inactive.", 404);
  }

  if (!stylistOffersService(stylist, service._id)) {
    throw createHttpError("The selected stylist does not offer this service.", 409, {
      field: "serviceId",
    });
  }

  const startsAt = combineBookingDateAndTime(appointmentDate, appointmentTime);
  const duration = Math.max(1, Math.min(1440, Number(service.duration) || 60));
  const endsAt = new Date(startsAt.getTime() + duration * 60_000);

  if (startsAt <= new Date()) {
    throw createHttpError("The appointment date and time must be in the future.", 409, {
      field: "appointmentDate",
    });
  }

  await assertAppointmentWithinStaffAvailability(stylist._id, startsAt, endsAt);

  const conflict = await findConflict({
    stylist: stylist._id,
    start: startsAt,
    end: endsAt,
  });

  if (conflict) {
    throw createHttpError(
      "The selected stylist already has an overlapping appointment.",
      409,
      { conflict }
    );
  }

  return {
    service,
    stylist,
    startsAt,
    endsAt,
    duration,
    appointmentDate,
    appointmentTime,
  };
}

async function resolveWhatsAppCustomer(conversation, actorId) {
  let customer = conversation.customer
    ? await Customer.findById(conversation.customer)
    : await Customer.findOne({
        $or: [
          { phone: conversation.phone },
          { alternativePhone: conversation.phone },
        ],
      });

  if (!customer) {
    const name = splitCustomerName(conversation.displayName);
    customer = await Customer.create({
      ...name,
      phone: conversation.phone,
      source: "booking",
      communicationPreferences: {
        preferredChannel: "whatsapp",
      },
      createdBy: actorId,
      updatedBy: actorId,
    });
  }

  if (!conversation.customer) {
    conversation.customer = customer._id;
  }

  return customer;
}

export async function listConversations(request, response) {
  const page = Math.max(1, Number(request.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
  const status = String(request.query.status || "").trim();
  const search = String(request.query.search || "").trim();
  const filter = {};

  if (status && status !== "all") {
    if (!CONVERSATION_STATUSES.has(status)) {
      throw createHttpError("The WhatsApp status filter is invalid.", 400, {
        field: "status",
      });
    }
    filter.status = status;
  }

  if (search) {
    const expression = new RegExp(escapeRegularExpression(search), "i");
    filter.$or = [
      { displayName: expression },
      { phone: expression },
      { lastMessagePreview: expression },
    ];
  }

  const [conversations, total, open, awaitingConfirmation, booked, unread] =
    await Promise.all([
      WhatsAppConversation.find(filter)
        .select("-messages")
        .populate("customer", "firstName lastName preferredName phone")
        .populate("bookingSession.serviceId", "name price duration")
        .populate("bookingSession.stylistId", "firstName lastName")
        .sort({ lastMessageAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      WhatsAppConversation.countDocuments(filter),
      WhatsAppConversation.countDocuments({
        status: { $in: ["open", "collecting_details"] },
      }),
      WhatsAppConversation.countDocuments({ status: "awaiting_confirmation" }),
      WhatsAppConversation.countDocuments({ status: "booked" }),
      WhatsAppConversation.countDocuments({ unreadCount: { $gt: 0 } }),
    ]);

  return response.json({
    success: true,
    conversations,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    summary: {
      open,
      awaitingConfirmation,
      booked,
      unread,
    },
  });
}

export async function getConversation(request, response) {
  const conversation = await populateConversation(
    assertConversationId(request.params.conversationId)
  );

  if (!conversation) {
    throw createHttpError("WhatsApp conversation not found.", 404);
  }

  return response.json({
    success: true,
    conversation,
  });
}

export async function webhook(request, response) {
  if (!verifyWebhookRequest(request)) {
    throw createHttpError("The WhatsApp webhook signature is invalid.", 403);
  }

  const incoming = normaliseIncomingWhatsApp(request.body);

  if (incoming.providerMessageId) {
    const duplicate = await WhatsAppConversation.findOne({
      "messages.providerMessageId": incoming.providerMessageId,
    }).select("_id");

    if (duplicate) {
      return response.json({
        success: true,
        duplicate: true,
        conversationId: duplicate._id,
      });
    }
  }

  const now = new Date();
  const conversation = await WhatsAppConversation.findOneAndUpdate(
    { phone: incoming.phone },
    {
      $set: {
        ...(incoming.displayName ? { displayName: incoming.displayName } : {}),
        lastMessageAt: now,
        lastInboundAt: now,
        lastMessagePreview: incoming.message.slice(0, 240),
        status: "open",
      },
      $inc: { unreadCount: 1 },
      $push: {
        messages: {
          direction: "inbound",
          body: incoming.message,
          providerMessageId: incoming.providerMessageId,
          providerStatus: "received",
          sentAt: now,
        },
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  return response.json({
    success: true,
    duplicate: false,
    conversationId: conversation._id,
  });
}

export async function updateBookingSession(request, response) {
  const conversationId = assertConversationId(request.params.conversationId);
  const resources = await bookingResources(request.body);
  const displayName = String(request.body?.displayName || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);

  const conversation = await WhatsAppConversation.findByIdAndUpdate(
    conversationId,
    {
      $set: {
        ...(displayName ? { displayName } : {}),
        assignedTo: request.user._id,
        status: "awaiting_confirmation",
        "bookingSession.stage": "review",
        "bookingSession.serviceId": resources.service._id,
        "bookingSession.stylistId": resources.stylist._id,
        "bookingSession.appointmentDate": resources.startsAt,
        "bookingSession.appointmentTime": resources.appointmentTime,
        "bookingSession.duration": resources.duration,
        "bookingSession.price": Math.max(0, Number(resources.service.price) || 0),
        "bookingSession.availableSlots": [],
        "bookingSession.confirmed": false,
        "bookingSession.confirmationState": "pending",
        "bookingSession.expiresAt": new Date(Date.now() + 30 * 60_000),
      },
    },
    { new: true, runValidators: true }
  );

  if (!conversation) {
    throw createHttpError("WhatsApp conversation not found.", 404);
  }

  return response.json({
    success: true,
    message: "WhatsApp booking details are ready for confirmation.",
    conversation: await populateConversation(conversation._id),
  });
}

export async function confirmBooking(request, response) {
  const conversationId = assertConversationId(request.params.conversationId);
  const externalBookingReference = `whatsapp:${conversationId}`;
  let conversation = await WhatsAppConversation.findById(conversationId);

  if (!conversation) {
    throw createHttpError("WhatsApp conversation not found.", 404);
  }

  if (conversation.bookingSession?.appointmentId) {
    return response.json({
      success: true,
      duplicate: true,
      message: "This WhatsApp booking was already confirmed.",
      conversation: await populateConversation(conversation._id),
    });
  }

  const recoveredAppointment = await Appointment.findOne({
    externalBookingReference,
  }).select("_id customer");

  if (recoveredAppointment) {
    conversation.customer = recoveredAppointment.customer;
    conversation.status = "booked";
    conversation.bookingSession.stage = "confirmed";
    conversation.bookingSession.appointmentId = recoveredAppointment._id;
    conversation.bookingSession.confirmed = true;
    conversation.bookingSession.confirmationState = "completed";
    conversation.bookingSession.confirmedAt =
      conversation.bookingSession.confirmedAt || new Date();
    conversation.bookingSession.confirmedBy = request.user._id;
    await conversation.save();

    return response.json({
      success: true,
      duplicate: true,
      message: "This WhatsApp appointment already exists and its conversation was recovered.",
      conversation: await populateConversation(conversation._id),
    });
  }

  const locked = await WhatsAppConversation.findOneAndUpdate(
    {
      _id: conversationId,
      "bookingSession.appointmentId": null,
      "bookingSession.confirmationState": { $ne: "processing" },
    },
    {
      $set: {
        status: "confirming",
        assignedTo: request.user._id,
        "bookingSession.confirmationState": "processing",
      },
    },
    { new: true }
  );

  if (!locked) {
    throw createHttpError(
      "This WhatsApp booking is already being confirmed. Refresh before trying again.",
      409
    );
  }

  conversation = locked;

  try {
    const resources = await bookingResources({
      serviceId: conversation.bookingSession.serviceId,
      stylistId: conversation.bookingSession.stylistId,
      appointmentDate: conversation.bookingSession.appointmentDate
        ? new Date(conversation.bookingSession.appointmentDate)
            .toISOString()
            .slice(0, 10)
        : "",
      appointmentTime: conversation.bookingSession.appointmentTime,
    });
    const customer = await resolveWhatsAppCustomer(conversation, request.user._id);
    const totalPrice = Math.max(0, Number(resources.service.price) || 0);
    const appointment = await Appointment.create({
      customer: customer._id,
      service: resources.service._id,
      stylist: resources.stylist._id,
      appointmentDate: resources.startsAt,
      appointmentTime: resources.appointmentTime,
      startsAt: resources.startsAt,
      endsAt: resources.endsAt,
      duration: resources.duration,
      totalPrice,
      finalPrice: totalPrice,
      balanceDue: totalPrice,
      paymentStatus: "pending",
      status: "confirmed",
      bookingSource: "whatsapp",
      externalBookingReference,
      notes: "Booking received through WhatsApp and confirmed by the salon team.",
      createdBy: request.user._id,
      updatedBy: request.user._id,
    });

    if (!customer.nextAppointment || resources.startsAt < customer.nextAppointment) {
      customer.nextAppointment = resources.startsAt;
      customer.updatedBy = request.user._id;
      await customer.save();
    }

    const confirmationText = buildBookingConfirmationMessage({
      serviceName: resources.service.name,
      stylistName: stylistName(resources.stylist),
      appointmentDate: resources.startsAt,
      appointmentTime: resources.appointmentTime,
    });

    let delivery;
    try {
      delivery = await sendWhatsApp({
        to: conversation.phone,
        message: confirmationText,
      });
    } catch (deliveryError) {
      delivery = {
        status: "failed",
        messageId: "",
        error: deliveryError.message,
      };
    }

    const now = new Date();
    conversation.customer = customer._id;
    conversation.status = "booked";
    conversation.bookingSession.stage = "confirmed";
    conversation.bookingSession.appointmentId = appointment._id;
    conversation.bookingSession.confirmed = true;
    conversation.bookingSession.confirmationState = "completed";
    conversation.bookingSession.confirmedAt = now;
    conversation.bookingSession.confirmedBy = request.user._id;
    conversation.lastMessageAt = now;
    conversation.lastOutboundAt = now;
    conversation.lastMessagePreview = confirmationText.slice(0, 240);
    conversation.messages.push({
      direction: "outbound",
      body: confirmationText,
      providerMessageId: delivery.messageId || "",
      providerStatus: delivery.status || "sent",
      error: delivery.error || "",
      sentAt: now,
    });
    await conversation.save();

    return response.status(201).json({
      success: true,
      duplicate: false,
      message:
        delivery.status === "failed"
          ? "The appointment was created, but the WhatsApp confirmation could not be delivered."
          : "The WhatsApp appointment was created and the confirmation was sent.",
      delivery,
      appointmentId: appointment._id,
      conversation: await populateConversation(conversation._id),
    });
  } catch (error) {
    await WhatsAppConversation.findByIdAndUpdate(conversationId, {
      $set: {
        status: "failed",
        "bookingSession.confirmationState": "failed",
      },
    });
    throw error;
  }
}

export async function sendConversationMessage(request, response) {
  const conversationId = assertConversationId(request.params.conversationId);
  const body = String(request.body?.body || "").trim().replace(/\s+/g, " ");

  if (!body || body.length > 4096) {
    throw createHttpError(
      "A WhatsApp message between 1 and 4096 characters is required.",
      400,
      { field: "body" }
    );
  }

  const conversation = await WhatsAppConversation.findById(conversationId);

  if (!conversation) {
    throw createHttpError("WhatsApp conversation not found.", 404);
  }

  const delivery = await sendWhatsApp({
    to: conversation.phone,
    message: body,
  });
  const now = new Date();

  conversation.assignedTo = request.user._id;
  conversation.lastMessageAt = now;
  conversation.lastOutboundAt = now;
  conversation.lastMessagePreview = body.slice(0, 240);
  conversation.messages.push({
    direction: "outbound",
    body,
    providerMessageId: delivery.messageId || "",
    providerStatus: delivery.status || "sent",
    sentAt: now,
  });
  await conversation.save();

  return response.status(201).json({
    success: true,
    delivery,
    conversation: await populateConversation(conversation._id),
  });
}

export async function markConversationRead(request, response) {
  const conversation = await WhatsAppConversation.findByIdAndUpdate(
    assertConversationId(request.params.conversationId),
    {
      $set: {
        unreadCount: 0,
        assignedTo: request.user._id,
      },
    },
    { new: true }
  );

  if (!conversation) {
    throw createHttpError("WhatsApp conversation not found.", 404);
  }

  return response.json({ success: true });
}

export async function updateConversationStatus(request, response) {
  const status = String(request.body?.status || "").trim();

  if (!CONVERSATION_STATUSES.has(status)) {
    throw createHttpError("The WhatsApp conversation status is invalid.", 400, {
      field: "status",
    });
  }

  const conversation = await WhatsAppConversation.findByIdAndUpdate(
    assertConversationId(request.params.conversationId),
    {
      $set: {
        status,
        assignedTo: request.user._id,
        closedAt: status === "closed" ? new Date() : null,
      },
    },
    { new: true, runValidators: true }
  );

  if (!conversation) {
    throw createHttpError("WhatsApp conversation not found.", 404);
  }

  return response.json({
    success: true,
    conversation: await populateConversation(conversation._id),
  });
}

export default {
  confirmBooking,
  getConversation,
  listConversations,
  markConversationRead,
  sendConversationMessage,
  updateBookingSession,
  updateConversationStatus,
  webhook,
};
