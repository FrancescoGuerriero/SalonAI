import { createHash } from "node:crypto";
import { isAbsolute, join } from "node:path";
import { lstat, readFile } from "node:fs/promises";
import mongoose from "mongoose";
import {
  assertBusinessResourceAuthority,
  assertEffectivePermission,
} from "../../services/effectiveAuthorityService.js";

const SERVICES = Object.freeze(["ai-service", "backend", "frontend"]);
const SMOKE = Object.freeze(["edge", "backend", "ai-service", "frontend", "frontend-ai-route"]);
const HEX = /^[a-f0-9]{40}$/;
const SHA = /^[a-f0-9]{64}$/;
const TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const IMAGE = /^ghcr\.io\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/;
const MAX_BYTES = 256 * 1024;

function fail(message, code) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 403;
  throw error;
}
function unknown(reason) {
  return Object.freeze({
    evidenceAvailable: false, evidenceValidated: null, reason,
    releaseTag: null, sourceCommit: null, deployedAtUtc: null,
    environment: "production", imageDigestCount: null, smokeCheckCount: null,
    deploymentVerified: null, runtimeVerified: null,
    productionAccepted: null, currentReleaseVerified: null,
    activationAuthorised: false, readOnly: true,
  });
}
export function assertModuleDeploymentEvidenceReader(effectiveAuthority) {
  const businessId = String(effectiveAuthority?.businessId || "");
  if (!mongoose.isValidObjectId(businessId)) {
    fail("Trusted business context is required.", "DEPLOYMENT_EVIDENCE_TENANT_REQUIRED");
  }
  assertBusinessResourceAuthority(effectiveAuthority, businessId);
  assertEffectivePermission(effectiveAuthority, "feature-control:read");
  if (effectiveAuthority.locationAccessMode !== "all") {
    fail("Deployment provenance requires all-location management authority.",
      "DEPLOYMENT_EVIDENCE_SCOPE_REQUIRED");
  }
  return businessId;
}

function canonicalImageMap(images, accessor) {
  if (!Array.isArray(images) || images.length !== SERVICES.length) {
    fail("Release must contain exactly three canonical application images.",
      "DEPLOYMENT_EVIDENCE_IMAGE_SET_INVALID");
  }
  const map = new Map();
  for (const entry of images) {
    if (!SERVICES.includes(entry?.service) || map.has(entry.service)) {
      fail("Release image service is duplicated or unregistered.",
        "DEPLOYMENT_EVIDENCE_IMAGE_SET_INVALID");
    }
    const reference = accessor(entry);
    if (typeof reference !== "string" || !IMAGE.test(reference)) {
      fail("Immutable application image digest is invalid.", "DEPLOYMENT_EVIDENCE_IMAGE_INVALID");
    }
    map.set(entry.service, reference);
  }
  return map;
}

/**
 * Validates archived deployment artifacts, not current container state.
 * Does NOT validate cryptographic provenance signatures, attestation issuer
 * or an operator's production approval.
 */
