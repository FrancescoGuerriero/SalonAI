import express from "express";

import {
  registerUser,
  loginUser,
  logoutUser,
  refreshSession,
  createUserByAdmin,
  getCurrentAccount,
  updateCurrentAccount,
} from "../controllers/authController.js";

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
  registerUser
);

router.post(
  "/login",
  authRateLimiter,
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
 * Legacy/general admin user creation.
 * Retained for compatibility.
 */
router.post(
  "/admin/users",
  protect,
  adminOnly,
  createUserByAdmin
);

/*
 * Dedicated staff-account administration.
 */
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
