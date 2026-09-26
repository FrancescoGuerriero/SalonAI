import AuditLog from "./AuditLog.js";
import {
  paginationFromQuery,
  paginationResult,
} from "../../shared/pagination.js";
import {
  listStaffRoleDefinitions,
} from "../../services/staffRoleRegistryService.js";

export async function listAuditLogs(
  query = {}
) {
  const { page, limit, skip } =
    paginationFromQuery(query);

  const match = {};

  if (query.actor) {
    match.actor = query.actor;
  }

  if (query.action) {
    match.action = query.action;
  }

  if (query.entityType) {
    match.entityType = query.entityType;
  }

  if (query.entityId) {
    match.entityId = query.entityId;
  }

  const [items, total] = await Promise.all([
    AuditLog.find(match)
      .populate(
        "actor",
        "name firstName lastName email role accountType"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(match),
  ]);

  return {
    items,
    pagination: paginationResult(
      page,
      limit,
      total
    ),
  };
}

export async function permissionMatrix() {
  const roles =
    await listStaffRoleDefinitions();

  return {
    source:
      "canonical_staff_role_registry",
    roles:
      roles.map(
        (role) => ({
          key:
            role.key,
          name:
            role.name,
          active:
            role.active !==
            false,
          system:
            Boolean(
              role.system
            ),
          baselinePermissions:
            Array.isArray(
              role.baselinePermissions
            )
              ? role.baselinePermissions
              : [],
          rolePermissions:
            Array.isArray(
              role.rolePermissions
            )
              ? role.rolePermissions
              : [],
          permissions:
            Array.isArray(
              role.permissions
            )
              ? role.permissions
              : [],
        })
      ),
  };
}
