import {
  assertModuleDeploymentEvidenceReader,
  inspectModuleDeploymentProvenance,
} from "./moduleCatalogueDeploymentProvenance.js";

const COMMIT = /^[a-f0-9]{40}$/;
const RELEASE = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function identity(value) {
  return typeof value === "string" ? value.trim() : "";
}

function snapshot({
  outcome,
  releaseTag = null,
  commitSha = null,
  recordedRelease = null,
  recordedCommit = null,
  archiveAvailable = false,
} = {}) {
  return Object.freeze({
    source: "backend_process_environment",
    scope: "backend_process_only",
    outcome,
    releaseTag,
    commitSha,
    archiveAvailable,
    recordedRelease,
    recordedCommit,
    backendIdentityMatched: outcome === "match" ? true :
      outcome === "mismatch" ? false : null,
    backendHealthVerified: null,
    allContainersVerified: null,
    runtimeVerified: null,
    deploymentVerified: null,
    productionAccepted: null,
    activationAuthorised: false,
    readOnly: true,
  });
}

/**
 * Compare current backend-process release identity to an independently
 * parsed historical deployment archive. This does not attest running image
 * digests, any other process, the actual deployment host, or the tenant.
 *
 * The caller receives no environment secrets, hostnames or raw artifact.
 */
export async function inspectBackendRuntimeReleaseIdentity({
  effectiveAuthority,
} = {}, {
  environment = process.env,
  archivedInspector = inspectModuleDeploymentProvenance,
} = {}) {
  // Enforce authority before accessing even the low-sensitivity release ID.
  assertModuleDeploymentEvidenceReader(effectiveAuthority);
  const releaseTag = identity(environment?.APP_VERSION);
  const commitSha = identity(environment?.RELEASE_SOURCE_COMMIT) ||
    identity(environment?.COMMIT_SHA);
  const validRelease = RELEASE.test(releaseTag);
  const validCommit = COMMIT.test(commitSha);
  if (!validRelease || !validCommit) {
    return snapshot({ outcome: "backend_identity_unavailable" });
  }

  let archived;
  try {
    archived = await archivedInspector({ effectiveAuthority });
  } catch {
    return snapshot({ outcome: "archive_unavailable", releaseTag, commitSha });
  }
  if (archived?.evidenceValidated !== true ||
      archived?.deploymentVerified !== true ||
      !RELEASE.test(archived.releaseTag || "") ||
      !COMMIT.test(archived.sourceCommit || "")) {
    return snapshot({ outcome: "archive_unavailable", releaseTag, commitSha });
  }

  return snapshot({
    outcome: archived.releaseTag === releaseTag &&
      archived.sourceCommit === commitSha ? "match" : "mismatch",
    releaseTag,
    commitSha,
    archiveAvailable: true,
    recordedRelease: archived.releaseTag,
    recordedCommit: archived.sourceCommit,
  });
}
