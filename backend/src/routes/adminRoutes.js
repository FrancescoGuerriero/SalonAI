import express from "express";

import {
  adminOnly,
  protect,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.get("/dashboard", (request, response) => {
  response.status(200).json({
    success: true,
    message: "Welcome Admin",
    user: request.user,
  });
});

export default router;
