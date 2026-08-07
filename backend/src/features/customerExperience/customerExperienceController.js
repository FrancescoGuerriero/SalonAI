import Appointment from "../../models/Appointment.js";
import Customer from "../../models/customer.js";
import GiftCard from "../premium/giftCards/GiftCard.js";
import LoyaltyAccount from "../premium/loyalty/LoyaltyAccount.js";
import Notification from "../premium/notifications/Notification.js";
import Referral from "../premium/referrals/Referral.js";
import { hashValue } from "../premium/premiumUtils.js";
import {
  changeAppointmentStatus,
  rescheduleAppointment,
} from "../appointments/appointmentManagementService.js";
import CustomerExperienceProfile from "./CustomerExperienceProfile.js";
import SalonOffer from "./SalonOffer.js";
import {
  integer,
  normaliseDiscovery,
  normaliseOffer,
  objectId,
  safeHttpsUrl,
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
  if (user.customerProfile) return Customer.findById(user.customerProfile);
  return Customer.findOne({ $or: [{ userAccount: user._id }, { email: user.email }] });
}

async function ownedAppointment(user, appointmentId) {
  objectId(appointmentId, "Appointment");
  const customer = await customerFor(user);
  if (!customer) throw httpError("No salon customer profile is linked to this account.", 404);
  const appointment = await Appointment.findOne({ _id: appointmentId, customer: customer._id });
  if (!appointment) throw httpError("Appointment not found for this account.", 404);
  return appointment;
}

function activeOfferQuery(now = new Date()) {
  return {
    active: true,
    startsAt: { $lte: now },
    endsAt: { $gt: now },
    $expr: {
      $or: [
        { $eq: ["$maxClaims", null] },
        { $lt: ["$claimCount", "$maxClaims"] },
      ],
    },
  };
}

function publicGiftCard(card) {
  return card ? {
    id: card._id,
    codeLastFour: card.codeLastFour,
    originalValue: card.originalValue,
    balance: card.balance,
    currency: card.currency,
    status: card.status,
    expiresAt: card.expiresAt,
  } : null;
}

export async function getCustomerExperience(req, res) {
  const profile = await profileFor(req.user._id);
  await profile.populate([
    { path: "reviews.appointment", select: "startsAt appointmentDate appointmentTime status", populate: { path: "service", select: "name" } },
    { path: "appointmentRequests.appointment", select: "startsAt appointmentDate appointmentTime status", populate: { path: "service", select: "name" } },
    { path: "claimedOffers.offer", select: "title description discountType value minimumSpend endsAt active" },
    { path: "walletCards.giftCard", select: "codeLastFour originalValue balance currency status expiresAt" },
  ]);

  const [loyalty, referrals, inbox, offers] = await Promise.all([
    LoyaltyAccount.findOne({ customer: req.user._id }).lean(),
    Referral.find({ referrer: req.user._id }).sort({ createdAt: -1 }).limit(50).lean(),
    Notification.find({ customer: req.user._id }).sort({ createdAt: -1 }).limit(100).lean(),
    SalonOffer.find(activeOfferQuery()).sort({ endsAt: 1 }).lean(),
  ]);

  const result = profile.toObject();
  result.walletCards = result.walletCards.map((entry) => ({
    id: entry._id,
    label: entry.label,
    addedAt: entry.addedAt,
    giftCard: publicGiftCard(entry.giftCard),
  }));

  return res.json({
    success: true,
    profile: result,
    loyalty: loyalty || { pointsBalance: 0, lifetimePointsEarned: 0, tier: "bronze", transactions: [] },
    referrals,
    inbox,
    offers,
  });
}

export async function updateConsents(req, res) {
  const profile = await profileFor(req.user._id);
  profile.consents.analytics = Boolean(req.body.analytics);
  profile.consents.personalisation = Boolean(req.body.personalisation);
  profile.consents.marketing = Boolean(req.body.marketing);
  profile.consents.updatedAt = new Date();
  await profile.save();
  return res.json({ success: true, consents: profile.consents });
}

