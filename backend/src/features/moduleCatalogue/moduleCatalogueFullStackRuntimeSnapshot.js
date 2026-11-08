import { createHash } from "node:crypto";
import { isAbsolute, join } from "node:path";
import { lstat, readFile } from "node:fs/promises";
import {
  assertModuleDeploymentEvidenceReader,
  inspectModuleDeploymentProvenance,
} from "./moduleCatalogueDeploymentProvenance.js";

const SERVICES = Object.freeze(["ai-service", "backend", "frontend"]);
const NAMES = Object.freeze({
  "ai-service": "salonai-ai-service",
  backend: "salonai-backend",
  frontend: "salonai-frontend",
});
const DIGEST = /^ghcr\.io\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const FRESH_MS = 5 * 60_000;
const MAX_FILE_BYTES = 128 * 1024;

function empty(reason, result = null) {
  return Object.freeze({
    source: "operator_collected_host_snapshot", readOnly: true,
    outcome: reason, snapshotCollectedAt: null,
    releaseTag: null, sourceCommit: null,
    serviceCount: null, services: Object.freeze([]),
    snapshotEvidenceValid: result,
    currentReleaseVerified: null,
    runtimeVerified: null,
    productionAccepted: null,
    activationAuthorised: false,
  });
}

async function readFixedFile(directory, name) {
  const path = join(directory, name);
  const stats = await lstat(path);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_FILE_BYTES) {
    throw new Error("Runtime snapshot is not a bounded regular file.");
  }
  return readFile(path, "utf8");
}

/**
 * Compare a recent operator-collected production-host snapshot to a trusted
 * deployment archive. The backend never receives access to the Docker socket.
 * Snapshot age alone does not authenticate its issuer; this is an integrity
 * and consistency check, NOT signed host attestation.
 */
export function verifyFullStackRuntimeSnapshot({
  snapshot, release, archive, releaseRaw = null, now = new Date(),
} = {}) {
  if (!snapshot || !release || archive?.evidenceValidated !== true ||
      archive?.deploymentVerified !== true ||
      typeof releaseRaw !== "string" ||
      !/^[a-f0-9]{64}$/.test(archive.releaseManifestSha256 || "") ||
      createHash("sha256").update(releaseRaw).digest("hex") !== archive.releaseManifestSha256 ||
      !TAG.test(release.releaseTag || "") ||
      !SHA.test(release.sourceCommit || "") ||
      release.releaseTag !== archive.releaseTag ||
      release.sourceCommit !== archive.sourceCommit ||
      !TAG.test(snapshot.releaseTag || "") || !SHA.test(snapshot.sourceCommit || "") ||
      snapshot.releaseTag !== release.releaseTag ||
      snapshot.sourceCommit !== release.sourceCommit ||
      snapshot.schemaVersion !== 1 || snapshot.environment !== "production" ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    return empty("identity_mismatch", false);
  }
  const observedAt = new Date(snapshot.collectedAtUtc || "");
  const age = now.getTime() - observedAt.getTime();
  if (!Number.isFinite(age) || age < 0 || age > FRESH_MS) {
    return empty("snapshot_stale_or_invalid", false);
  }
  if (!Array.isArray(snapshot.services) || snapshot.services.length !== 3 ||
      !Array.isArray(release.images) || release.images.length !== 3) {
    return empty("service_set_incomplete", false);
  }
  const expected = new Map();
  for (const image of release.images) {
    if (!SERVICES.includes(image?.service) || expected.has(image.service) ||
        !DIGEST.test(image.immutableReference || "")) {
      return empty("release_image_invalid", false);
    }
    expected.set(image.service, image.immutableReference);
  }
  if (expected.size !== SERVICES.length) return empty("release_image_invalid", false);
  const observed = new Map();
  for (const service of snapshot.services) {
    if (!SERVICES.includes(service?.service) || observed.has(service.service) ||
        service.containerName !== NAMES[service.service] ||
        service.state !== "running" || service.health !== "healthy" ||
        typeof service.imageId !== "string" || !/^sha256:[a-f0-9]{64}$/.test(service.imageId) ||
        typeof service.configuredImage !== "string" ||
        !DIGEST.test(service.configuredImage) ||
        !Array.isArray(service.repoDigests) ||
        service.repoDigests.length > 30 ||
        service.repoDigests.some((reference) => typeof reference !== "string" || !DIGEST.test(reference)) ||
        !service.repoDigests.includes(expected.get(service.service)) ||
        service.configuredImage !== expected.get(service.service)) {
      return empty("running_image_or_health_mismatch", false);
    }
    observed.set(service.service, service);
  }
  if (observed.size !== SERVICES.length) return empty("service_set_incomplete", false);
  return Object.freeze({
    source: "operator_collected_host_snapshot", readOnly: true,
    outcome: "recent_host_snapshot_matches_release",
    snapshotCollectedAt: observedAt.toISOString(),
    releaseTag: release.releaseTag,
    sourceCommit: release.sourceCommit,
    serviceCount: SERVICES.length,
    services: Object.freeze(SERVICES.map((service) => Object.freeze({
      service, state: "running", health: "healthy", digestMatched: true,
    }))),
    snapshotEvidenceValid: true,
    // Observed at snapshot time. A separate, authenticated continuous probe
    // is required before claiming the deployment is currently verified.
    currentReleaseVerified: null,
    runtimeVerified: null,
    productionAccepted: null,
    activationAuthorised: false,
  });
}

export async function inspectFullStackRuntimeSnapshot({
  effectiveAuthority,
} = {}, {
  evidenceDirectory = process.env.AIIBP_DEPLOYMENT_EVIDENCE_DIRECTORY || "",
  readArtifact = readFixedFile,
  archivedInspector = inspectModuleDeploymentProvenance,
  now = new Date(),
} = {}) {
  assertModuleDeploymentEvidenceReader(effectiveAuthority);
  if (!evidenceDirectory || !isAbsolute(evidenceDirectory)) {
    return empty("runtime_snapshot_not_configured");
  }
  try {
    const archive = await archivedInspector({ effectiveAuthority });
    if (archive?.evidenceValidated !== true) return empty("archive_unavailable");
    const [runtimeRaw, releaseRaw] = await Promise.all([
      readArtifact(evidenceDirectory, "runtime-snapshot.json"),
      readArtifact(evidenceDirectory, "release-manifest.json"),
    ]);
    return verifyFullStackRuntimeSnapshot({
      snapshot: JSON.parse(runtimeRaw), release: JSON.parse(releaseRaw),
      releaseRaw, archive, now,
    });
  } catch {
    return empty("trusted_runtime_snapshot_unavailable_or_invalid");
  }
}
