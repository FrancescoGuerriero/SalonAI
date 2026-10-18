import mongoose from "mongoose";

import BusinessMembership from "../models/BusinessMembership.js";
import StaffRole from "../models/StaffRole.js";
import {
  recordAuditEvent,
} from "../services/auditService.js";
import {
  permissionScopeLegend,
  permissionScopeMap,
} from "../services/permissionScopeService.js";
import {
  staffAccountBusinessId,
} from "../services/staffAccountAuthorityService.js";
import {
  assertCustomRoleKey,
  builtInRoleDefinition,
  isBuiltInStaffRoleKey,
  normaliseRoleKey,
  normaliseRolePermissions,
} from "../services/staffRoleRegistryService.js";
import {
  listTenantStaffRoleDefinitions,
  resolveTenantStaffRole,
  trustedStaffRoleBusinessFilter,
} from "../services/tenantStaffRoleRegistryService.js";

function httpError(message, statusCode, code = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  if (code) error.code = code;
  return error;
}

function resourceNotFound() {
  return httpError(
    "Staff role not found.",
    404,
    "RESOURCE_NOT_FOUND"
  );
}

function cleanText(value, maximumLength) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximumLength);
}

function tenantBusinessId(req) {
  return staffAccountBusinessId(
    req.effectiveAuthority
  );
}

function tenantRoleFilter(req, domainFilter = {}) {
  return {
    ...trustedStaffRoleBusinessFilter(
      tenantBusinessId(req)
    ),
    ...domainFilter,
  };
}

function serialiseRole(role) {
  const value =
    typeof role?.toObject === "function"
      ? role.toObject()
      : role;

  return {
    id: value?.system ? value?.key : value?._id,
    key: value?.key,
    name: value?.name,
    description: value?.description || "",
    permissions: value?.permissions || [],
    baselinePermissions: value?.baselinePermissions || [],
    rolePermissions: value?.rolePermissions || [],
    editable: value?.editable !== false,
    active: value?.active !== false,
    system: Boolean(value?.system),
    assignable: value?.assignable !== false,
    superAdminOnly: value?.superAdminOnly === true,
    createdAt: value?.createdAt,
    updatedAt: value?.updatedAt,
  };
}

async function assignedMembershipCount(req, roleKey) {
  return BusinessMembership.countDocuments({
    business: tenantBusinessId(req),
    roleKey,
    status: { $ne: "revoked" },
  });
}

function translateDuplicateRoleKey(error) {
  if (error?.code === 11000) {
    throw httpError(
      "A staff role already uses this key. If the collision belongs to another Business, complete the StaffRole tenant-index migration before reusing the key.",
      409,
      "STAFF_ROLE_KEY_CONFLICT"
    );
  }
  throw error;
}

export async function listStaffRoles(req, res, next) {
  try {
    const roles = await listTenantStaffRoleDefinitions({
      businessId: tenantBusinessId(req),
    });

    return res.json({
      success: true,
      roles: roles.map(serialiseRole),
      permissionScopes: permissionScopeMap(),
      scopeLegend: permissionScopeLegend(),
    });
  } catch (error) {
    return next(error);
  }
}