export async function addReview(req, res) {
  const appointment = await ownedAppointment(req.user, req.body.appointmentId);
  if (String(appointment.status).toLowerCase() !== "completed") {
    throw httpError("Reviews can be submitted after a completed appointment.", 409);
  }
  const profile = await profileFor(req.user._id);
  if (profile.reviews.some((review) => String(review.appointment) === String(appointment._id))) {
    throw httpError("This appointment has already been reviewed.", 409);
  }
  profile.reviews.unshift({
    appointment: appointment._id,
    rating: integer(req.body.rating, 1, 5, "Rating"),
    title: text(req.body.title, 100),
    comment: text(req.body.comment, 1500),
  });
  if (!profile.reviews[0].comment) throw httpError("Review comments are required.", 422);
  await profile.save();
  return res.status(201).json({ success: true, review: profile.reviews[0] });
}

export async function addFavourite(req, res) {
  const kind = text(req.body.kind, 20).toLowerCase();
  if (!["service", "stylist", "product"].includes(kind)) throw httpError("Favourite type is invalid.", 422);
  const referenceId = text(req.body.referenceId, 100);
  const label = text(req.body.label, 150);
  if (!referenceId || !label) throw httpError("Favourite reference and label are required.", 422);
  const profile = await profileFor(req.user._id);
  const existing = profile.favourites.find((entry) => entry.kind === kind && entry.referenceId === referenceId);
  if (existing) {
    existing.label = label;
    existing.notes = text(req.body.notes, 500);
  } else {
    profile.favourites.unshift({ kind, referenceId, label, notes: text(req.body.notes, 500) });
  }
  await profile.save();
  return res.status(existing ? 200 : 201).json({ success: true, favourites: profile.favourites });
}

export async function removeFavourite(req, res) {
  const profile = await profileFor(req.user._id);
  const entry = profile.favourites.id(objectId(req.params.entryId, "Favourite"));
  if (!entry) throw httpError("Favourite not found.", 404);
  entry.deleteOne();
  await profile.save();
  return res.json({ success: true, favourites: profile.favourites });
}

export async function listOffers(req, res) {
  return res.json({ success: true, offers: await SalonOffer.find(activeOfferQuery()).sort({ endsAt: 1 }).lean() });
}

export async function claimOffer(req, res) {
  const code = text(req.body.code, 40).toUpperCase();
  const offer = await SalonOffer.findOne({ ...activeOfferQuery(), code });
  if (!offer) throw httpError("This offer is invalid, unavailable or expired.", 404);
  const profile = await profileFor(req.user._id);
  if (profile.claimedOffers.some((entry) => String(entry.offer) === String(offer._id))) {
    throw httpError("This offer is already saved to your account.", 409);
  }
  profile.claimedOffers.unshift({ offer: offer._id, code: offer.code });
  offer.claimCount += 1;
  await Promise.all([profile.save(), offer.save()]);
  return res.status(201).json({ success: true, claim: profile.claimedOffers[0] });
}

export async function addWalletCard(req, res) {
  const code = text(req.body.code, 120);
  if (!code) throw httpError("Gift-card code is required.", 422);
  const giftCard = await GiftCard.findOne({ codeHash: hashValue(code) });
  if (!giftCard) throw httpError("Gift card not found.", 404);
  if (giftCard.recipientEmail && giftCard.recipientEmail.toLowerCase() !== req.user.email.toLowerCase()) {
    throw httpError("This gift card is assigned to another customer.", 403);
  }
  const profile = await profileFor(req.user._id);
  if (profile.walletCards.some((entry) => String(entry.giftCard) === String(giftCard._id))) {
    throw httpError("This gift card is already in your wallet.", 409);
  }
  profile.walletCards.unshift({ giftCard: giftCard._id, label: text(req.body.label, 80) || "Salon gift card" });
  await profile.save();
  return res.status(201).json({ success: true, walletCard: { ...profile.walletCards[0].toObject(), giftCard: publicGiftCard(giftCard) } });
}

export async function removeWalletCard(req, res) {
  const profile = await profileFor(req.user._id);
  const entry = profile.walletCards.id(objectId(req.params.entryId, "Wallet card"));
  if (!entry) throw httpError("Wallet card not found.", 404);
  entry.deleteOne();
  await profile.save();
  return res.json({ success: true });
}