export function verifyArchivedModuleDeploymentEvidence({
  deployment,
  release,
  releaseRaw,
  smoke,
} = {}) {
  if (!deployment || !release || !Array.isArray(smoke) ||
      typeof releaseRaw !== "string" ||
      release.schemaVersion !== 1 || !TAG.test(release.releaseTag || "") ||
      !HEX.test(release.sourceCommit || "") ||
      deployment.releaseTag !== release.releaseTag ||
      deployment.sourceCommit !== release.sourceCommit ||
      !SHA.test(deployment.releaseManifestSha256 || "") ||
      createHash("sha256").update(releaseRaw).digest("hex") !==
        deployment.releaseManifestSha256.toLowerCase()) {
    fail("Release and deployment identity or checksum do not agree.",
      "DEPLOYMENT_EVIDENCE_IDENTITY_MISMATCH");
  }
  const deployedAt = new Date(deployment.deployedAtUtc || "");
  if (Number.isNaN(deployedAt.getTime())) {
    fail("Deployment timestamp is invalid.", "DEPLOYMENT_EVIDENCE_TIME_INVALID");
  }
  const images = canonicalImageMap(release.images, (row) => row.immutableReference);
  const actualImages = deployment.images || {};
  const fields = { "ai-service": "aiService", backend: "backend", frontend: "frontend" };
  for (const service of SERVICES) {
    if (images.get(service) !== actualImages[fields[service]]) {
      fail("Deployment image digests do not match the immutable release.",
        "DEPLOYMENT_EVIDENCE_IMAGE_MISMATCH");
    }
  }
  const names = new Set();
  for (const check of smoke) {
    if (!SMOKE.includes(check?.name) || names.has(check.name) ||
        check.passed !== true || !Number.isInteger(check.statusCode) ||
        check.statusCode < 200 || check.statusCode >= 400) {
      fail("Deployment smoke evidence is absent, repeated or unsuccessful.",
        "DEPLOYMENT_EVIDENCE_SMOKE_FAILED");
    }
    names.add(check.name);
  }
  if (names.size !== SMOKE.length) {
    fail("Deployment smoke evidence does not cover all required services.",
      "DEPLOYMENT_EVIDENCE_SMOKE_INCOMPLETE");
  }
  return Object.freeze({
    evidenceAvailable: true, evidenceValidated: true,
    reason: "archived_release_and_smoke_evidence_consistent",
    releaseTag: release.releaseTag,
    sourceCommit: release.sourceCommit,
    deployedAtUtc: deployedAt.toISOString(),
    environment: "production",
    imageDigestCount: images.size,
    smokeCheckCount: names.size,
    releaseManifestSha256: deployment.releaseManifestSha256.toLowerCase(),
    // A deployment record is an *historical* event, not proof that the
    // recorded images are still running in production now.
    deploymentVerified: true,
    runtimeVerified: null,
    productionAccepted: null,
    currentReleaseVerified: null,
    activationAuthorised: false,
    readOnly: true,
  });
}

async function readFixedEvidenceFile(directory, name) {
  const location = join(directory, name);
  const stats = await lstat(location);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_BYTES) {
    fail("Deployment evidence file must be bounded and regular.",
      "DEPLOYMENT_EVIDENCE_FILE_INVALID");
  }
  return readFile(location, "utf8");
}

/**
 * The directory is supplied by trusted server configuration only, never by
 * HTTP request parameters. Files are read from fixed names; no caller paths.
 * This optional source is not mounted on an application host by default.
 */
export async function inspectModuleDeploymentProvenance({
  effectiveAuthority,
} = {}, {
  evidenceDirectory = process.env.AIIBP_DEPLOYMENT_EVIDENCE_DIRECTORY || "",
  readArtifact = readFixedEvidenceFile,
} = {}) {
  assertModuleDeploymentEvidenceReader(effectiveAuthority);
  if (!evidenceDirectory) return unknown("no_trusted_deployment_evidence_configured");
  if (typeof evidenceDirectory !== "string" || !isAbsolute(evidenceDirectory)) {
    return unknown("deployment_evidence_path_unavailable");
  }
  try {
    const [deploymentRaw, releaseRaw, smokeRaw] = await Promise.all([
      readArtifact(evidenceDirectory, "deployment.json"),
      readArtifact(evidenceDirectory, "release-manifest.json"),
      readArtifact(evidenceDirectory, "smoke-tests.json"),
    ]);
    return verifyArchivedModuleDeploymentEvidence({
      deployment: JSON.parse(deploymentRaw),
      release: JSON.parse(releaseRaw),
      releaseRaw,
      smoke: JSON.parse(smokeRaw),
    });
  } catch {
    // Never leak storage paths, hostnames, error messages or untrusted
    // artifact content into the administration UI.
    return unknown("trusted_deployment_evidence_unavailable_or_invalid");
  }
}
