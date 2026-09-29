import fs from "node:fs";
import { execFileSync } from "node:child_process";

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .map((value) => value.trim())
  .filter(Boolean);

const failures = [];
const exampleEnvPattern = /(^|\/)(?:\.env\.example|env\.example)$/i;
const sensitiveNamePattern =
  /^(?:MONGODB_URI|DATABASE_URL|SERVICE_KEY|AI_API_KEY|JWT_SECRET|JWT_REFRESH_SECRET|.*(?:_SECRET|_PASSWORD|_API_KEY|_AUTH_TOKEN|_ACCESS_TOKEN|_PRIVATE_KEY|_ENCRYPTION_KEY|_PSEUDONYM_KEY))$/i;

const allowedPlaceholder = (value) =>
  value === "" ||
  /^<[^>]+>$/.test(value) ||
  /^\$\{[A-Z0-9_]+\}$/.test(value);

const credentialedMongoPattern =
  /mongodb(?:\+srv)?:\/\/[^\s:@/]+:[^\s@/]+@/i;
const privateKeyPattern =
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/;
const githubTokenPattern =
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/;
const awsAccessKeyPattern =
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/;

for (const file of tracked) {
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }

  if (credentialedMongoPattern.test(content)) {
    failures.push(`${file}: credential-shaped MongoDB URI is forbidden`);
  }
  if (privateKeyPattern.test(content)) {
    failures.push(`${file}: private key material is forbidden`);
  }
  if (githubTokenPattern.test(content)) {
    failures.push(`${file}: GitHub token-shaped value is forbidden`);
  }
  if (awsAccessKeyPattern.test(content)) {
    failures.push(`${file}: AWS access-key-shaped value is forbidden`);
  }

  if (!exampleEnvPattern.test(file)) continue;

  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (!line || /^\s*#/.test(line)) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;

    const [, name, rawValue] = match;
    const value = rawValue.trim();
    if (!sensitiveNamePattern.test(name)) continue;
    if (allowedPlaceholder(value)) continue;

    failures.push(
      `${file}:${index + 1}: populated sensitive example variable ${name} is forbidden`,
    );
  }
}

if (failures.length > 0) {
  console.error("Repository secret hygiene gate failed:");
  for (const failure of failures) console.error(`[FAIL] ${failure}`);
  process.exit(1);
}

console.log("[PASS] Repository secret hygiene gate passed.");
