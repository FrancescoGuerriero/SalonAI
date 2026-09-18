import crypto from "node:crypto";

function encryptionKey() {
  const raw = String(
    process.env.CALENDAR_TOKEN_ENCRYPTION_KEY || ""
  ).trim();

  if (!raw) {
    throw new Error(
      "CALENDAR_TOKEN_ENCRYPTION_KEY is required for external calendar connections."
    );
  }

  const key =
    /^[a-f0-9]{64}$/i.test(raw)
      ? Buffer.from(raw, "hex")
      : Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error(
      "CALENDAR_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes."
    );
  }

  return key;
}

export function encryptCalendarSecret(value) {
  const plain = String(value ?? "");

  if (!plain) return "";

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    encryptionKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptCalendarSecret(value) {
  const serialised = String(value ?? "").trim();

  if (!serialised) return "";

  const [version, ivValue, tagValue, encryptedValue] =
    serialised.split(".");

  if (
    version !== "v1" ||
    !ivValue ||
    !tagValue ||
    !encryptedValue
  ) {
    throw new Error(
      "Stored calendar credential has an unsupported format."
    );
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url")
  );

  decipher.setAuthTag(
    Buffer.from(tagValue, "base64url")
  );

  return Buffer.concat([
    decipher.update(
      Buffer.from(encryptedValue, "base64url")
    ),
    decipher.final(),
  ]).toString("utf8");
}
