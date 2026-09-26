import {
  EMPLOYEE_PERMISSIONS,
} from "../constants/permissions.js";

export const PERMISSION_SCOPE_CLASSES =
  Object.freeze({
    PLATFORM: "P",
    BUSINESS: "B",
    LOCATION: "L",
    AGGREGATE: "A",
    HYBRID: "H",
    SELF: "S",
    CROSS_LOCATION: "X",
  });

export const PERMISSION_SCOPE_BY_KEY =
  Object.freeze({
    "dashboard:view": "A",

    "appointment:read": "L",
    "appointment:create": "L",
    "appointment:update": "L",
    "appointment:cancel": "L",
    "appointment:payment:manage": "L",

    "customer:read": "A",
    "customer:create": "B",
    "customer:update": "A",
    "customer:archive": "B",
    "customer:delete": "B",

    "employee:read": "A",
    "employee:create": "B",
    "employee:update": "A",
    "employee:deactivate": "A",
    "employee:role:update": "B",
    "employee:permissions:update": "B",
    "employee:schedule:update": "L",
    "employee:services:update": "H",

    "staff-role:read": "B",
    "staff-role:create": "B",
    "staff-role:update": "B",
    "staff-role:activate": "B",
    "staff-role:delete": "B",

    "profile:own:read": "S",
    "profile:own:update": "S",
    "profile:all:read": "A",
    "profile:all:update": "A",

    "schedule:own:read": "S",
    "schedule:own:update": "S",
    "leave:own:request": "S",

    "service:read": "H",
    "service:create": "H",
    "service:update": "H",
    "service:publish": "H",
    "service:delete": "H",

    "product:read": "H",
    "product:create": "H",
    "product:update": "H",
    "product:publish": "H",
    "product:inventory:update": "L",
    "product:cost:read": "A",
    "product:delete": "H",

    "communications:read": "A",
    "communications:manage": "A",

    "loyalty:manage": "X",
    "gift-card:manage": "X",
    "referral:manage": "B",
    "notification:manage": "B",
    "push:manage": "B",
    "email-campaign:manage": "A",
    "sms-reminder:manage": "A",
    "whatsapp:manage": "A",
    "retention-automation:manage": "A",
    "premium-analytics:read": "A",

    "inventory:read": "A",
    "inventory:manage": "A",

    "reports:read": "A",
    "reports:manage": "A",
    "ai:use": "A",

    "feature-control:read": "B",
    "feature-control:update": "B",

    "data-import:manage": "B",
    "data-export:manage": "A",
  });

export function permissionScope(
  permission
) {
  return (
    PERMISSION_SCOPE_BY_KEY[
      String(permission || "").trim()
    ] || null
  );
}

export function unclassifiedEmployeePermissions() {
  return EMPLOYEE_PERMISSIONS.filter(
    (permission) =>
      !permissionScope(
        permission
      )
  );
}

export default PERMISSION_SCOPE_BY_KEY;
