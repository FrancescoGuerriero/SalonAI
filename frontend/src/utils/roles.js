export const MANAGEMENT_ROLES = new Set([
  "super_admin",
  "admin",
  "manager",
  "receptionist",
  "stylist",
]);

export const FULL_DASHBOARD_ROLES = new Set([
  "super_admin",
  "admin",
]);

export function isManagementRole(role) {
  const normalised =
    String(role || "")
      .trim()
      .toLowerCase();

  return Boolean(
    normalised &&
    normalised !== "customer"
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

export function hasFullManagementDashboard(role) {
  return FULL_DASHBOARD_ROLES.has(
    String(role || "")
      .trim()
      .toLowerCase()
  );
}
