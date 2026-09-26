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

  { value: "staff-role:read", label: "View staff roles", group: "Roles & access" },
  { value: "staff-role:create", label: "Create staff roles", group: "Roles & access" },
  { value: "staff-role:update", label: "Edit staff roles", group: "Roles & access" },
  { value: "staff-role:activate", label: "Activate or deactivate staff roles", group: "Roles & access" },
  { value: "staff-role:delete", label: "Delete staff roles", group: "Roles & access" },

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

  { value: "order:read", label: "View customer orders", group: "Orders & commerce" },
  { value: "order:update", label: "Update order fulfilment status", group: "Orders & commerce" },
  { value: "order:refund", label: "Refund customer orders", group: "Orders & commerce" },

  { value: "communications:read", label: "View communications", group: "Communications" },
  { value: "communications:manage", label: "Manage communications", group: "Communications" },
  { value: "email-campaign:manage", label: "Manage email campaigns", group: "Communications" },
  { value: "sms-reminder:manage", label: "Manage SMS reminders", group: "Communications" },
  { value: "whatsapp:manage", label: "Manage WhatsApp booking and conversations", group: "Communications" },
  { value: "notification:manage", label: "Manage notification centre", group: "Communications" },
  { value: "push:manage", label: "Manage push notifications", group: "Communications" },

  { value: "loyalty:manage", label: "Manage loyalty programme", group: "Customer growth" },
  { value: "gift-card:manage", label: "Manage gift cards", group: "Customer growth" },
  { value: "referral:manage", label: "Manage referrals", group: "Customer growth" },
  { value: "retention-automation:manage", label: "Manage retention automation", group: "Customer growth" },
  { value: "premium-analytics:read", label: "View premium analytics", group: "Reports & AI" },

  { value: "inventory:read", label: "View inventory and purchasing", group: "Inventory" },
  { value: "inventory:manage", label: "Manage inventory and purchasing", group: "Inventory" },

  { value: "reports:read", label: "View reports", group: "Reports & AI" },
  { value: "reports:manage", label: "Manage operational reports and daily close", group: "Reports & AI" },
  { value: "security:audit:read", label: "View security audit logs", group: "Roles & access" },
  { value: "privacy-request:manage", label: "Manage privacy-rights requests", group: "Roles & access" },
  { value: "ai:use", label: "Use SalonAI management tools", group: "Reports & AI" },

  { value: "feature-control:read", label: "View feature controls", group: "System" },
  { value: "feature-control:update", label: "Change feature controls", group: "System" },
  { value: "data-import:manage", label: "Manage data imports", group: "System" },
  { value: "data-export:manage", label: "Manage data exports", group: "System" },
]);

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
      ({ value }) =>
        !NON_DELEGABLE_EMPLOYEE_PERMISSION_SET.has(
          value
        )
    )
  );

const ROLE_BASELINES = Object.freeze({
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
    "order:read",
    "order:update",
    "order:refund",
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
    "privacy-request:manage",
    "ai:use",
    "feature-control:read",
    "feature-control:update",
    "data-import:manage",
    "data-export:manage",
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

export function effectivePermissions(user) {
  const role = String(user?.role || "").trim().toLowerCase();

  if (role === "super_admin") {
    return EMPLOYEE_PERMISSIONS.map(({ value }) => value);
  }

  return [
    ...new Set([
      ...(ROLE_BASELINES[role] || []),
      ...(Array.isArray(user?.rolePermissions) ? user.rolePermissions : []),
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
