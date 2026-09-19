import express from "express";

import {
  protect,
  superAdminOnly,
} from "../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";
import {
  createStaffRole,
  deleteStaffRole,
  listStaffRoles,
  updateStaffRole,
} from "../controllers/staffRoleController.js";

const router =
  express.Router();

router.get(
  "/",
  protect,
  requirePermissions(
    "employee:read"
  ),
  listStaffRoles
);

router.post(
  "/",
  protect,
  superAdminOnly,
  createStaffRole
);

router.patch(
  "/:id",
  protect,
  superAdminOnly,
  updateStaffRole
);

router.delete(
  "/:id",
  protect,
  superAdminOnly,
  deleteStaffRole
);

export default router;
