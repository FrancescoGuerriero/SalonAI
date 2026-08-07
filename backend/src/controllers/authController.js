import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import User from "../models/user.js";

export const REFRESH_COOKIE_NAME =
  "salonai_refresh_token";

function accessTokenLifetime() {
  return `${Math.max(
    1,
    Math.round(env.accessTokenMinutes)
  )}m`;
}

function refreshTokenLifetime() {
  return `${Math.max(
    1,
    Math.round(env.refreshTokenDays)
  )}d`;
}

export function createAccessToken(user) {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      tokenType: "access",
    },
    env.jwtSecret,
    {
      expiresIn: accessTokenLifetime(),
    }
  );
}

export function createRefreshToken(user) {
  return jwt.sign(
    {
      id: user._id,
      tokenType: "refresh",
    },
    env.jwtRefreshSecret,
    {
      expiresIn: refreshTokenLifetime(),
    }
  );
}

export function getRefreshCookieOptions() {
  const refreshDays = Math.max(
    1,
    Math.round(env.refreshTokenDays)
  );

  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/api/auth",
    maxAge:
      refreshDays *
      24 *
      60 *
      60 *
      1000,
  };
}

export function readCookie(
  request,
  cookieName
) {
  const cookieHeader =
    request.headers?.cookie || "";

  if (!cookieHeader) {
    return "";
  }

  const cookies =
    cookieHeader.split(";");

  for (const cookie of cookies) {
    const separatorIndex =
      cookie.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const name =
      cookie
        .slice(0, separatorIndex)
        .trim();

    if (name !== cookieName) {
      continue;
    }

    const rawValue =
      cookie
        .slice(separatorIndex + 1)
        .trim();

    try {
      return decodeURIComponent(
        rawValue
      );
    } catch {
      return rawValue;
    }
  }

  return "";
}

function setNoStoreHeaders(response) {
  response.set(
    "Cache-Control",
    "no-store"
  );
  response.set(
    "Pragma",
    "no-cache"
  );
}

function setRefreshCookie(
  response,
  refreshToken
) {
  response.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    getRefreshCookieOptions()
  );
}

function clearRefreshCookie(response) {
  const {
    maxAge,
    ...clearOptions
  } = getRefreshCookieOptions();

  response.clearCookie(
    REFRESH_COOKIE_NAME,
    clearOptions
  );
}

function serialiseUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || "",
    homeAddress: {
      line1:
        user.homeAddress?.line1 ||
        "",
      line2:
        user.homeAddress?.line2 ||
        "",
      city:
        user.homeAddress?.city ||
        "",
      county:
        user.homeAddress?.county ||
        "",
      postcode:
        user.homeAddress?.postcode ||
        "",
      country:
        user.homeAddress?.country ||
        "United Kingdom",
    },
  };
}

function cleanText(
  value,
  maximumLength
) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximumLength);
}

function refreshTokenUserId(
  decodedToken
) {
  return (
    decodedToken.id ||
    decodedToken.userId ||
    decodedToken._id ||
    decodedToken.sub ||
    ""
  );
}

export function normaliseAccountUpdate(
  body = {}
) {
  const address =
    body.homeAddress &&
    typeof body.homeAddress ===
      "object"
      ? body.homeAddress
      : {};

  const name =
    cleanText(
      body.name,
      120
    );
  const phone =
    cleanText(
      body.phone,
      30
    );
  const postcode =
    cleanText(
      address.postcode,
      20
    ).toUpperCase();

  if (!name) {
    const error =
      new Error(
        "Your name is required."
      );
    error.statusCode = 400;
    throw error;
  }

  return {
    name,
    phone,
    homeAddress: {
      line1: cleanText(
        address.line1,
        150
      ),
      line2: cleanText(
        address.line2,
        150
      ),
      city: cleanText(
        address.city,
        100
      ),
      county: cleanText(
        address.county,
        100
      ),
      postcode,
      country: cleanText(
        address.country ||
          "United Kingdom",
        100
      ),
    },
  };
}

/*
|--------------------------------------------------------------------------
| Public Registration (Customers Only)
|--------------------------------------------------------------------------
*/

