import mongoose from "mongoose";

import AbandonedBookingIntent from "../../models/AbandonedBookingIntent.js";
import Appointment from "../../models/Appointment.js";
import Customer from "../../models/customer.js";
import { changeAppointmentStatus } from "../appointments/appointmentManagementService.js";
import { recordDomainEvent } from "../integrationPlatform/webhookProjectionService.js";
import CustomerExperienceProfile from "./CustomerExperienceProfile.js";
import ReputationResponse from "../reputation/ReputationResponse.js";
import {
  externalReputationOverview,
  ingestExternalReviews,
  ingestListingSnapshots,
  updateExternalReputationResponse,
} from "../reputation/reputationHubService.js";
import { createServiceError } from "../../shared/serviceError.js";

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function userId(user) {
  return user?._id || user?.id;
}

function identifier(value) {
  return text(value?._id || value?.id || value, 200);
}

function businessId(request) {
  return request?.effectiveAuthority?.businessId || request?.tenantContext?.businessId || undefined;
}

function locationId(request) {
  return request?.effectiveAuthority?.locationId || request?.tenantContext?.locationId || undefined;
}

function activeBusinessId(request) {
  const value = businessId(request);
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(
      "A trusted active business is required for reputation operations.",
      400
    );
  }
  return value;
}

function activeLocationId(request) {
  const value = locationId(request);
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(
      "Select a location before using the reputation hub.",
      400,
      { code: "LOCATION_REQUIRED" }
    );
  }
  return value;
}

function reputationAuthority(request) {
  return {
    businessId: activeBusinessId(request),
    locationId: activeLocationId(request),
  };
}

