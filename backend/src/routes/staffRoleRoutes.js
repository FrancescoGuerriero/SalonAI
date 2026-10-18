import express from "express";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  effectiveAuthorityMiddleware,
} from "../middleware/effectiveAuthorityMiddleware.js";
import {
  hasRequestPermission,
  requirePermissions,
} from "../middleware/permissionMiddleware.js";
import {
  workforcePublicTenantContextMiddleware,
} from "../middleware/workforceTenantMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../platform/tenancy/trustedTenantMiddleware.js";
import {
  createStaffRole,
  deleteStaffRole,
  listStaffRoles,
  updateStaffRole,
} from "../controllers/staffRoleController.js";

const router = express.Router();

const staffRoleTenantChain = [
  protect,
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
];

function requireStaffRoleChanges(
  req,
  res,
  next
) {
  const required = [];

  const changesDefinition = [
    "key",
    "name",
    "description",
    "permissions",
  ].some((field) =>
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
    required.push("staff-role:update");
  }

  if (changesActiveState) {
    required.push("staff-role:activate");
  }

  const missing = required.filter(
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
        code: "INSUFFICIENT_PERMISSIONS",
        message:
          "You do not have permission to perform this action.",
        missingPermissions: missing,
        requestId: req.requestId,
      });
  }

  return next();
}

router.get(
  "/",
  ...staffRoleTenantChain,
  requirePermissions("staff-role:read"),
  listStaffRoles
);

router.post(
  "/",
  ...staffRoleTenantChain,
  requirePermissions("staff-role:create"),
  createStaffRole
);

router.patch(
  "/:id",
  ...staffRoleTenantChain,
  requireStaffRoleChanges,
  updateStaffRole
);

router.delete(
  "/:id",
  ...staffRoleTenantChain,
  requirePermissions("staff-role:delete"),
  deleteStaffRole
);

export default router;