export async function registerUser(
  req,
  res
) {
  try {
    const {
      name,
      email,
      password,
    } = req.body;

    if (
      !name ||
      !email ||
      !password
    ) {
      return res
        .status(400)
        .json({
          message:
            "Name, email and password are required.",
        });
    }

    if (
      password.length < 8
    ) {
      return res
        .status(400)
        .json({
          message:
            "Password must contain at least 8 characters.",
        });
    }

    const trimmedName =
      name.trim();
    const normalisedEmail =
      email
        .trim()
        .toLowerCase();

    const existingUser =
      await User.findOne({
        email:
          normalisedEmail,
      });

    if (existingUser) {
      return res
        .status(409)
        .json({
          message:
            "An account already exists for this email address.",
        });
    }

    const hashedPassword =
      await bcrypt.hash(
        password,
        10
      );

    const user =
      await User.create({
        name:
          trimmedName,
        email:
          normalisedEmail,
        password:
          hashedPassword,
        role:
          "customer",
      });

    return res
      .status(201)
      .json({
        message:
          "User registered successfully.",
        user:
          serialiseUser(
            user
          ),
      });
  } catch (error) {
    return res
      .status(500)
      .json({
        message:
          "Unable to register the account.",
      });
  }
}

/*
|--------------------------------------------------------------------------
| Admin User Creation
|--------------------------------------------------------------------------
*/

export async function createUserByAdmin(
  req,
  res
) {
  try {
    const {
      name,
      email,
      password,
      role = "customer",
    } = req.body;

    if (
      !name ||
      !email ||
      !password
    ) {
      return res
        .status(400)
        .json({
          message:
            "Name, email and password are required.",
        });
    }

    if (
      password.length < 8
    ) {
      return res
        .status(400)
        .json({
          message:
            "Password must contain at least 8 characters.",
        });
    }

    const allowedRoles = [
      "customer",
      "admin",
      "manager",
      "receptionist",
      "stylist",
    ];

    if (
      !allowedRoles.includes(
        role
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            "Invalid role.",
        });
    }

    const trimmedName =
      name.trim();
    const normalisedEmail =
      email
        .trim()
        .toLowerCase();

    const existingUser =
      await User.findOne({
        email:
          normalisedEmail,
      });

    if (existingUser) {
      return res
        .status(409)
        .json({
          message:
            "An account already exists for this email address.",
        });
    }

    const hashedPassword =
      await bcrypt.hash(
        password,
        10
      );

    const user =
      await User.create({
        name:
          trimmedName,
        email:
          normalisedEmail,
        password:
          hashedPassword,
        role,
      });

    return res
      .status(201)
      .json({
        message:
          "User created successfully.",
        user:
          serialiseUser(
            user
          ),
      });
  } catch (error) {
    return res
      .status(500)
      .json({
        message:
          "Unable to create the account.",
      });
  }
}

/*
|--------------------------------------------------------------------------
| Login and session lifecycle
|--------------------------------------------------------------------------
*/

export async function loginUser(
  req,
  res
) {
  try {
    const {
      email,
      password,
    } = req.body;

    if (
      !email ||
      !password
    ) {
      return res
        .status(400)
        .json({
          message:
            "Email and password are required.",
        });
    }

    const normalisedEmail =
      email
        .trim()
        .toLowerCase();

    const user =
      await User.findOne({
        email:
          normalisedEmail,
      }).select(
        "+password"
      );

    if (!user) {
      return res
        .status(401)
        .json({
          message:
            "Invalid email or password.",
        });
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password
      );

    if (
      !passwordMatches
    ) {
      return res
        .status(401)
        .json({
          message:
            "Invalid email or password.",
        });
    }

    if (
      user.isActive ===
      false
    ) {
      return res
        .status(403)
        .json({
          message:
            "This account has been disabled.",
        });
    }

    const token =
      createAccessToken(
        user
      );
    const refreshToken =
      createRefreshToken(
        user
      );

    setRefreshCookie(
      res,
      refreshToken
    );
    setNoStoreHeaders(
      res
    );

    return res
      .status(200)
      .json({
        success: true,
        message:
          "Login successful.",
        token,
        user:
          serialiseUser(
            user
          ),
      });
  } catch (error) {
    console.error(
      "Unable to sign in:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Unable to sign in.",
      });
  }
}

