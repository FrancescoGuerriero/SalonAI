import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import Customer from "../../models/customer.js";
import Service from "../../models/service.js";
import {
  createManagedAppointment,
} from "../appointments/appointmentManagementService.js";
import {
  notifyAppointmentConfirmed,
  notifySafely,
} from "../appointments/appointmentNotificationService.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import ServiceTrial from "./ServiceTrial.js";
import ServiceTrialBooking from "./ServiceTrialBooking.js";
import ServiceTrialEligibility from "./ServiceTrialEligibility.js";

function text(value) {
  return String(value ?? "").trim();
}

function actorId(actor) {
  const value = actor?._id || actor?.id || actor || null;
  return mongoose.isValidObjectId(value) ? value : null;
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, {
      field,
    });
  }
  return value;
}

function number(value, fallback, { min = null, max = null } = {}) {
  const parsed = Number(value);
  let result = Number.isFinite(parsed) ? parsed : fallback;
  if (min !== null) result = Math.max(min, result);
  if (max !== null) result = Math.min(max, result);
  return result;
}

function integer(value, fallback, options = {}) {
  return Math.round(number(value, fallback, options));
}

function dateOrNull(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createServiceError(`${field} must be a valid date.`, 400, { field });
  }
  return parsed;
}

function serviceIsGloballyBookable(service) {
  if (!service || service.active === false) return false;
  return typeof service.bookable === "boolean"
    ? service.bookable
    : service.onlineBookable !== false;
}

async function assertBookableService(serviceId, session = null) {
  objectId(serviceId, "service");

  let query = Service.findById(serviceId).select("+onlineBookable");
  if (session) query = query.session(session);
  const service = await query.lean();

  if (!service) {
    throw createServiceError("Service not found.", 404, { field: "service" });
  }

  if (!serviceIsGloballyBookable(service)) {
    throw createServiceError(
      "A service trial can only target an active, globally bookable service.",
      409,
      { field: "service" }
    );
  }

  return service;
}

function definitionValues(payload = {}, existing = null) {
  const values = {
    service: payload.service ?? existing?.service,
    name: text(payload.name ?? existing?.name),
    description: text(payload.description ?? existing?.description),
    trialPrice: number(payload.trialPrice, existing?.trialPrice ?? 0, { min: 0 }),
    trialDuration: integer(payload.trialDuration, existing?.trialDuration ?? 60, {
      min: 1,
      max: 1440,
    }),
    maxUsesPerCustomer: integer(
      payload.maxUsesPerCustomer,
      existing?.maxUsesPerCustomer ?? 1,
      { min: 1, max: 10 }
    ),
    cooldownDays: integer(payload.cooldownDays, existing?.cooldownDays ?? 0, {
      min: 0,
      max: 3650,
    }),
    conversionWindowDays: integer(
      payload.conversionWindowDays,
      existing?.conversionWindowDays ?? 90,
      { min: 1, max: 3650 }
    ),
    validFrom:
      payload.validFrom !== undefined
        ? dateOrNull(payload.validFrom, "validFrom")
        : existing?.validFrom ?? null,
    validUntil:
      payload.validUntil !== undefined
        ? dateOrNull(payload.validUntil, "validUntil")
        : existing?.validUntil ?? null,
    active:
      payload.active !== undefined ? Boolean(payload.active) : existing?.active ?? true,
    published:
      payload.published !== undefined
        ? Boolean(payload.published)
        : existing?.published ?? false,
  };

  if (!values.name) {
    throw createServiceError("Trial name is required.", 400, { field: "name" });
  }

  if (values.validFrom && values.validUntil && values.validUntil < values.validFrom) {
    throw createServiceError(
      "Trial valid-until date cannot precede valid-from date.",
      400,
      { field: "validUntil" }
    );
  }

  return values;
}

export async function listServiceTrials({ includeInactive = "true" } = {}) {
  const filter =
    String(includeInactive).toLowerCase() === "false"
      ? { active: true }
      : {};

  return ServiceTrial.find(filter)
    .populate("service", "name category price duration active bookable published")
    .sort({ active: -1, name: 1, _id: 1 })
    .lean();
}

export async function createServiceTrial(payload = {}, { actor = null } = {}) {
  const values = definitionValues(payload);
  await assertBookableService(values.service);

  return ServiceTrial.create({
    ...values,
    createdBy: actorId(actor),
    updatedBy: actorId(actor),
  });
}

