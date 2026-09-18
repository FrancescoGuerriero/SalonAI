export const EMPLOYEE_PERMISSIONS = Object.freeze([
  {
    value: "employee:read",
    label: "View employees",
  },
  {
    value: "employee:create",
    label: "Add employees",
  },
  {
    value: "employee:update",
    label: "Update employees",
  },
  {
    value: "employee:deactivate",
    label: "Deactivate employees",
  },
  {
    value: "employee:schedule:update",
    label: "Update schedules",
  },
  {
    value: "employee:services:update",
    label: "Assign services",
  },
  {
    value: "appointment:read",
    label: "View appointments",
  },
  {
    value: "appointment:create",
    label: "Create appointments",
  },
  {
    value: "appointment:update",
    label: "Update appointments",
  },
]);

export function hasPermission(
  user,
  permission
) {
  if (
    user?.isSuperAdmin === true
  ) {
    return true;
  }

  return Array.isArray(
    user?.permissions
  ) &&
    user.permissions.includes(
      permission
    );
}

