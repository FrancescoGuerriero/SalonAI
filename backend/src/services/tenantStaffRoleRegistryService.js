import mongoose from "mongoose";

import StaffRole from "../models/StaffRole.js";
import {
  BUILT_IN_STAFF_ROLES,
  assignableRolePermissions,
  builtInRoleDefinition,
  isBuiltInStaffRoleKey,
} from "./staffRoleRegistryService.js";

function requireBusinessId(value) {
  const id = String(value || "").trim();

  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error(
      "A trusted Business id is required to resolve tenant-owned staff roles."
    );
    error.statusCode = 400;
    throw error;
  }

  return new mongoose.Types.ObjectId(id);
}

function mergeBuiltInTenantOverride(definition, override) {
  if (!definition) {
    return null;
  }

  const baselinePermissions = definition.baselinePermissions || [];
  const rolePermissions = assignableRolePermissions(
    override?.permissions
  ).filter(
    (permission) =>
      !baselinePermissions.includes(permission)
  );

  return {
    ...definition,
    _id: override?._id,
    business: override?.business,
    description: override?.description || "",
    createdAt: override?.createdAt,
    updatedAt: override?.updatedAt,
    rolePermissions,
    permissions: [
      ...new Set([
        ...baselinePermissions,
        ...rolePermissions,
      ]),
    ],
  };
}

export async function resolveTenantStaffRole(
  roleKey,
  {
    businessId,
    activeOnly = true,
  } = {}
) {
  const business = requireBusinessId(businessId);
  const key = String(roleKey || "")
    .trim()
    .toLowerCase();

  const builtIn = builtInRoleDefinition(key);

  if (builtIn) {
    const override = await StaffRole.findOne({
      business,
      key,
    }).lean();

    return mergeBuiltInTenantOverride(
      builtIn,
      override
    );
  }

  const query = {
    business,
    key,
  };

  if (activeOnly) {
    query.active = true;
  }

  const custom = await StaffRole.findOne(query).lean();

  if (!custom) {
    return null;
  }

  const permissions = assignableRolePermissions(
    custom.permissions
  );

  return {
    ...custom,
    permissions,
    baselinePermissions: [],
    rolePermissions: permissions,
    system: false,
    editable: true,
    assignable: true,
    superAdminOnly: true,
  };
}

export async function listTenantStaffRoleDefinitions({
  businessId,
} = {}) {
  const business = requireBusinessId(businessId);

  const storedRoles = await StaffRole.find({
    business,
  })
    .sort({
      active: -1,
      name: 1,
    })
    .lean();

  const storedByKey = new Map(
    storedRoles.map((role) => [role.key, role])
  );

  const builtIn = BUILT_IN_STAFF_ROLES.map(
    (role) =>
      mergeBuiltInTenantOverride(
        builtInRoleDefinition(role.key),
        storedByKey.get(role.key)
      )
  );

  const custom = storedRoles
    .filter(
      (role) =>
        !isBuiltInStaffRoleKey(role.key)
    )
    .map((role) => {
      const permissions = assignableRolePermissions(
        role.permissions
      );

      return {
        ...role,
        permissions,
        baselinePermissions: [],
        rolePermissions: permissions,
        system: false,
        editable: true,
        assignable: true,
        superAdminOnly: true,
      };
    });

  return [
    ...builtIn,
    ...custom,
  ];
}

export function trustedStaffRoleBusinessFilter(businessId) {
  return {
    business: requireBusinessId(businessId),
  };
}
