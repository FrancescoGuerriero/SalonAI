import AuditLog from "../models/AuditLog.js";
import { logger } from "../config/logger.js";

export async function recordAuditEvent({
  req,
  action,
  resourceType,
  resourceId,
  before,
  after,
  metadata,
}) {
  try {
    return await AuditLog.create({
      actor: req?.user?._id,
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : undefined,
      requestId: req?.requestId,
      ipAddress: req?.ip,
      userAgent: req?.headers?.["user-agent"],
      before,
      after,
      metadata,
    });
  } catch (error) {
    logger.error("Audit event could not be recorded", error, {
      action,
      resourceType,
      resourceId,
      requestId: req?.requestId,
    });
    throw error;
  }
}