export async function createStaffRole(req, res, next) {
  try {
    const name = cleanText(req.body.name, 80);
    if (!name) {
      throw httpError("Role name is required.", 400);
    }

    const key = assertCustomRoleKey(
      normaliseRoleKey(req.body.key || name)
    );
    const permissions = normaliseRolePermissions(
      req.body.permissions || []
    );

    const existing = await StaffRole.findOne(
      tenantRoleFilter(req, { key })
    ).lean();
    if (existing) {
      throw httpError(
        "A custom staff role already uses this key in this Business.",
        409,
        "STAFF_ROLE_KEY_CONFLICT"
      );
    }

    let role;
    try {
      role = await StaffRole.create({
        business: tenantBusinessId(req),
        key,
        name,
        description: cleanText(req.body.description, 500),
        permissions,
        active: req.body.active !== false,
        createdBy: req.user?._id || null,
        updatedBy: req.user?._id || null,
      });
    } catch (error) {
      translateDuplicateRoleKey(error);
    }

    const after = serialiseRole({
      ...role.toObject(),
      system: false,
      editable: true,
      baselinePermissions: [],
      rolePermissions: role.permissions,
      assignable: true,
      superAdminOnly: true,
    });

    await recordAuditEvent({
      req,
      action: "staff_role.created",
      resourceType: "staffRole",
      resourceId: role._id,
      before: null,
      after,
      metadata: {
        businessId: tenantBusinessId(req),
        scope: "tenant-business",
      },
    });

    return res.status(201).json({
      success: true,
      message: "Custom staff role created.",
      role: after,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateStaffRole(req, res, next) {
  try {
    const identifier = String(req.params.id || "").trim();
    const businessId = tenantBusinessId(req);

    let role = null;
    let builtIn = builtInRoleDefinition(identifier);

    if (!builtIn && mongoose.isValidObjectId(identifier)) {
      role = await StaffRole.findOne(
        tenantRoleFilter(req, { _id: identifier })
      );
      if (!role) throw resourceNotFound();

      if (isBuiltInStaffRoleKey(role.key)) {
        builtIn = builtInRoleDefinition(role.key);
      }
    }

    if (builtIn) {
      if (builtIn.key === "super_admin") {
        throw httpError(
          "Super Admin permissions are fixed and always include every capability.",
          409
        );
      }

      const beforeDefinition = await resolveTenantStaffRole(
        builtIn.key,
        { businessId, activeOnly: false }
      );
      const before = serialiseRole(beforeDefinition);

      if (
        Object.prototype.hasOwnProperty.call(req.body, "key") &&
        normaliseRoleKey(req.body.key) !== builtIn.key
      ) {
        throw httpError("Built-in role keys are protected.", 400);
      }

      if (
        Object.prototype.hasOwnProperty.call(req.body, "name") &&
        cleanText(req.body.name, 80) !== builtIn.name
      ) {
        throw httpError("Built-in role names are protected.", 400);
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "active")) {
        throw httpError("Built-in roles cannot be deactivated.", 400);
      }

      if (!role) {
        role = await StaffRole.findOne(
          tenantRoleFilter(req, { key: builtIn.key })
        );
      }

      if (!role) {
        role = new StaffRole({
          business: businessId,
          key: builtIn.key,
          name: builtIn.name,
          description: "",
          permissions: [],
          active: true,
          createdBy: req.user?._id || null,
        });
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "permissions")) {
        const selected = normaliseRolePermissions(req.body.permissions);
        const baseline = builtIn.baselinePermissions || [];
        role.permissions = selected.filter(
          (permission) => !baseline.includes(permission)
        );
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "description")) {
        role.description = cleanText(req.body.description, 500);
      }

      role.business = businessId;
      role.name = builtIn.name;
      role.active = true;
      role.updatedBy = req.user?._id || null;

      try {
        await role.save();
      } catch (error) {
        translateDuplicateRoleKey(error);
      }

      const afterDefinition = await resolveTenantStaffRole(
        builtIn.key,
        { businessId, activeOnly: false }
      );
      const after = serialiseRole(afterDefinition);
      const assignedEmployeesAffected = await assignedMembershipCount(
        req,
        builtIn.key
      );

      await recordAuditEvent({
        req,
        action: "staff_role.updated",
        resourceType: "staffRole",
        resourceId: role._id,
        before,
        after,
        metadata: {
          businessId,
          scope: "tenant-business",
          assignedEmployeesAffected,
          systemRole: true,
        },
      });

      return res.json({
        success: true,
        message:
          "Built-in staff role updated. Assigned staff resolve the new permissions from this Business role at request time.",
        role: after,
        assignedEmployeesUpdated: 0,
        assignedEmployeesAffected,
      });
    }

    if (!role) throw resourceNotFound();

    const before = serialiseRole({
      ...role.toObject(),
      system: false,
      editable: true,
      baselinePermissions: [],
      rolePermissions: role.permissions,
    });

    if (
      Object.prototype.hasOwnProperty.call(req.body, "key") &&
      normaliseRoleKey(req.body.key) !== role.key
    ) {
      throw httpError("Role keys are immutable after creation.", 400);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "name")) {
      const name = cleanText(req.body.name, 80);
      if (!name) throw httpError("Role name is required.", 400);
      role.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "description")) {
      role.description = cleanText(req.body.description, 500);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "permissions")) {
      role.permissions = normaliseRolePermissions(req.body.permissions);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "active")) {
      if (typeof req.body.active !== "boolean") {
        throw httpError("active must be true or false.", 400);
      }
      role.active = req.body.active;
    }

    role.updatedBy = req.user?._id || null;
    await role.save();

    const after = serialiseRole({
      ...role.toObject(),
      system: false,
      editable: true,
      baselinePermissions: [],
      rolePermissions: role.permissions,
      assignable: true,
      superAdminOnly: true,
    });
    const assignedEmployeesAffected = await assignedMembershipCount(
      req,
      role.key
    );

    await recordAuditEvent({
      req,
      action: "staff_role.updated",
      resourceType: "staffRole",
      resourceId: role._id,
      before,
      after,
      metadata: {
        businessId,
        scope: "tenant-business",
        assignedEmployeesAffected,
        systemRole: false,
      },
    });

    return res.json({
      success: true,
      message:
        "Custom staff role updated. Assigned staff resolve the new permissions from this Business role at request time.",
      role: after,
      assignedEmployeesUpdated: 0,
      assignedEmployeesAffected,
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteStaffRole(req, res, next) {
  try {
    if (isBuiltInStaffRoleKey(req.params.id)) {
      throw httpError(
        "Built-in staff roles cannot be deleted.",
        409
      );
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      throw resourceNotFound();
    }

    const role = await StaffRole.findOne(
      tenantRoleFilter(req, { _id: req.params.id })
    );
    if (!role) throw resourceNotFound();

    if (isBuiltInStaffRoleKey(role.key)) {
      throw httpError(
        "Built-in staff roles cannot be deleted.",
        409
      );
    }

    const assignedEmployees = await assignedMembershipCount(
      req,
      role.key
    );
    if (assignedEmployees > 0) {
      throw httpError(
        "Reassign employees in this Business before deleting this custom role.",
        409
      );
    }

    const before = serialiseRole(role);
    await role.deleteOne();

    await recordAuditEvent({
      req,
      action: "staff_role.deleted",
      resourceType: "staffRole",
      resourceId: role._id,
      before,
      after: null,
      metadata: {
        businessId: tenantBusinessId(req),
        scope: "tenant-business",
      },
    });

    return res.json({
      success: true,
      message: "Custom staff role deleted.",
    });
  } catch (error) {
    return next(error);
  }
}
