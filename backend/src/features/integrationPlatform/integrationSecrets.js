import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

function encryptionKey() {
  const configured = String(
    process.env.INTEGRATION_SECRET_ENCRYPTION_KEY || ""
  ).trim();

  if (!configured) {
    const error = new Error(
      "INTEGRATION_SECRET_ENCRYPTION_KEY is required for integration credentials."
    );
    error.code = "INTEGRATION_SECRET_ENCRYPTION_KEY_REQUIRED";
    error.statusCode = 503;
    throw error;
  }

  return createHash("sha256").update(configured).digest();
}

export function hashIntegrationSecret(secret) {
  return createHash("sha256")
    .update(String(secret || ""))
    .digest("hex");
}

export function generateIntegrationSecret(prefix = "aiibp") {
  const publicPrefix = `${String(prefix || "aiibp").toLowerCase()}_${randomBytes(6).toString("hex")}`;
  const secretPart = randomBytes(32).toString("base64url");
  return Object.freeze({
    keyPrefix: publicPrefix,
    secret: `${publicPrefix}.${secretPart}`,
  });
}

export function encryptIntegrationSecret(secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(secret || ""), "utf8"),
    cipher.final(),
  ]);

  return Object.freeze({
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  });
}

export function decryptIntegrationSecret({ ciphertext, iv, tag } = {}) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(String(iv || ""), "base64")
  );
  decipher.setAuthTag(Buffer.from(String(tag || ""), "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(String(ciphertext || ""), "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function integrationSecretMatches(secret, expectedHash) {
  const actual = Buffer.from(hashIntegrationSecret(secret), "hex");
  const expected = Buffer.from(String(expectedHash || ""), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function signWebhookPayload({
  secret,
  timestamp,
  idempotencyKey,
  body,
} = {}) {
  const signingInput = `${timestamp}.${idempotencyKey}.${body}`;
  return createHmac("sha256", String(secret || ""))
    .update(signingInput)
    .digest("hex");
}

export default Object.freeze({
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  generateIntegrationSecret,
  hashIntegrationSecret,
  integrationSecretMatches,
  signWebhookPayload,
});
