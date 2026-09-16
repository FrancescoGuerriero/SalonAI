export const EMPLOYEE_PERMISSIONS = Object.freeze([
  "employee:read",
  "employee:create",
  "employee:update",
  "employee:deactivate",
  "employee:schedule:update",
  "employee:services:update",
  "appointment:read",
  "appointment:create",
  "appointment:update",
]);

export const EMPLOYEE_PERMISSION_SET =
  new Set(
    EMPLOYEE_PERMISSIONS
  );

export default EMPLOYEE_PERMISSIONS;