function appointmentStart(appointment) {
  if (appointment.startsAt) return new Date(appointment.startsAt);
  if (!appointment.appointmentDate) return new Date(Number.NaN);
  const date = new Date(appointment.appointmentDate);
  const [hours, minutes] = String(appointment.appointmentTime || "00:00").split(":").map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

async function customerForUser(user) {
  if (user?.customerProfile) {
    const linked = await Customer.findOne({ _id: user.customerProfile, status: { $ne: "deleted" } });
    if (linked) return linked;
  }
  const customer = await Customer.findOne({
    $or: [{ userAccount: userId(user) }, { email: String(user?.email || "").toLowerCase() }],
    status: { $ne: "deleted" },
  });
  if (!customer) throw createServiceError("No salon customer profile is linked to this account.", 404);
  return customer;
}

export async function checkInCustomerAppointment(appointmentId, request) {
  const customer = await customerForUser(request.user);
  const appointment = await Appointment.findOne({ _id: appointmentId, customer: customer._id });
  if (!appointment) throw createServiceError("Appointment not found for this account.", 404);

  const status = String(appointment.status || "").toLowerCase();
  if (!["pending", "confirmed"].includes(status)) {
    throw createServiceError(`A ${status || "current"} appointment cannot be checked in.`, 409);
  }

  const start = appointmentStart(appointment);
  if (!Number.isFinite(start.getTime())) throw createServiceError("Appointment start time is unavailable.", 409);
  const earlyMinutes = Math.max(15, Math.min(240, Number(process.env.CUSTOMER_CHECKIN_EARLY_MINUTES || 120)));
  const lateMinutes = Math.max(15, Math.min(240, Number(process.env.CUSTOMER_CHECKIN_LATE_MINUTES || 60)));
  const now = Date.now();
  if (now < start.getTime() - earlyMinutes * 60_000 || now > start.getTime() + lateMinutes * 60_000) {
    throw createServiceError(
      `Customer check-in is available from ${earlyMinutes} minutes before until ${lateMinutes} minutes after the appointment start time.`,
      409,
      { code: "CHECK_IN_WINDOW_CLOSED" }
    );
  }

  const changed = await changeAppointmentStatus(
    appointment._id,
    "checked_in",
    { reason: "Customer self-service check-in." },
    { actor: request.user }
  );

  const ownerBusinessId = identifier(changed?.business || appointment.business || businessId(request));
  if (ownerBusinessId) {
    await recordDomainEvent({
      businessId: ownerBusinessId,
      type: "appointment.status_changed",
      version: "1",
      aggregateType: "appointment",
      aggregateId: identifier(appointment._id),
      payload: {
        appointmentId: identifier(appointment._id),
        locationId: identifier(changed?.location || appointment.location),
        previousStatus: status,
        status: "checked_in",
        channel: "customer_self_service",
      },
      source: "customer_check_in",
      correlationId: identifier(appointment._id),
      metadata: {
        actorId: identifier(request.user),
      },
    });
  }

  return changed;
}

export async function bookingRecoveryMetrics(request) {
  const match = {};
  const business = businessId(request);
  if (business) match.business = new mongoose.Types.ObjectId(business);

  const grouped = await AbandonedBookingIntent.aggregate([
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(grouped.map((entry) => [entry._id, entry.count]));
  const total = Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0);
  const abandonedCohort = Number(counts.abandoned || 0) + Number(counts.recovered || 0) + Number(counts.converted || 0) + Number(counts.expired || 0);
  const resumed = Number(counts.recovered || 0) + Number(counts.converted || 0);
  const converted = Number(counts.converted || 0);

  return {
    total,
    counts: {
      active: Number(counts.active || 0),
      abandoned: Number(counts.abandoned || 0),
      recovered: Number(counts.recovered || 0),
      converted,
      expired: Number(counts.expired || 0),
      cancelled: Number(counts.cancelled || 0),
    },
    abandonedCohort,
    resumed,
    resumeRate: abandonedCohort ? Number((resumed / abandonedCohort).toFixed(4)) : 0,
    conversionRate: abandonedCohort ? Number((converted / abandonedCohort).toFixed(4)) : 0,
  };
}

function flattenReviews(profiles, responsesByReview) {
  return profiles.flatMap((profile) =>
    (profile.reviews || [])
      .filter((review) => review.appointment)
      .map((review) => {
        const response = responsesByReview.get(String(review._id));
        return {
          id: review._id,
          profileId: profile._id,
          customer: profile.user,
          appointment: review.appointment,
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          status: review.status,
          createdAt: review.createdAt,
          businessResponse: response
            ? {
                responseText: response.responseText,
                responseStatus: response.responseStatus,
                moderationNote: response.moderationNote,
                respondedAt: response.respondedAt,
                respondedBy: response.respondedBy,
              }
            : null,
        };
      })
  );
}

async function internalReputationOverview(request) {
  const { businessId: business, locationId: location } = reputationAuthority(request);
  const appointments = await Appointment.find({ business, location })
    .select("_id")
    .lean();
  const appointmentIds = appointments.map((appointment) => appointment._id);
  if (!appointmentIds.length) {
    return {
      reviews: [],
      summary: {
        total: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        statusCounts: { pending: 0, published: 0, rejected: 0 },
      },
    };
  }

  const profiles = await CustomerExperienceProfile.find({
    "reviews.appointment": { $in: appointmentIds },
  })
    .select("user reviews")
    .populate("user", "name email")
    .populate({
      path: "reviews.appointment",
      match: { business, location },
      select: "startsAt appointmentDate appointmentTime status business location",
      populate: { path: "service", select: "name" },
    })
    .lean();

  const reviewIds = profiles.flatMap((profile) =>
    (profile.reviews || [])
      .filter((review) => review.appointment)
      .map((review) => review._id)
  );
  const responses = reviewIds.length
    ? await ReputationResponse.find({
        reviewId: { $in: reviewIds },
        $or: [
          { business },
          { business: { $exists: false } },
          { business: null },
        ],
      }).lean()
    : [];
  const responsesByReview = new Map(
    responses.map((entry) => [String(entry.reviewId), entry])
  );
  const reviews = flattenReviews(profiles, responsesByReview);

  const published = reviews.filter((review) => review.status === "published");
  const averageRating = published.length
    ? Number(
        (
          published.reduce((sum, review) => sum + Number(review.rating || 0), 0) /
          published.length
        ).toFixed(2)
      )
    : 0;
  const ratingDistribution = Object.fromEntries(
    [1, 2, 3, 4, 5].map((rating) => [
      rating,
      published.filter((review) => review.rating === rating).length,
    ])
  );
  const statusCounts = Object.fromEntries(
    ["pending", "published", "rejected"].map((status) => [
      status,
      reviews.filter((review) => review.status === status).length,
    ])
  );

  return {
    locationId: String(location),
    reviews,
    summary: {
      total: reviews.length,
      averageRating,
      ratingDistribution,
      statusCounts,
    },
  };
}

export async function reputationOverview(request) {
  const authority = reputationAuthority(request);
  const [internal, external] = await Promise.all([
    internalReputationOverview(request),
    externalReputationOverview(request.query || {}, authority),
  ]);

  const internalPublished = internal.reviews.filter(
    (review) => review.status === "published"
  );
  const externalActive = external.reviews.filter(
    (review) => review.status === "active"
  );
  const combined = [...internalPublished, ...externalActive];
  const combinedAverageRating = combined.length
    ? Number(
        (
          combined.reduce((sum, review) => sum + Number(review.rating || 0), 0) /
          combined.length
        ).toFixed(2)
      )
    : 0;

  return {
    locationId: String(authority.locationId),
    reviews: internal.reviews,
    summary: internal.summary,
    externalReviews: external.reviews,
    listings: external.listings,
    externalSummary: external.summary,
    combinedSummary: {
      total: combined.length,
      internalPublished: internalPublished.length,
      externalActive: externalActive.length,
      averageRating: combinedAverageRating,
      ratingDistribution: Object.fromEntries(
        [1, 2, 3, 4, 5].map((rating) => [
          rating,
          combined.filter((review) => review.rating === rating).length,
        ])
      ),
    },
  };
}

export async function updateReputationReview(reviewId, payload, request) {
  const { businessId: business, locationId: location } = reputationAuthority(request);
  const profile = await CustomerExperienceProfile.findOne({ "reviews._id": reviewId });
  if (!profile) throw createServiceError("Review not found.", 404);
  const review = profile.reviews.id(reviewId);
  const appointment = await Appointment.findOne({
    _id: review.appointment,
    business,
    location,
  })
    .select("_id business location")
    .lean();
  if (!appointment) {
    throw createServiceError("Review not found in the selected location.", 404);
  }

  if (payload.status !== undefined) {
    const status = text(payload.status, 20).toLowerCase();
    if (!["pending", "published", "rejected"].includes(status)) {
      throw createServiceError("Review status is invalid.", 422);
    }
    review.status = status;
    await profile.save();
  }

  const responseText = text(payload.responseText, 2000);
  const responseStatus =
    text(payload.responseStatus, 20).toLowerCase() ||
    (responseText ? "draft" : "none");
  if (!["none", "draft", "published", "withdrawn"].includes(responseStatus)) {
    throw createServiceError("Review response status is invalid.", 422);
  }
  if (responseStatus === "published" && (!responseText || review.status !== "published")) {
    throw createServiceError(
      "A business response can be published only for a published review and must contain text.",
      409
    );
  }

  const response = await ReputationResponse.findOneAndUpdate(
    { reviewId: review._id },
    {
      $set: {
        profile: profile._id,
        business,
        responseText,
        responseStatus,
        moderationNote: text(payload.moderationNote, 1000),
        moderatedAt: new Date(),
        moderatedBy: userId(request.user),
        respondedAt: responseStatus === "published" ? new Date() : null,
        respondedBy: responseStatus === "published" ? userId(request.user) : undefined,
      },
    },
    { new: true, upsert: true, runValidators: true }
  );

  return { review, response };
}

export async function importExternalReviews(payload, request) {
  return ingestExternalReviews(payload, reputationAuthority(request));
}

export async function importListingSnapshots(payload, request) {
  return ingestListingSnapshots(payload, reputationAuthority(request));
}

export async function updateExternalReviewResponse(reviewId, payload, request) {
  return updateExternalReputationResponse(reviewId, payload, {
    ...reputationAuthority(request),
    actorUser: userId(request.user),
  });
}

export default {
  bookingRecoveryMetrics,
  checkInCustomerAppointment,
  importExternalReviews,
  importListingSnapshots,
  reputationOverview,
  updateExternalReviewResponse,
  updateReputationReview,
};