export async function createAppointmentRequest(req, res) {
  const appointment = await ownedAppointment(req.user, req.body.appointmentId);
  const requestType = text(req.body.requestType, 20).toLowerCase();
  if (!["cancel", "reschedule"].includes(requestType)) throw httpError("Request type is invalid.", 422);
  const startsAt = new Date(appointment.startsAt || appointment.appointmentDate);
  if (!Number.isFinite(startsAt.getTime()) || startsAt <= new Date()) throw httpError("Past appointments cannot be changed.", 409);
  const profile = await profileFor(req.user._id);
  if (profile.appointmentRequests.some((entry) => String(entry.appointment) === String(appointment._id) && entry.status === "pending")) {
    throw httpError("A request for this appointment is already being reviewed.", 409);
  }
  let preferredDate = null;
  let preferredTime = "";
  if (requestType === "reschedule") {
    preferredDate = new Date(req.body.preferredDate);
    preferredTime = text(req.body.preferredTime, 5);
    if (Number.isNaN(preferredDate.getTime()) || preferredDate <= new Date() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(preferredTime)) {
      throw httpError("Choose a valid future date and time for rescheduling.", 422);
    }
  }
  profile.appointmentRequests.unshift({
    appointment: appointment._id,
    requestType,
    preferredDate,
    preferredTime,
    reason: text(req.body.reason, 750),
  });
  await profile.save();
  return res.status(201).json({ success: true, request: profile.appointmentRequests[0] });
}

export async function updateDiscovery(req, res) {
  const profile = await profileFor(req.user._id);
  profile.discovery = normaliseDiscovery(req.body);
  await profile.save();
  return res.json({ success: true, discovery: profile.discovery });
}

export async function addConsultation(req, res) {
  if (req.body.dataProcessingConsent !== true) throw httpError("Consent is required to save consultation details.", 422);
  let appointment = null;
  if (req.body.appointmentId) appointment = await ownedAppointment(req.user, req.body.appointmentId);
  const desiredOutcome = text(req.body.desiredOutcome, 750);
  if (!desiredOutcome) throw httpError("Tell the salon what result you would like.", 422);
  const profile = await profileFor(req.user._id);
  profile.consultations.unshift({
    appointment: appointment?._id || null,
    hairType: text(req.body.hairType, 80),
    currentColour: text(req.body.currentColour, 100),
    desiredOutcome,
    sensitivities: text(req.body.sensitivities, 750),
    previousTreatments: text(req.body.previousTreatments, 1000),
    notes: text(req.body.notes, 1000),
    dataProcessingConsent: true,
  });
  await profile.save();
  return res.status(201).json({ success: true, consultation: profile.consultations[0] });
}

export async function addInspiration(req, res) {
  const title = text(req.body.title, 120);
  if (!title) throw httpError("Inspiration title is required.", 422);
  const profile = await profileFor(req.user._id);
  profile.inspirationItems.unshift({
    title,
    imageUrl: safeHttpsUrl(req.body.imageUrl),
    notes: text(req.body.notes, 750),
  });
  await profile.save();
  return res.status(201).json({ success: true, item: profile.inspirationItems[0] });
}

export async function removeInspiration(req, res) {
  const profile = await profileFor(req.user._id);
  const entry = profile.inspirationItems.id(objectId(req.params.entryId, "Inspiration item"));
  if (!entry) throw httpError("Inspiration item not found.", 404);
  entry.deleteOne();
  await profile.save();
  return res.json({ success: true });
}

export async function addFeedback(req, res) {
  const category = text(req.body.category, 30).toLowerCase();
  const allowed = ["booking", "account", "shop", "accessibility", "performance", "other"];
  const message = text(req.body.message, 2000);
  if (!message) throw httpError("Feedback details are required.", 422);
  const profile = await profileFor(req.user._id);
  profile.feedback.unshift({
    category: allowed.includes(category) ? category : "other",
    rating: integer(req.body.rating, 1, 5, "Rating"),
    message,
    allowContact: Boolean(req.body.allowContact),
  });
  await profile.save();
  return res.status(201).json({ success: true, feedback: profile.feedback[0] });
}

export async function markInboxRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { _id: objectId(req.params.notificationId, "Notification"), customer: req.user._id },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (!notification) throw httpError("Message not found.", 404);
  return res.json({ success: true, notification });
}

export async function createOffer(req, res) {
  const offer = await SalonOffer.create({ ...normaliseOffer(req.body), createdBy: req.user._id, updatedBy: req.user._id });
  return res.status(201).json({ success: true, offer });
}

export async function listAllOffers(req, res) {
  return res.json({ success: true, offers: await SalonOffer.find().sort({ createdAt: -1 }).lean() });
}

export async function updateOffer(req, res) {
  const offer = await SalonOffer.findByIdAndUpdate(
    objectId(req.params.offerId, "Offer"),
    { $set: { ...normaliseOffer(req.body), updatedBy: req.user._id } },
    { new: true, runValidators: true }
  );
  if (!offer) throw httpError("Offer not found.", 404);
  return res.json({ success: true, offer });
}

