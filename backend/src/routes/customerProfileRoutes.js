import express from "express";

import {
  archiveProfile,
  createProfile,
  deleteProfile,
  getMyProfile,
  getProfile,
  getProfileStatistics,
  linkUserAccount,
  listProfiles,
  restoreProfile,
  unlinkUserAccount,
  updateConsent,
  updateMyConsent,
  updateMyProfile,
  updateProfile,
} from "../controllers/customerProfileController.js";

import {
  getCustomerOperationsSummary,
} from "../controllers/customerOperationsController.js";

import {
  adminOnly,
  managementOnly,
  protect,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/me", getMyProfile);
router.patch("/me", updateMyProfile);
router.patch("/me/consent", updateMyConsent);

router.use(managementOnly);

router.get("/statistics", getProfileStatistics);

router
  .route("/")
  .get(listProfiles)
  .post(createProfile);

router.patch(
  "/:customerId/user-account",
  linkUserAccount
);

router.delete(
  "/:customerId/user-account",
  unlinkUserAccount
);

router.patch(
  "/:customerId/consent",
  updateConsent
);

router.patch(
  "/:customerId/archive",
  archiveProfile
);

router.patch(
  "/:customerId/restore",
  restoreProfile
);

router.get(
  "/:customerId/operations",
  getCustomerOperationsSummary
);

router
  .route("/:customerId")
  .get(getProfile)
  .patch(updateProfile);

router.delete(
  "/:customerId",
  adminOnly,
  deleteProfile
);

export default router;
