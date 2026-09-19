export const EMPLOYEE_PERMISSIONS = Object.freeze([
  "dashboard:view",

  "appointment:read",
  "appointment:create",
  "appointment:update",
  "appointment:cancel",
  "appointment:payment:manage",

  "customer:read",
  "customer:create",
  "customer:update",
  "customer:archive",
  "customer:delete",

  "employee:read",
  "employee:create",
  "employee:update",
  "employee:deactivate",
  "employee:role:update",
  "employee:permissions:update",
  "employee:schedule:update",
  "employee:services:update",

  "profile:own:read",
  "profile:own:update",
  "profile:all:read",
  "profile:all:update",

  "schedule:own:read",
  "schedule:own:update",
  "leave:own:request",

  "service:read",
  "service:create",
  "service:update",
  "service:publish",
  "service:delete",

  "product:read",
  "product:create",
  "product:update",
  "product:publish",
  "product:inventory:update",
  "product:cost:read",
  "product:delete",

  "communications:read",
  "communications:manage",

  "inventory:read",
  "inventory:manage",

  "reports:read",
  "ai:use",

  "feature-control:read",
  "feature-control:update",

  "data-import:manage",
  "data-export:manage",
]);

export const EMPLOYEE_PERMISSION_SET =
  new Set(EMPLOYEE_PERMISSIONS);

/*
 * Baseline permissions are intentionally narrow. They preserve capabilities
 * that a role must have before the Super Admin makes any additional grants.
 * All other staff authority is explicitly delegated.
 */
export const STAFF_ROLE_BASELINE_PERMISSIONS = Object.freeze({
  super_admin: EMPLOYEE_PERMISSIONS,
  admin: Object.freeze([]),
  receptionist: Object.freeze([]),
  manager: Object.freeze([]),
  stylist: Object.freeze([
    "appointment:read",
    "appointment:create",
  ]),
});

export function permissionsForRole(role, assignedPermissions = []) {
  const baseline =
    STAFF_ROLE_BASELINE_PERMISSIONS[
      String(role || "").trim().toLowerCase()
    ] || [];

  return [
    ...new Set([
      ...baseline,
      ...(Array.isArray(assignedPermissions) ? assignedPermissions : []),
    ]),
  ].filter((permission) => EMPLOYEE_PERMISSION_SET.has(permission));
}

export default EMPLOYEE_PERMISSIONS;
