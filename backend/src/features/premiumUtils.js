import crypto from "node:crypto";

export function createCode(prefix = "") {
  const value = crypto.randomBytes(8).toString("hex").toUpperCase();
  return prefix ? `${prefix}-${value}` : value;
}

export function hashValue(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function domainError(message, code = "PREMIUM_ERROR", status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.statusCode = status;
  return error;
}
