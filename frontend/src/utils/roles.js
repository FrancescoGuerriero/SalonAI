export const MANAGEMENT_ROLES = new Set([
  "admin",
  "manager",
  "stylist",
]);

export function isManagementRole(role) {
  return MANAGEMENT_ROLES.has(
    String(role || "").trim().toLowerCase()
  );
}

export function isAdminRole(role) {
  return String(role || "").trim().toLowerCase() === "admin";
}
