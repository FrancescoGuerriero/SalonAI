import { logger } from "../config/logger.js";

export function notFoundHandler(req, res, next) {
  const error = new Error(
    `Route not found: ${req.method} ${req.originalUrl}`
  );
  error.statusCode = 404;
  error.code = "ROUTE_NOT_FOUND";
  next(error);
}

export function productionErrorHandler(error, req, res, next) {
  const statusCode =
    Number(error.statusCode || error.status) || 500;

  const expose =
    error.expose === true ||
    statusCode < 500;

  logger.error("Request failed", error, {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    userId: req.user?._id,
  });

  if (res.headersSent) {
    return next(error);
  }

  res.status(statusCode).json({
    success: false,
    code: error.code || "INTERNAL_ERROR",
    message: expose
      ? error.message
      : "An unexpected server error occurred.",
    details: expose
      ? error.details
      : undefined,
    requestId: req.requestId,
  });
}
