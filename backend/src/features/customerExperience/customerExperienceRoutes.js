import express from "express";

import asyncHandler from "../../middleware/asyncHandler.js";
import { managementOnly, protect } from "../../middleware/authMiddleware.js";
import * as controller from "./customerExperienceController.js";

const router = express.Router();

router.use(protect);

router.get("/offers", asyncHandler(controller.listOffers));
router.get("/management/offers", managementOnly, asyncHandler(controller.listAllOffers));
router.post("/management/offers", managementOnly, asyncHandler(controller.createOffer));
router.patch("/management/offers/:offerId", managementOnly, asyncHandler(controller.updateOffer));
router.get("/management/appointment-requests", managementOnly, asyncHandler(controller.listAppointmentRequests));
router.patch("/management/appointment-requests/:requestId", managementOnly, asyncHandler(controller.resolveAppointmentRequest));
router.get("/management/overview", managementOnly, asyncHandler(controller.getManagementOverview));
router.patch("/management/reviews/:reviewId", managementOnly, asyncHandler(controller.updateReviewStatus));
router.patch("/management/feedback/:feedbackId", managementOnly, asyncHandler(controller.updateFeedbackStatus));
router.patch("/management/consultations/:consultationId", managementOnly, asyncHandler(controller.updateConsultationStatus));

router.get("/me", asyncHandler(controller.getCustomerExperience));
router.patch("/me/consents", asyncHandler(controller.updateConsents));
router.post("/me/reviews", asyncHandler(controller.addReview));
router.post("/me/favourites", asyncHandler(controller.addFavourite));
router.delete("/me/favourites/:entryId", asyncHandler(controller.removeFavourite));
router.post("/me/offers/claim", asyncHandler(controller.claimOffer));
router.post("/me/wallet", asyncHandler(controller.addWalletCard));
router.delete("/me/wallet/:entryId", asyncHandler(controller.removeWalletCard));
router.post("/me/appointment-requests", asyncHandler(controller.createAppointmentRequest));
router.patch("/me/discovery", asyncHandler(controller.updateDiscovery));
router.post("/me/consultations", asyncHandler(controller.addConsultation));
router.post("/me/inspiration", asyncHandler(controller.addInspiration));
router.delete("/me/inspiration/:entryId", asyncHandler(controller.removeInspiration));
router.post("/me/feedback", asyncHandler(controller.addFeedback));
router.patch("/me/inbox/:notificationId/read", asyncHandler(controller.markInboxRead));

export default router;
