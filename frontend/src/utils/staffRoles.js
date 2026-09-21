export const DEFAULT_ASSIGNABLE_STAFF_ROLES =
  Object.freeze([
    Object.freeze({
      key: "stylist",
      name: "Stylist",
      system: true,
      active: true,
      assignable: true,
      superAdminOnly: false,
      permissions: [],
    }),
    Object.freeze({
      key: "receptionist",
      name: "Receptionist",
      system: true,
      active: true,
      assignable: true,
      superAdminOnly: false,
      permissions: [],
    }),
    Object.freeze({
      key: "manager",
      name: "Manager",
      system: true,
      active: true,
      assignable: true,
      superAdminOnly: true,
      permissions: [],
    }),
    Object.freeze({
      key: "admin",
      name: "Administrator",
      system: true,
      active: true,
      assignable: true,
      superAdminOnly: true,
      permissions: [],
    }),
  ]);

export function assignableRolesForUser(
  roles,
  {
    isSuperAdmin = false,
  } = {}
) {
  return (
    Array.isArray(roles) &&
    roles.length
      ? roles
      : DEFAULT_ASSIGNABLE_STAFF_ROLES
  ).filter(
    (role) =>
      role?.assignable !==
        false &&
      role?.active !== false &&
      (
        !role?.superAdminOnly ||
        isSuperAdmin
      )
  );
}
