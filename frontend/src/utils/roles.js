export const MANAGEMENT_ROLES = new Set([
  "super_admin",
  "admin",
  "manager",
  "receptionist",
  "stylist",
]);

export function isManagementRole(role) {
  return MANAGEMENT_ROLES.has(
    String(role || "").trim().toLowerCase()
  );
}

export function isSuperAdminRole(role) {
  return (
    String(role || "").trim().toLowerCase() ===
    "super_admin"
  );
}

export function isAdminRole(role) {
  return [
    "super_admin",
    "admin",
  ].includes(
    String(role || "").trim().toLowerCase()
  );
}
