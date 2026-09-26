import express from "express";

import socialAuthRoutes from "../features/socialAuth/socialAuthRoutes.js";

import {
  loginUser,
  logoutUser,
  refreshSession,
  getCurrentAccount,
  updateCurrentAccount,
} from "../controllers/authController.js";

import {
  registerVerifiedCustomer,
  verifyEmail,
  resendVerificationEmail,
  requireVerifiedAccountForLogin,
} from "../controllers/emailVerificationController.js";

import {
  listAdminUsers,
  createStaffUserByAdmin,
  getEmployeeManagementDetail,
  getEmployeeWithoutSignInManagementDetail,
  updateEmployeeRecordServices,
  updateEmployeeRecordSchedule,
  enableEmployeeSignIn,
  updateEmployeeManagementSettings,
  updateEmployeeSchedule,
  updateEmployeeServices,
  updateAdminUserStatus,
} from "../controllers/adminUserController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  hasRequestPermission,
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

import {
  authRateLimiter,
  passwordResetRateLimiter,
} from "../middleware/securityMiddleware.js";

import {
  requestPasswordReset,
  resetPassword,
} from "../controllers/passwordResetController.js";

const router =
  express.Router();

function requireEmployeeSettingsChanges(
  req,
  res,
  next
) {
  const body =
    req.body || {};
  const required =
    new Set();

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "role"
    )
  ) {
    required.add(
      "employee:role:update"
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "permissions"
    )
  ) {
    required.add(
      "employee:permissions:update"
    );
  }

  if (
    [
      "profilePublished",
      "acceptsAppointments",
    ].some((field) =>
      Object.prototype.hasOwnProperty.call(
        body,
        field
      )
    )
  ) {
    required.add(
      "employee:update"
    );
  }

  if (required.size === 0) {
    required.add(
      "employee:update"
    );
  }

  const missing =
    [...required].filter(
      (permission) =>
        !hasRequestPermission(
          req,
          permission
        )
    );

  if (missing.length) {
    return res
      .status(403)
      .json({
        success: false,
        code:
          "INSUFFICIENT_PERMISSIONS",
        message:
          "You do not have permission to perform this action.",
        missingPermissions:
          missing,
        requestId:
          req.requestId,
      });
  }

  return next();
}

router.use(
  "/social",
  socialAuthRoutes
);

router.post(
  "/register",
  authRateLimiter,
  registerVerifiedCustomer
);

router.post(
  "/verify-email",
  authRateLimiter,
  verifyEmail
);

router.post(
  "/resend-verification",
  authRateLimiter,
  resendVerificationEmail
);

router.post(
  "/login",
  authRateLimiter,
  requireVerifiedAccountForLogin,
  loginUser
);

router.post(
  "/forgot-password",
  passwordResetRateLimiter,
  requestPasswordReset
);

router.post(
  "/reset-password",
  passwordResetRateLimiter,
  resetPassword
);

router.post(
  "/refresh",
  refreshSession
);

router.post(
  "/logout",
  logoutUser
);

router
  .route("/me")
  .get(
    protect,
    getCurrentAccount
  )
  .patch(
    protect,
    updateCurrentAccount
  );

/*
 * Legacy compatibility alias.
 * Staff account creation is governed by the same canonical employee
 * creation implementation and employee:create permission as /admin/staff.
 * Customer creation belongs to /api/customers and is intentionally not
 * supported through this legacy privileged-user endpoint.
 */
router.post(
  "/admin/users",
  protect,
  requirePermissions(
    "employee:create"
  ),
  createStaffUserByAdmin
);

router
  .route("/admin/staff")
  .get(
    protect,
    requirePermissions(
      "employee:read"
    ),
    listAdminUsers
  )
  .post(
    protect,
    requirePermissions(
      "employee:create"
    ),
    createStaffUserByAdmin
  );

router.patch(
  "/admin/staff/:id",
  protect,
  requireEmployeeSettingsChanges,
  updateEmployeeManagementSettings
);

router.get(
  "/admin/staff-record/:id",
  protect,
  requirePermissions(
    "employee:read"
  ),
  getEmployeeWithoutSignInManagementDetail
);

router.post(
  "/admin/staff-record/:id/sign-in",
  protect,
  requirePermissions(
    "employee:create"
  ),
  enableEmployeeSignIn
);

router.patch(
  "/admin/staff-record/:id/services",
  protect,
  requirePermissions(
    "employee:services:update"
  ),
  updateEmployeeRecordServices
);

router.patch(
  "/admin/staff-record/:id/schedule",
  protect,
  requirePermissions(
    "employee:schedule:update"
  ),
  updateEmployeeRecordSchedule
);

router.get(
  "/admin/staff/:id",
  protect,
  requirePermissions(
    "employee:read"
  ),
  getEmployeeManagementDetail
);

router.patch(
  "/admin/staff/:id/services",
  protect,
  requirePermissions(
    "employee:services:update"
  ),
  updateEmployeeServices
);

router.patch(
  "/admin/staff/:id/schedule",
  protect,
  requirePermissions(
    "employee:schedule:update"
  ),
  updateEmployeeSchedule
);

router.patch(
  "/admin/staff/:id/status",
  protect,
  requirePermissions(
    "employee:deactivate"
  ),
  updateAdminUserStatus
);

export default router;
