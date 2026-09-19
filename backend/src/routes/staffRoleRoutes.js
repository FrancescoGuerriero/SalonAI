import express from "express";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  hasUserPermission,
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

function requireStaffRoleChanges(
  req,
  res,
  next
) {
  const required = [];

  const changesDefinition =
    [
      "key",
      "name",
      "description",
      "permissions",
    ].some(
      (field) =>
        Object.prototype.hasOwnProperty.call(
          req.body || {},
          field
        )
    );

  const changesActiveState =
    Object.prototype.hasOwnProperty.call(
      req.body || {},
      "active"
    );

  if (
    changesDefinition ||
    !changesActiveState
  ) {
    required.push(
      "staff-role:update"
    );
  }

  if (changesActiveState) {
    required.push(
      "staff-role:activate"
    );
  }

  const missing =
    required.filter(
      (permission) =>
        !hasUserPermission(
          req.user,
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

router.get(
  "/",
  protect,
  requirePermissions(
    "staff-role:read"
  ),
  listStaffRoles
);

router.post(
  "/",
  protect,
  requirePermissions(
    "staff-role:create"
  ),
  createStaffRole
);

router.patch(
  "/:id",
  protect,
  requireStaffRoleChanges,
  updateStaffRole
);

router.delete(
  "/:id",
  protect,
  requirePermissions(
    "staff-role:delete"
  ),
  deleteStaffRole
);

export default router;
