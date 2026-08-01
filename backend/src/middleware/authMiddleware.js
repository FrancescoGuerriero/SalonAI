import jwt from "jsonwebtoken";

import User from "../models/User.js";

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;

  return error;
}

export async function protect(
  request,
  response,
  next
) {
  try {
    const authorizationHeader =
      request.headers.authorization || "";

    let token = "";

    if (
      authorizationHeader.startsWith(
        "Bearer "
      )
    ) {
      token = authorizationHeader
        .slice(7)
        .trim();
    }

    if (!token && request.cookies?.token) {
      token = request.cookies.token;
    }

    if (!token) {
      return next(
        createHttpError(
          "Authentication required. No access token was provided.",
          401
        )
      );
    }

    if (!process.env.JWT_SECRET) {
      return next(
        createHttpError(
          "JWT_SECRET is not configured on the server.",
          500
        )
      );
    }

    let decodedToken;

    try {
      decodedToken = jwt.verify(
        token,
        process.env.JWT_SECRET
      );
    } catch (error) {
      if (
        error.name ===
        "TokenExpiredError"
      ) {
        return next(
          createHttpError(
            "Your session has expired. Please sign in again.",
            401
          )
        );
      }

      return next(
        createHttpError(
          "The access token is invalid.",
          401
        )
      );
    }

    const userId =
      decodedToken.id ||
      decodedToken.userId ||
      decodedToken._id ||
      decodedToken.sub;

    if (!userId) {
      return next(
        createHttpError(
          "The access token does not contain a valid user identifier.",
          401
        )
      );
    }

    const user = await User.findById(
      userId
    ).select("-password");

    if (!user) {
      return next(
        createHttpError(
          "The account associated with this token no longer exists.",
          401
        )
      );
    }

    if (user.isActive === false) {
      return next(
        createHttpError(
          "This account has been disabled.",
          403
        )
      );
    }

    request.user = user;

    return next();
  } catch (error) {
    return next(error);
  }
}

export function authorize(
  ...allowedRoles
) {
  return function authorizeRoles(
    request,
    response,
    next
  ) {
    if (!request.user) {
      return next(
        createHttpError(
          "Authentication is required before authorisation can be checked.",
          401
        )
      );
    }

    if (
      !allowedRoles.includes(
        request.user.role
      )
    ) {
      return next(
        createHttpError(
          "You do not have permission to perform this action.",
          403
        )
      );
    }

    return next();
  };
}

export const adminOnly =
  authorize("admin");

export const managementOnly =
  authorize(
    "admin",
    "stylist",
    "manager"
  );

export default {
  protect,
  authorize,
  adminOnly,
  managementOnly,
};