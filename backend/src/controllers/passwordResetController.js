import crypto from "node:crypto";

import bcrypt from "bcrypt";

import { env } from "../config/env.js";
import PasswordResetToken from "../models/passwordResetToken.js";
import User from "../models/user.js";
import { sendPasswordResetEmail } from "../services/passwordResetMailer.js";

const REFRESH_COOKIE_NAME = "salonai_refresh_token";
const GENERIC_RESPONSE =
  "If an active SalonAI account exists for that email address, reset instructions have been prepared.";

export function normaliseResetEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 254);
}

export function hashResetToken(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

export function validateNewPassword(value) {
  const password = String(value || "");

  if (password.length < 8) {
    const error = new Error(
      "Password must contain at least 8 characters."
    );
    error.statusCode = 400;
    throw error;
  }

  if (password.length > 200) {
    const error = new Error("Password is too long.");
    error.statusCode = 400;
    throw error;
  }

  return password;
}

export function buildResetUrl(rawToken) {
  const base = String(env.frontendUrl || "http://localhost:5173")
    .replace(/\/$/, "");

  return `${base}/login?resetToken=${encodeURIComponent(rawToken)}`;
}

function clearRefreshCookie(response) {
  response.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/api/auth",
  });
}

export async function requestPasswordReset(req, res) {
  const email = normaliseResetEmail(req.body?.email);

  if (!email) {
    return res.status(202).json({
      message: GENERIC_RESPONSE,
    });
  }

  try {
    const user = await User.findOne({
      email,
      isActive: { $ne: false },
    }).select("_id name email isActive");

    if (!user) {
      return res.status(202).json({
        message: GENERIC_RESPONSE,
      });
    }

    await PasswordResetToken.deleteMany({
      user: user._id,
    });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(
      Date.now() + env.passwordResetMinutes * 60 * 1000
    );

    await PasswordResetToken.create({
      user: user._id,
      tokenHash,
      expiresAt,
    });

    const resetUrl = buildResetUrl(rawToken);

    try {
      await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        resetUrl,
      });
    } catch (deliveryError) {
      console.error(
        "Password reset email delivery failed:",
        deliveryError.message
      );
    }

    return res.status(202).json({
      message: GENERIC_RESPONSE,
      ...(!env.isProduction
        ? {
            developmentResetUrl: resetUrl,
          }
        : {}),
    });
  } catch (error) {
    console.error("Password reset request failed:", error.message);

    return res.status(202).json({
      message: GENERIC_RESPONSE,
    });
  }
}

export async function resetPassword(req, res) {
  try {
    const rawToken = String(req.body?.token || "").trim();
    const password = validateNewPassword(req.body?.password);

    if (!rawToken || rawToken.length > 500) {
      return res.status(400).json({
        message: "The password reset link is invalid or has expired.",
      });
    }

    const tokenHash = hashResetToken(rawToken);
    const resetRecord = await PasswordResetToken.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return res.status(400).json({
        message: "The password reset link is invalid or has expired.",
      });
    }

    const user = await User.findById(resetRecord.user).select("+password");

    if (!user || user.isActive === false) {
      await PasswordResetToken.deleteMany({
        user: resetRecord.user,
      });

      return res.status(400).json({
        message: "The password reset link is invalid or has expired.",
      });
    }

    user.password = await bcrypt.hash(password, 10);
    user.passwordChangedAt = new Date();
    await user.save();

    resetRecord.usedAt = new Date();
    await resetRecord.save();

    await PasswordResetToken.deleteMany({
      user: user._id,
      _id: { $ne: resetRecord._id },
    });

    clearRefreshCookie(res);

    return res.status(200).json({
      message:
        "Your password has been reset. Sign in with your new password.",
    });
  } catch (error) {
    const statusCode = Number(error.statusCode || error.status || 500);

    if (statusCode >= 500) {
      console.error("Password reset failed:", error.message);
    }

    return res.status(statusCode).json({
      message:
        statusCode >= 500
          ? "Unable to reset the password right now."
          : error.message,
    });
  }
}
