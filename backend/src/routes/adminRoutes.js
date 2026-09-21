import express from "express";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(
  requirePermissions(
    "dashboard:view"
  )
);

router.get("/dashboard", (request, response) => {
  response.status(200).json({
    success: true,
    message: "Welcome Admin",
    user: request.user,
  });
});

export default router;
