export const MANAGEMENT_ROLES = new Set([
  "super_admin",
  "admin",
  "manager",
  "receptionist",
  "stylist",
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
