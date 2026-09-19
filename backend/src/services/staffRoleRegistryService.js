import StaffRole from "../models/StaffRole.js";
import {
  ASSIGNABLE_EMPLOYEE_PERMISSION_SET,
  STAFF_ROLE_BASELINE_PERMISSIONS,
} from "../constants/permissions.js";

export const BUILT_IN_STAFF_ROLES = Object.freeze([
  Object.freeze({
    key: "super_admin",
    name: "Super Admin",
    assignable: false,
    superAdminOnly: true,
  }),
  Object.freeze({
    key: "stylist",
    name: "Stylist",
    assignable: true,
    superAdminOnly: false,
  }),
  Object.freeze({
    key: "receptionist",
    name: "Receptionist",
    assignable: true,
    superAdminOnly: false,
  }),
  Object.freeze({
    key: "manager",
    name: "Manager",
    assignable: true,
    superAdminOnly: true,
  }),
  Object.freeze({
    key: "admin",
    name: "Administrator",
    assignable: true,
    superAdminOnly: true,
  }),
]);

export const BUILT_IN_STAFF_ROLE_KEYS =
  Object.freeze(
    BUILT_IN_STAFF_ROLES.map(
      (role) => role.key
    )
  );

const RESERVED_ROLE_KEYS =
  new Set([
    "customer",
    ...BUILT_IN_STAFF_ROLE_KEYS,
  ]);

export function normaliseRoleKey(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function normaliseRolePermissions(
  permissions
) {
  if (!Array.isArray(permissions)) {
    const error =
      new Error(
        "permissions must be an array."
      );
    error.statusCode = 400;
    throw error;
  }

  const unique = [
    ...new Set(
      permissions.map(
        (permission) =>
          String(
            permission || ""
          ).trim()
      )
    ),
  ].filter(Boolean);

  const invalid =
    unique.filter(
      (permission) =>
        !ASSIGNABLE_EMPLOYEE_PERMISSION_SET.has(
          permission
        )
    );

  if (invalid.length) {
    const error =
      new Error(
        `Unsupported permissions: ${invalid.join(", ")}.`
      );
    error.statusCode = 400;
    throw error;
  }

  return unique;
}

export function assignableRolePermissions(
  permissions = []
) {
  return (
    Array.isArray(
      permissions
    )
      ? permissions
      : []
  ).filter(
    (permission) =>
      ASSIGNABLE_EMPLOYEE_PERMISSION_SET.has(
        permission
      )
  );
}

export function assertCustomRoleKey(
  key
) {
  if (
    !/^[a-z][a-z0-9_]{2,39}$/.test(
      key
    )
  ) {
    const error =
      new Error(
        "Role key must start with a letter and contain only lowercase letters, numbers and underscores."
      );
    error.statusCode = 400;
    throw error;
  }

  if (
    RESERVED_ROLE_KEYS.has(
      key
    )
  ) {
    const error =
      new Error(
        "This role key is reserved by SalonAI."
      );
    error.statusCode = 409;
    throw error;
  }

  return key;
}

export function builtInRoleDefinition(
  roleKey
) {
  const key =
    String(roleKey || "")
      .trim()
      .toLowerCase();

  const definition =
    BUILT_IN_STAFF_ROLES.find(
      (role) =>
        role.key === key
    );

  if (!definition) {
    return null;
  }

  return {
    ...definition,
    system: true,
    active: true,
    permissions:
      STAFF_ROLE_BASELINE_PERMISSIONS[
        key
      ] || [],
  };
}

export async function resolveStaffRole(
  roleKey,
  {
    activeOnly = true,
  } = {}
) {
  const key =
    String(roleKey || "")
      .trim()
      .toLowerCase();

  const builtIn =
    builtInRoleDefinition(
      key
    );

  if (builtIn) {
    return builtIn;
  }

  const query = {
    key,
  };

  if (activeOnly) {
    query.active = true;
  }

  const custom =
    await StaffRole.findOne(
      query
    ).lean();

  if (!custom) {
    return null;
  }

  return {
    ...custom,
    permissions:
      assignableRolePermissions(
        custom.permissions
      ),
    system: false,
    assignable: true,
    superAdminOnly: true,
  };
}

export async function listStaffRoleDefinitions() {
  const customRoles =
    await StaffRole.find()
      .sort({
        active: -1,
        name: 1,
      })
      .lean();

  return [
    ...BUILT_IN_STAFF_ROLES.map(
      (role) => ({
        ...role,
        system: true,
        active: true,
        permissions:
          STAFF_ROLE_BASELINE_PERMISSIONS[
            role.key
          ] || [],
      })
    ),
    ...customRoles.map(
      (role) => ({
        ...role,
        permissions:
          assignableRolePermissions(
            role.permissions
          ),
        system: false,
        assignable: true,
        superAdminOnly: true,
      })
    ),
  ];
}

export function isPotentialStaffRole(
  role
) {
  const key =
    String(role || "")
      .trim()
      .toLowerCase();

  return Boolean(
    key &&
      key !== "customer"
  );
}