export async function refreshSession(
  req,
  res
) {
  const refreshToken =
    readCookie(
      req,
      REFRESH_COOKIE_NAME
    );

  if (!refreshToken) {
    clearRefreshCookie(
      res
    );
    setNoStoreHeaders(
      res
    );

    return res
      .status(401)
      .json({
        success: false,
        message:
          "No active refresh session was found.",
        code:
          "REFRESH_TOKEN_REQUIRED",
      });
  }

  let decodedToken;

  try {
    decodedToken =
      jwt.verify(
        refreshToken,
        env.jwtRefreshSecret
      );
  } catch (error) {
    clearRefreshCookie(
      res
    );
    setNoStoreHeaders(
      res
    );

    const expired =
      error.name ===
      "TokenExpiredError";

    return res
      .status(401)
      .json({
        success: false,
        message: expired
          ? "Your session has expired. Please sign in again."
          : "The refresh session is invalid. Please sign in again.",
        code: expired
          ? "REFRESH_TOKEN_EXPIRED"
          : "REFRESH_TOKEN_INVALID",
      });
  }

  if (
    decodedToken.tokenType !==
    "refresh"
  ) {
    clearRefreshCookie(
      res
    );
    setNoStoreHeaders(
      res
    );

    return res
      .status(401)
      .json({
        success: false,
        message:
          "The refresh session is invalid. Please sign in again.",
        code:
          "REFRESH_TOKEN_INVALID",
      });
  }

  const userId =
    refreshTokenUserId(
      decodedToken
    );

  if (!userId) {
    clearRefreshCookie(
      res
    );
    setNoStoreHeaders(
      res
    );

    return res
      .status(401)
      .json({
        success: false,
        message:
          "The refresh session does not identify a valid account.",
        code:
          "REFRESH_TOKEN_INVALID",
      });
  }

  try {
    const user =
      await User.findById(
        userId
      ).select(
        "-password"
      );

    if (!user) {
      clearRefreshCookie(
        res
      );
      setNoStoreHeaders(
        res
      );

      return res
        .status(401)
        .json({
          success: false,
          message:
            "The account associated with this session no longer exists.",
          code:
            "SESSION_ACCOUNT_NOT_FOUND",
        });
    }

    if (
      user.isActive ===
      false
    ) {
      clearRefreshCookie(
        res
      );
      setNoStoreHeaders(
        res
      );

      return res
        .status(403)
        .json({
          success: false,
          message:
            "This account has been disabled.",
          code:
            "ACCOUNT_DISABLED",
        });
    }

    const token =
      createAccessToken(
        user
      );
    const rotatedRefreshToken =
      createRefreshToken(
        user
      );

    setRefreshCookie(
      res,
      rotatedRefreshToken
    );
    setNoStoreHeaders(
      res
    );

    return res
      .status(200)
      .json({
        success: true,
        message:
          "Session refreshed.",
        token,
        user:
          serialiseUser(
            user
          ),
      });
  } catch (error) {
    console.error(
      "Unable to refresh session:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          "Unable to refresh the session.",
        code:
          "SESSION_REFRESH_FAILED",
      });
  }
}

export function logoutUser(
  req,
  res
) {
  clearRefreshCookie(
    res
  );
  setNoStoreHeaders(
    res
  );

  return res
    .status(200)
    .json({
      success: true,
      message:
        "Logged out successfully.",
    });
}

export async function getCurrentAccount(
  req,
  res
) {
  return res
    .status(200)
    .json({
      success: true,
      user:
        serialiseUser(
          req.user
        ),
    });
}

export async function updateCurrentAccount(
  req,
  res,
  next
) {
  try {
    const update =
      normaliseAccountUpdate(
        req.body
      );

    const user =
      await User.findByIdAndUpdate(
        req.user._id,
        {
          $set:
            update,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    return res
      .status(200)
      .json({
        success: true,
        message:
          "Account details updated successfully.",
        user:
          serialiseUser(
            user
          ),
      });
  } catch (error) {
    return next(
      error
    );
  }
}
