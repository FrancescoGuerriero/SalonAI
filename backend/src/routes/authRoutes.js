import express from "express";

import {
  loginUser,
  logoutUser,
  refreshSession,
  createUserByAdmin,
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
  updateAdminUserStatus,
} from "../controllers/adminUserController.js";

import {
  protect,
  adminOnly,
} from "../middleware/authMiddleware.js";

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

router.post(
  "/admin/users",
  protect,
  adminOnly,
  createUserByAdmin
);

router
  .route("/admin/staff")
  .get(
    protect,
    adminOnly,
    listAdminUsers
  )
  .post(
    protect,
    adminOnly,
    createStaffUserByAdmin
  );

router.patch(
  "/admin/staff/:id/status",
  protect,
  adminOnly,
  updateAdminUserStatus
);

export default router;
