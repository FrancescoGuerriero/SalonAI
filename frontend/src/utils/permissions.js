export const EMPLOYEE_PERMISSIONS = Object.freeze([
  { value: "dashboard:view", label: "View dashboard", group: "Dashboard" },

  { value: "appointment:read", label: "View appointments", group: "Appointments" },
  { value: "appointment:create", label: "Create appointments", group: "Appointments" },
  { value: "appointment:update", label: "Update appointments", group: "Appointments" },
  { value: "appointment:cancel", label: "Cancel appointments", group: "Appointments" },
  { value: "appointment:payment:manage", label: "Manage appointment payments", group: "Appointments" },

  { value: "customer:read", label: "View customers", group: "Customers" },
  { value: "customer:create", label: "Create customers", group: "Customers" },
  { value: "customer:update", label: "Update customers", group: "Customers" },
  { value: "customer:archive", label: "Archive or restore customers", group: "Customers" },
  { value: "customer:delete", label: "Permanently delete customers", group: "Customers" },

  { value: "employee:read", label: "View employees", group: "Employees" },
  { value: "employee:create", label: "Add employees", group: "Employees" },
  { value: "employee:update", label: "Update employees", group: "Employees" },
  { value: "employee:deactivate", label: "Deactivate employees", group: "Employees" },
  { value: "employee:role:update", label: "Change staff roles", group: "Employees" },
  { value: "employee:permissions:update", label: "Change staff permissions", group: "Employees" },
  { value: "employee:schedule:update", label: "Update schedules", group: "Employees" },
  { value: "employee:services:update", label: "Assign services", group: "Employees" },

  { value: "profile:own:read", label: "View own public profile", group: "Profiles" },
  { value: "profile:own:update", label: "Edit own public profile", group: "Profiles" },
  { value: "profile:all:read", label: "View all staff profiles", group: "Profiles" },
  { value: "profile:all:update", label: "Edit all staff profiles", group: "Profiles" },

  { value: "schedule:own:read", label: "View own availability and leave", group: "My schedule" },
  { value: "schedule:own:update", label: "Update own availability", group: "My schedule" },
  { value: "leave:own:request", label: "Request own leave", group: "My schedule" },

  { value: "service:read", label: "View salon services", group: "Services" },
  { value: "service:create", label: "Create salon services", group: "Services" },
  { value: "service:update", label: "Edit salon services", group: "Services" },
  { value: "service:publish", label: "Publish salon services", group: "Services" },
  { value: "service:delete", label: "Delete salon services", group: "Services" },

  { value: "product:read", label: "View products", group: "Products" },
  { value: "product:create", label: "Create products", group: "Products" },
  { value: "product:update", label: "Edit products", group: "Products" },
  { value: "product:publish", label: "Publish products", group: "Products" },
  { value: "product:inventory:update", label: "Adjust product stock", group: "Products" },
  { value: "product:cost:read", label: "View product cost prices", group: "Products" },
  { value: "product:delete", label: "Delete products", group: "Products" },

  { value: "communications:read", label: "View communications", group: "Communications" },
  { value: "communications:manage", label: "Manage communications", group: "Communications" },

  { value: "inventory:read", label: "View inventory and purchasing", group: "Inventory" },
  { value: "inventory:manage", label: "Manage inventory and purchasing", group: "Inventory" },

  { value: "reports:read", label: "View reports", group: "Reports & AI" },
  { value: "ai:use", label: "Use SalonAI management tools", group: "Reports & AI" },

  { value: "feature-control:read", label: "View feature controls", group: "System" },
  { value: "feature-control:update", label: "Change feature controls", group: "System" },
  { value: "data-import:manage", label: "Manage data imports", group: "System" },
  { value: "data-export:manage", label: "Manage data exports", group: "System" },
]);

const STYLIST_BASELINE = Object.freeze([
  "appointment:read",
  "appointment:create",
]);

export function effectivePermissions(user) {
  const role = String(user?.role || "").trim().toLowerCase();

  if (role === "super_admin") {
    return EMPLOYEE_PERMISSIONS.map(({ value }) => value);
  }

  return [
    ...new Set([
      ...(role === "stylist" ? STYLIST_BASELINE : []),
      ...(Array.isArray(user?.permissions) ? user.permissions : []),
    ]),
  ];
}

export function hasPermission(user, permission) {
  if (
    String(user?.role || "").trim().toLowerCase() ===
    "super_admin"
  ) {
    return true;
  }

  return effectivePermissions(user).includes(permission);
}
