export {
  authorize,
  adminOnly,
  superAdminOnly,
  managementOnly,
} from "./authMiddleware.js";

export function ownerOnly(request, response, next) {
  if (!request.user) {
    const error = new Error("Authentication is required before authorisation can be checked.");
    error.statusCode = 401;
    error.status = 401;
    return next(error);
  }

  if (request.user.role !== "super_admin") {
    const error = new Error("Super Admin access is required to perform this action.");
    error.statusCode = 403;
    error.status = 403;
    return next(error);
  }

  return next();
}
