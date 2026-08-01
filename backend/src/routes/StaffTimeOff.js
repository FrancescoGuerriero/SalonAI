import AuditLog from "./AuditLog.js";

export function auditFutureWrites(
  req,
  res,
  next
) {
  if (
    !["POST", "PATCH", "PUT", "DELETE"].includes(
      req.method
    )
  ) {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    if (res.statusCode < 400) {
      const entityId =
        payload?._id ||
        payload?.id ||
        payload?.data?._id ||
        req.params?.id ||
        req.params?.customerId ||
        req.params?.noteId;

      void AuditLog.create({
        actor: req.user?._id || req.user?.id,
        action: `${req.method} ${req.path}`,
        entityType:
          req.baseUrl
            .split("/")
            .filter(Boolean)
            .at(-1) || "future_feature",
        entityId,
        requestMethod: req.method,
        requestPath: req.originalUrl,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        metadata: {
          params: req.params,
          query: req.query,
        },
      }).catch((error) => {
        console.error(
          "Future-feature audit failed:",
          error.message
        );
      });
    }

    return originalJson(payload);
  };

  return next();
}