export async function updateServiceTrial(
  trialId,
  payload = {},
  { actor = null } = {}
) {
  objectId(trialId, "trialId");
  const definition = assertFound(
    await ServiceTrial.findById(trialId),
    "Service trial not found."
  );
  const values = definitionValues(payload, definition);

  await assertBookableService(values.service);

  Object.assign(definition, values, {
    updatedBy: actorId(actor),
  });
  await definition.save();

  return ServiceTrial.findById(definition._id)
    .populate("service", "name category price duration active bookable published")
    .lean();
}

async function activeDefinition(trialId, session) {
  objectId(trialId, "trial");

  let query = ServiceTrial.findById(trialId);
  if (session) query = query.session(session);
  const definition = assertFound(await query, "Service trial not found.");

  if (!definition.active) {
    throw createServiceError("This service trial is inactive.", 409, {
      field: "trial",
    });
  }

  const now = new Date();
  if (definition.validFrom && now < definition.validFrom) {
    throw createServiceError("This service trial is not active yet.", 409, {
      field: "trial",
    });
  }
  if (definition.validUntil && now > definition.validUntil) {
    throw createServiceError("This service trial has expired.", 409, {
      field: "trial",
    });
  }

  await assertBookableService(definition.service, session);

  return definition;
}

async function claimEligibility(definition, customer, session) {
  const now = new Date();
  const filter = {
    trial: definition._id,
    customer,
    bookingsClaimed: { $lt: definition.maxUsesPerCustomer },
  };

  if (definition.cooldownDays > 0) {
    const threshold = new Date(
      now.getTime() - definition.cooldownDays * 86_400_000
    );
    filter.$or = [
      { lastBookedAt: null },
      { lastBookedAt: { $lte: threshold } },
    ];
  }

  try {
    const ledger = await ServiceTrialEligibility.findOneAndUpdate(
      filter,
      {
        $inc: { bookingsClaimed: 1 },
        $set: { lastBookedAt: now },
        $setOnInsert: {
          trial: definition._id,
          customer,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        session,
      }
    );

    if (!ledger) {
      throw createServiceError(
        "This customer is not currently eligible for another use of this trial.",
        409,
        { field: "customer" }
      );
    }

    return ledger;
  } catch (error) {
    if (Number(error?.code) === 11000) {
      throw createServiceError(
        "This customer is not currently eligible for another use of this trial.",
        409,
        { field: "customer" }
      );
    }
    throw error;
  }
}

export async function bookServiceTrial(payload = {}, { actor = null } = {}) {
  const customer = objectId(payload.customer, "customer");
  const trialId = objectId(payload.trial, "trial");
  const session = await mongoose.startSession();
  let bookingId = null;
  let appointmentId = null;

  try {
    await session.withTransaction(async () => {
      let customerQuery = Customer.findById(customer).select("_id status");
      customerQuery = customerQuery.session(session);
      const customerRecord = await customerQuery.lean();

      if (!customerRecord || customerRecord.status === "deleted") {
        throw createServiceError("Customer not found.", 404, {
          field: "customer",
        });
      }

      const definition = await activeDefinition(trialId, session);
      await claimEligibility(definition, customer, session);

      const appointment = await createManagedAppointment(
        {
          customer,
          stylist: payload.stylist,
          service: definition.service,
          startsAt: payload.startsAt,
          appointmentDate: payload.appointmentDate,
          appointmentTime: payload.appointmentTime,
          duration: definition.trialDuration,
          totalPrice: definition.trialPrice,
          status: payload.status || "pending",
          notes: text(payload.notes),
          internalNotes: text(payload.internalNotes),
        },
        {
          actor,
          session,
          bookingSource: "management",
          returnPopulated: false,
        }
      );

      appointmentId = appointment._id;

      const [booking] = await ServiceTrialBooking.create(
        [
          {
            trial: definition._id,
            customer,
            appointment: appointment._id,
            priceSnapshot: definition.trialPrice,
            durationSnapshot: definition.trialDuration,
            maxUsesSnapshot: definition.maxUsesPerCustomer,
            cooldownDaysSnapshot: definition.cooldownDays,
            conversionWindowDaysSnapshot: definition.conversionWindowDays,
            createdBy: actorId(actor),
          },
        ],
        { session }
      );

      bookingId = booking._id;
    });
  } finally {
    await session.endSession();
  }

  if (appointmentId) {
    await notifySafely(
      () =>
        notifyAppointmentConfirmed(appointmentId, {
          actorId: actorId(actor),
        }),
      {
        event: "appointment.created",
        appointmentId: String(appointmentId),
        source: "service_trial",
      }
    );
  }

  return getServiceTrialBooking(bookingId);
}

const BOOKING_POPULATE = [
  {
    path: "trial",
    populate: {
      path: "service",
      select: "name category price duration active bookable published",
    },
  },
  {
    path: "customer",
    select: "firstName lastName fullName preferredName name email phone status",
  },
  {
    path: "appointment",
    select:
      "customer service stylist appointmentDate appointmentTime startsAt endsAt duration status totalPrice finalPrice paymentStatus bookingSource",
    populate: [
      { path: "service", select: "name category duration price" },
      {
        path: "stylist",
        select: "name firstName lastName title jobTitle isActive acceptsAppointments",
      },
    ],
  },
  {
    path: "convertedAppointment",
    select:
      "customer service stylist appointmentDate appointmentTime startsAt endsAt duration status totalPrice finalPrice paymentStatus bookingSource",
    populate: [
      { path: "service", select: "name category duration price" },
      { path: "stylist", select: "name firstName lastName" },
    ],
  },
];

export async function getServiceTrialBooking(bookingId) {
  objectId(bookingId, "bookingId");

  return assertFound(
    await ServiceTrialBooking.findById(bookingId)
      .populate(BOOKING_POPULATE)
      .lean(),
    "Service trial booking not found."
  );
}

export async function listServiceTrialBookings({ customer, trial, limit = 200 } = {}) {
  const filter = {};
  if (customer) filter.customer = objectId(customer, "customer");
  if (trial) filter.trial = objectId(trial, "trial");

  return ServiceTrialBooking.find(filter)
    .populate(BOOKING_POPULATE)
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.min(Math.max(Number(limit) || 200, 1), 500))
    .lean();
}

