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
  protect,
} from "../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

const router = express.Router();

router.use(protect);

/*
 * Customer self-service routes remain available to the authenticated customer.
 */
router.get(
  "/me",
  getMyProfile
);
router.patch(
  "/me",
  updateMyProfile
);
router.patch(
  "/me/consent",
  updateMyConsent
);

/*
 * Staff customer-management routes use granular delegated permissions.
 */
router.get(
  "/statistics",
  requirePermissions(
    "customer:read"
  ),
  getProfileStatistics
);

router
  .route("/")
  .get(
    requirePermissions(
      "customer:read"
    ),
    listProfiles
  )
  .post(
    requirePermissions(
      "customer:create"
    ),
    createProfile
  );

router.patch(
  "/:customerId/user-account",
  requirePermissions(
    "customer:update"
  ),
  linkUserAccount
);

router.delete(
  "/:customerId/user-account",
  requirePermissions(
    "customer:update"
  ),
  unlinkUserAccount
);

router.patch(
  "/:customerId/consent",
  requirePermissions(
    "customer:update"
  ),
  updateConsent
);

router.patch(
  "/:customerId/archive",
  requirePermissions(
    "customer:archive"
  ),
  archiveProfile
);

router.patch(
  "/:customerId/restore",
  requirePermissions(
    "customer:archive"
  ),
  restoreProfile
);

router.get(
  "/:customerId/operations",
  requirePermissions(
    "customer:read"
  ),
  getCustomerOperationsSummary
);

router
  .route("/:customerId")
  .get(
    requirePermissions(
      "customer:read"
    ),
    getProfile
  )
  .patch(
    requirePermissions(
      "customer:update"
    ),
    updateProfile
  );

router.delete(
  "/:customerId",
  requirePermissions(
    "customer:delete"
  ),
  deleteProfile
);

export default router;
