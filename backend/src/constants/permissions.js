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

  "staff-role:read",
  "staff-role:create",
  "staff-role:update",
  "staff-role:activate",
  "staff-role:delete",

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

  "loyalty:manage",
  "gift-card:manage",
  "referral:manage",
  "notification:manage",
  "push:manage",
  "email-campaign:manage",
  "sms-reminder:manage",
  "whatsapp:manage",
  "retention-automation:manage",
  "premium-analytics:read",

  "inventory:read",
  "inventory:manage",

  "reports:read",
  "reports:manage",
  "security:audit:read",
  "ai:use",

  "feature-control:read",
  "feature-control:update",

  "data-import:manage",
  "data-export:manage",
]);

export const EMPLOYEE_PERMISSION_SET =
  new Set(EMPLOYEE_PERMISSIONS);

export const NON_DELEGABLE_EMPLOYEE_PERMISSIONS =
  Object.freeze([
    "employee:role:update",
    "employee:permissions:update",
  ]);

const NON_DELEGABLE_EMPLOYEE_PERMISSION_SET =
  new Set(
    NON_DELEGABLE_EMPLOYEE_PERMISSIONS
  );

export const ASSIGNABLE_EMPLOYEE_PERMISSIONS =
  Object.freeze(
    EMPLOYEE_PERMISSIONS.filter(
      (permission) =>
        !NON_DELEGABLE_EMPLOYEE_PERMISSION_SET.has(
          permission
        )
    )
  );

export const ASSIGNABLE_EMPLOYEE_PERMISSION_SET =
  new Set(
    ASSIGNABLE_EMPLOYEE_PERMISSIONS
  );

/*
 * Baseline permissions are intentionally narrow. They preserve capabilities
 * that a role must have before the Super Admin makes any additional grants.
 * All other staff authority is explicitly delegated.
 */
export const STAFF_ROLE_BASELINE_PERMISSIONS = Object.freeze({
  super_admin: EMPLOYEE_PERMISSIONS,
  admin: Object.freeze([
    "dashboard:view",
    "appointment:read",
    "customer:read",
    "employee:read",
    "employee:permissions:update",
    "profile:own:read",
    "profile:all:read",
    "schedule:own:read",
    "service:read",
    "product:read",
    "communications:read",
    "communications:manage",
    "loyalty:manage",
    "gift-card:manage",
    "referral:manage",
    "notification:manage",
    "push:manage",
    "email-campaign:manage",
    "sms-reminder:manage",
    "whatsapp:manage",
    "retention-automation:manage",
    "premium-analytics:read",
    "inventory:read",
    "reports:read",
    "reports:manage",
    "security:audit:read",
    "ai:use",
    "feature-control:read",
    "feature-control:update",
    "data-import:manage",
    "staff-role:read",
    "staff-role:create",
    "staff-role:update",
    "staff-role:activate",
  ]),
  receptionist: Object.freeze([
    "dashboard:view",
  ]),
  manager: Object.freeze([
    "dashboard:view",
  ]),
  stylist: Object.freeze([
    "dashboard:view",
  ]),
});

export function permissionsForRole(
  role,
  assignedPermissions = [],
  rolePermissions = []
) {
  const baseline =
    STAFF_ROLE_BASELINE_PERMISSIONS[
      String(role || "").trim().toLowerCase()
    ] || [];

  return [
    ...new Set([
      ...baseline,
      ...(Array.isArray(rolePermissions) ? rolePermissions : []),
      ...(Array.isArray(assignedPermissions) ? assignedPermissions : []),
    ]),
  ].filter((permission) => EMPLOYEE_PERMISSION_SET.has(permission));
}

export default EMPLOYEE_PERMISSIONS;