export async function listAppointmentRequests(req, res) {
  const profiles = await CustomerExperienceProfile.find({ "appointmentRequests.0": { $exists: true } })
    .select("user appointmentRequests")
    .populate("user", "name email")
    .populate({ path: "appointmentRequests.appointment", select: "startsAt appointmentDate appointmentTime status", populate: [{ path: "service", select: "name" }, { path: "stylist", select: "firstName lastName name" }] })
    .lean();
  return res.json({ success: true, profiles });
}

export async function getManagementOverview(req, res) {
  const [profiles, offers] = await Promise.all([
    CustomerExperienceProfile.find({
      $or: [
        { "reviews.0": { $exists: true } },
        { "appointmentRequests.0": { $exists: true } },
        { "consultations.0": { $exists: true } },
        { "feedback.0": { $exists: true } },
      ],
    })
      .select("user reviews appointmentRequests consultations feedback updatedAt")
      .populate("user", "name email")
      .populate({ path: "reviews.appointment", select: "startsAt appointmentDate appointmentTime status", populate: { path: "service", select: "name" } })
      .populate({ path: "appointmentRequests.appointment", select: "startsAt appointmentDate appointmentTime status", populate: [{ path: "service", select: "name" }, { path: "stylist", select: "firstName lastName name" }] })
      .populate({ path: "consultations.appointment", select: "startsAt appointmentDate appointmentTime status", populate: { path: "service", select: "name" } })
      .sort({ updatedAt: -1 })
      .lean(),
    SalonOffer.find().sort({ createdAt: -1 }).lean(),
  ]);
  return res.json({ success: true, profiles, offers });
}

async function updateEmbeddedRecord(collectionName, recordId, updates) {
  const profile = await CustomerExperienceProfile.findOne({ [`${collectionName}._id`]: objectId(recordId, "Record") });
  if (!profile) throw httpError("Customer experience record not found.", 404);
  const record = profile[collectionName].id(recordId);
  Object.assign(record, updates);
  await profile.save();
  return record;
}

export async function updateReviewStatus(req, res) {
  const status = text(req.body.status, 20).toLowerCase();
  if (!["pending", "published", "rejected"].includes(status)) throw httpError("Review status is invalid.", 422);
  return res.json({ success: true, review: await updateEmbeddedRecord("reviews", req.params.reviewId, { status }) });
}

export async function updateFeedbackStatus(req, res) {
  const status = text(req.body.status, 20).toLowerCase();
  if (!["new", "reviewing", "planned", "resolved", "closed"].includes(status)) throw httpError("Feedback status is invalid.", 422);
  return res.json({ success: true, feedback: await updateEmbeddedRecord("feedback", req.params.feedbackId, { status }) });
}

export async function updateConsultationStatus(req, res) {
  const status = text(req.body.status, 20).toLowerCase();
  if (!["submitted", "reviewed", "archived"].includes(status)) throw httpError("Consultation status is invalid.", 422);
  return res.json({ success: true, consultation: await updateEmbeddedRecord("consultations", req.params.consultationId, { status }) });
}

export async function resolveAppointmentRequest(req, res) {
  const profile = await CustomerExperienceProfile.findOne({ "appointmentRequests._id": objectId(req.params.requestId, "Appointment request") });
  if (!profile) throw httpError("Appointment request not found.", 404);
  const entry = profile.appointmentRequests.id(req.params.requestId);
  const status = text(req.body.status, 20).toLowerCase();
  if (!["approved", "declined", "completed"].includes(status)) throw httpError("Request status is invalid.", 422);
  if (status === "approved") {
    if (entry.requestType === "cancel") {
      await changeAppointmentStatus(
        entry.appointment,
        "cancelled",
        { reason: entry.reason || "Customer self-service cancellation request approved." },
        { actor: req.user }
      );
    } else {
      await rescheduleAppointment(
        entry.appointment,
        {
          appointmentDate: entry.preferredDate,
          appointmentTime: entry.preferredTime,
          reason: entry.reason || "Customer self-service reschedule request approved.",
        },
        { actor: req.user }
      );
    }
  }
  entry.status = status === "approved" ? "completed" : status;
  entry.managerNote = text(req.body.managerNote, 750);
  entry.resolvedAt = new Date();
  await profile.save();
  return res.json({ success: true, request: entry });
}
