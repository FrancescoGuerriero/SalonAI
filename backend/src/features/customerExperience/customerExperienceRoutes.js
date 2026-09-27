import express from "express";

import asyncHandler from "../../middleware/asyncHandler.js";
import { protect } from "../../middleware/authMiddleware.js";
import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import * as controller from "./customerExperienceController.js";
import {
  getCommunicationPreferences,
  updateCommunicationPreferences,
} from "./customerCommunicationPreferencesController.js";
import {
  addExpandedConsultation,
} from "./customerConsultationController.js";
import { requireFeature } from "../../services/featureControlService.js";

const router = express.Router();

router.use(protect);

router.get("/offers", requireFeature("offers"), asyncHandler(controller.listOffers));
router.get("/management/offers", requirePermissions("customer-experience:read"), asyncHandler(controller.listAllOffers));
router.post("/management/offers", requirePermissions("customer-experience:manage"), asyncHandler(controller.createOffer));
router.patch("/management/offers/:offerId", requirePermissions("customer-experience:manage"), asyncHandler(controller.updateOffer));
router.get("/management/appointment-requests", requirePermissions("customer-experience:read"), asyncHandler(controller.listAppointmentRequests));
router.patch("/management/appointment-requests/:requestId", requirePermissions("customer-experience:manage"), asyncHandler(controller.resolveAppointmentRequest));
router.get("/management/overview", requirePermissions("customer-experience:read"), asyncHandler(controller.getManagementOverview));
router.patch("/management/reviews/:reviewId", requirePermissions("customer-experience:manage"), asyncHandler(controller.updateReviewStatus));
router.patch("/management/feedback/:feedbackId", requirePermissions("customer-experience:manage"), asyncHandler(controller.updateFeedbackStatus));
router.patch("/management/consultations/:consultationId", requirePermissions("customer-experience:manage"), asyncHandler(controller.updateConsultationStatus));

router.get("/me", asyncHandler(controller.getCustomerExperience));
router.get("/me/communications", asyncHandler(getCommunicationPreferences));
router.patch("/me/communications", asyncHandler(updateCommunicationPreferences));
router.patch("/me/consents", asyncHandler(controller.updateConsents));
router.post("/me/reviews", requireFeature("reviews"), asyncHandler(controller.addReview));
router.post("/me/favourites", requireFeature("favourites"), asyncHandler(controller.addFavourite));
router.delete("/me/favourites/:entryId", requireFeature("favourites"), asyncHandler(controller.removeFavourite));
router.post("/me/offers/claim", requireFeature("offers"), asyncHandler(controller.claimOffer));
router.post("/me/wallet", requireFeature("wallet"), asyncHandler(controller.addWalletCard));
router.delete("/me/wallet/:entryId", requireFeature("wallet"), asyncHandler(controller.removeWalletCard));
router.post("/me/appointment-requests", requireFeature("appointments"), asyncHandler(controller.createAppointmentRequest));
router.patch("/me/discovery", requireFeature("salon-discovery"), asyncHandler(controller.updateDiscovery));
router.post("/me/consultations", requireFeature("consultation"), asyncHandler(addExpandedConsultation));
router.post("/me/inspiration", requireFeature("inspiration"), asyncHandler(controller.addInspiration));
router.delete("/me/inspiration/:entryId", requireFeature("inspiration"), asyncHandler(controller.removeInspiration));
router.post("/me/feedback", requireFeature("feedback"), asyncHandler(controller.addFeedback));
router.patch("/me/inbox/:notificationId/read", requireFeature("inbox"), asyncHandler(controller.markInboxRead));

export default router;
