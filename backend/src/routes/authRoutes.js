import express from "express";

import {
  registerUser,
  loginUser,
  createUserByAdmin,
  getCurrentAccount,
  updateCurrentAccount,
} from "../controllers/authController.js";

import {
  protect,
  adminOnly,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);

router.post("/login", loginUser);

router
  .route("/me")
  .get(protect, getCurrentAccount)
  .patch(protect, updateCurrentAccount);

router.post(
  "/admin/users",
  protect,
  adminOnly,
  createUserByAdmin
);

export default router;
