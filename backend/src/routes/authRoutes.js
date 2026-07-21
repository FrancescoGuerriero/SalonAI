import express from "express";

import {
  registerUser,
  loginUser,
  createUserByAdmin,
} from "../controllers/authController.js";

import {
  protect,
  adminOnly,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);

router.post("/login", loginUser);

router.post(
  "/admin/users",
  protect,
  adminOnly,
  createUserByAdmin
);

export default router;