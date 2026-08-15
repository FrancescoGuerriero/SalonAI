import Appointment from "../../models/Appointment.js";
import Customer from "../../models/customer.js";
import CustomerExperienceProfile from "./CustomerExperienceProfile.js";
import {
  objectId,
  text,
} from "./customerExperienceService.js";

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function profileFor(userId) {
  return CustomerExperienceProfile.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId } },
    { new: true, upsert: true, runValidators: true }
  );
}

async function customerFor(user) {
  if (user.customerProfile) {
    return Customer.findById(user.customerProfile);
  }

  return Customer.findOne({
    $or: [
      { userAccount: user._id },
      { email: user.email },
    ],
  });
}

async function ownedAppointment(user, appointmentId) {
  const safeAppointmentId = objectId(
    appointmentId,
    "Appointment"
  );
  const customer = await customerFor(user);

  if (!customer) {
    throw httpError(
      "No salon customer profile is linked to this account.",
      404
    );
  }

  const appointment = await Appointment.findOne({
    _id: safeAppointmentId,
    customer: customer._id,
  });

  if (!appointment) {
    throw httpError(
      "Appointment not found for this account.",
      404
    );
  }

  return appointment;
}

function stringList(value, maximumItems = 12, maximumLength = 80) {
  const rows = Array.isArray(value) ? value : [];

  return [...new Set(
    rows
      .map((entry) => text(entry, maximumLength))
      .filter(Boolean)
  )].slice(0, maximumItems);
}

export async function addExpandedConsultation(req, res) {
  if (req.body.dataProcessingConsent !== true) {
    throw httpError(
      "Consent is required to save consultation details.",
      422
    );
  }

  const desiredOutcome = text(
    req.body.desiredOutcome,
    1500
  );

  if (!desiredOutcome) {
    throw httpError(
      "Tell the salon what result you would like.",
      422
    );
  }

  let appointment = null;

  if (req.body.appointmentId) {
    appointment = await ownedAppointment(
      req.user,
      req.body.appointmentId
    );
  }

  const profile = await profileFor(
    req.user._id
  );

  profile.consultations.unshift({
    appointment: appointment?._id || null,

    hairType: text(req.body.hairType, 80),
    texturePattern: text(req.body.texturePattern, 80),
    density: text(req.body.density, 60),
    strandThickness: text(req.body.strandThickness, 60),
    length: text(req.body.length, 80),
    porosity: text(req.body.porosity, 60),
    scalpCondition: text(req.body.scalpCondition, 250),
    hairCondition: text(req.body.hairCondition, 500),

    naturalColour: text(req.body.naturalColour, 100),
    currentColour: text(req.body.currentColour, 100),
    greyPercentage: text(req.body.greyPercentage, 50),
    colourHistory: text(req.body.colourHistory, 1500),
    bleachHistory: text(req.body.bleachHistory, 1000),
    previousTreatments: text(req.body.previousTreatments, 1500),

    washFrequency: text(req.body.washFrequency, 100),
    heatStylingFrequency: text(req.body.heatStylingFrequency, 100),
    homeCareRoutine: text(req.body.homeCareRoutine, 1500),
    currentProducts: text(req.body.currentProducts, 1500),
    lifestyleExposure: text(req.body.lifestyleExposure, 750),
    concerns: stringList(req.body.concerns),

    desiredOutcome,
    maintenancePreference: text(req.body.maintenancePreference, 250),
    budgetRange: text(req.body.budgetRange, 100),
    upcomingEvent: text(req.body.upcomingEvent, 500),
    inspirationNotes: text(req.body.inspirationNotes, 1000),

    sensitivities: text(req.body.sensitivities, 1000),
    patchTestRequired: Boolean(req.body.patchTestRequired),
    safetyNotes: text(req.body.safetyNotes, 1000),
    notes: text(req.body.notes, 1500),
    dataProcessingConsent: true,
  });

  await profile.save();

  return res.status(201).json({
    success: true,
    message: "Your consultation has been saved securely.",
    consultation: profile.consultations[0],
  });
}
