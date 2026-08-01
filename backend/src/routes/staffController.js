import * as service from "./securityService.js";

export async function auditLogs(req, res) {
  res.json(
    await service.listAuditLogs(req.query)
  );
}

export async function permissions(_req, res) {
  res.json(service.permissionMatrix());
}
