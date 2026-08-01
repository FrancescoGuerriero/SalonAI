import AuditLog from "./AuditLog.js";
import {
  paginationFromQuery,
  paginationResult,
} from "../../shared/pagination.js";

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

export function permissionMatrix() {
  return {
    customer: [
      "view_own_profile",
      "book_appointment",
      "view_own_appointments",
    ],
    stylist: [
      "view_calendar",
      "update_appointment_status",
      "view_customer_service_notes",
    ],
    manager: [
      "manage_customers",
      "manage_appointments",
      "manage_campaigns",
      "view_reports",
      "manage_staff_schedule",
    ],
    admin: [
      "*",
    ],
  };
}
