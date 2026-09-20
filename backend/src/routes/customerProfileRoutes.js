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

router.get("/me", getMyProfile);
router.patch("/me", updateMyProfile);
router.patch("/me/consent", updateMyConsent);

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
  requirePermissions(
    "customer:update"
  ),
  "/:customerId/user-account",
  linkUserAccount
);

router.delete(
  requirePermissions(
    "customer:update"
  ),
  "/:customerId/user-account",
  unlinkUserAccount
);

router.patch(
  requirePermissions(
    "customer:update"
  ),
  "/:customerId/consent",
  updateConsent
);

router.patch(
  requirePermissions(
    "customer:archive"
  ),
  "/:customerId/archive",
  archiveProfile
);

router.patch(
  requirePermissions(
    "customer:archive"
  ),
  "/:customerId/restore",
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
