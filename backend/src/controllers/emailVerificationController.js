import crypto from "node:crypto";
import bcrypt from "bcrypt";

import { env } from "../config/env.js";
import User from "../models/user.js";
import { sendEmail } from "../providers/emailProvider.js";

const VERIFICATION_TOKEN_BYTES = 32;
const VERIFICATION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function normaliseEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: Boolean(user.emailVerified),
    emailVerificationRequired: Boolean(user.emailVerificationRequired),
  };
}

function verificationUrl(token) {
  const origin = String(env.frontendUrl || "").replace(/\/$/, "");
  return `${origin}/verify-email?token=${encodeURIComponent(token)}`;
}

async function issueVerification(user) {
  const token = crypto.randomBytes(VERIFICATION_TOKEN_BYTES).toString("hex");

  user.emailVerificationRequired = true;
  user.emailVerified = false;
  user.emailVerifiedAt = null;
  user.emailVerificationTokenHash = hashToken(token);
  user.emailVerificationExpiresAt = new Date(Date.now() + VERIFICATION_LIFETIME_MS);
  user.lastVerificationEmailSentAt = new Date();

  await user.save();

  const url = verificationUrl(token);

  await sendEmail({
    to: user.email,
    subject: "Verify your SalonAI account",
    message:
      `Hello ${user.name},\n\n` +
      "Please verify your email address before signing in to SalonAI.\n\n" +
      `${url}\n\n` +
      "This link expires in 24 hours. If you did not create this account, you can ignore this email.",
    html:
      `<p>Hello ${user.name},</p>` +
      "<p>Please verify your email address before signing in to SalonAI.</p>" +
      `<p><a href="${url}">Verify my SalonAI account</a></p>` +
      "<p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>",
  });
}

export async function registerVerifiedCustomer(req, res, next) {
  try {
    const name = String(req.body?.name || "").trim();
    const email = normaliseEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters.",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account already exists for this email address.",
      });
    }

    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role: "customer",
      emailVerified: false,
      emailVerificationRequired: true,
    });

    try {
      await issueVerification(user);
    } catch (emailError) {
      console.error("Unable to send SalonAI verification email:", emailError);

      return res.status(503).json({
        success: false,
        code: "VERIFICATION_EMAIL_UNAVAILABLE",
        message:
          "Your account was created, but the verification email could not be sent. Please use Resend verification email shortly.",
        user: publicUser(user),
      });
    }

    return res.status(201).json({
      success: true,
      verificationRequired: true,
      message:
        "Account created. Check your email and verify your address before signing in.",
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

export async function verifyEmail(req, res, next) {
  try {
    const token = String(req.body?.token || req.query?.token || "").trim();

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required.",
      });
    }

    const user = await User.findOne({
      emailVerificationTokenHash: hashToken(token),
      emailVerificationExpiresAt: { $gt: new Date() },
    }).select("+emailVerificationTokenHash +emailVerificationExpiresAt");

    if (!user) {
      return res.status(400).json({
        success: false,
        code: "EMAIL_VERIFICATION_INVALID",
        message: "This verification link is invalid or has expired.",
      });
    }

    user.emailVerified = true;
    user.emailVerificationRequired = false;
    user.emailVerifiedAt = new Date();
    user.emailVerificationTokenHash = "";
    user.emailVerificationExpiresAt = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Your email has been verified. You can now sign in.",
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

export async function resendVerificationEmail(req, res, next) {
  try {
    const email = normaliseEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email address is required.",
      });
    }

    const user = await User.findOne({ email }).select(
      "+emailVerificationTokenHash +emailVerificationExpiresAt"
    );

    /* Keep account-discovery behaviour neutral. */
    if (!user || !user.emailVerificationRequired || user.emailVerified) {
      return res.status(200).json({
        success: true,
        message:
          "If this account still needs verification, a new verification email will be sent.",
      });
    }

    const lastSent = user.lastVerificationEmailSentAt
      ? new Date(user.lastVerificationEmailSentAt).getTime()
      : 0;

    if (lastSent && Date.now() - lastSent < RESEND_COOLDOWN_MS) {
      return res.status(429).json({
        success: false,
        code: "VERIFICATION_RESEND_COOLDOWN",
        message: "Please wait a moment before requesting another verification email.",
      });
    }

    await issueVerification(user);

    return res.status(200).json({
      success: true,
      message:
        "If this account still needs verification, a new verification email will be sent.",
    });
  } catch (error) {
    return next(error);
  }
}

export async function requireVerifiedAccountForLogin(req, res, next) {
  try {
    const email = normaliseEmail(req.body?.email);

    if (!email) return next();

    const user = await User.findOne({ email }).select(
      "emailVerified emailVerificationRequired"
    );

    if (
      user?.emailVerificationRequired === true &&
      user?.emailVerified !== true
    ) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_VERIFICATION_REQUIRED",
        message:
          "Please verify your email address before signing in. Check your inbox or request a new verification email.",
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