export async function recordServiceTrialConversion(
  bookingId,
  payload = {},
  { actor = null } = {}
) {
  objectId(bookingId, "bookingId");
  const convertedAppointmentId = objectId(
    payload.appointment || payload.convertedAppointment,
    "appointment"
  );

  const booking = assertFound(
    await ServiceTrialBooking.findById(bookingId),
    "Service trial booking not found."
  );

  if (booking.convertedAppointment) {
    if (String(booking.convertedAppointment) === String(convertedAppointmentId)) {
      return getServiceTrialBooking(booking._id);
    }
    throw createServiceError(
      "This trial booking already has a recorded conversion.",
      409,
      { field: "appointment" }
    );
  }

  if (String(booking.appointment) === String(convertedAppointmentId)) {
    throw createServiceError(
      "The trial appointment cannot be its own conversion.",
      400,
      { field: "appointment" }
    );
  }

  const [trialAppointment, candidate, anotherTrial] = await Promise.all([
    Appointment.findById(booking.appointment).lean(),
    Appointment.findById(convertedAppointmentId).lean(),
    ServiceTrialBooking.findOne({
      appointment: convertedAppointmentId,
      _id: { $ne: booking._id },
    }).lean(),
  ]);

  assertFound(trialAppointment, "Trial appointment not found.");
  assertFound(candidate, "Conversion appointment not found.");

  if (anotherTrial) {
    throw createServiceError(
      "Another discounted trial appointment cannot be recorded as a conversion.",
      409,
      { field: "appointment" }
    );
  }

  if (
    String(candidate.customer) !== String(booking.customer) ||
    String(candidate.service) !== String(trialAppointment.service)
  ) {
    throw createServiceError(
      "A conversion must be a later canonical appointment for the same customer and service.",
      409,
      { field: "appointment" }
    );
  }

  if (["cancelled", "no_show"].includes(candidate.status)) {
    throw createServiceError(
      "A cancelled or no-show appointment cannot be recorded as a conversion.",
      409,
      { field: "appointment" }
    );
  }

  const trialStart = new Date(
    trialAppointment.startsAt || trialAppointment.appointmentDate
  );
  const candidateStart = new Date(candidate.startsAt || candidate.appointmentDate);
  const conversionDeadline = new Date(
    trialStart.getTime() + booking.conversionWindowDaysSnapshot * 86_400_000
  );

  if (
    Number.isNaN(trialStart.getTime()) ||
    Number.isNaN(candidateStart.getTime()) ||
    candidateStart <= trialStart ||
    candidateStart > conversionDeadline
  ) {
    throw createServiceError(
      "The conversion appointment must occur after the trial and within its conversion window.",
      409,
      { field: "appointment" }
    );
  }

  booking.convertedAppointment = convertedAppointmentId;
  booking.convertedAt = new Date();
  booking.conversionRecordedBy = actorId(actor);
  await booking.save();

  return getServiceTrialBooking(booking._id);
}
