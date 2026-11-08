import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  assertModuleDeploymentEvidenceReader,
  inspectModuleDeploymentProvenance,
  verifyArchivedModuleDeploymentEvidence,
} from "../features/moduleCatalogue/moduleCatalogueDeploymentProvenance.js";

const BUSINESS = "507f1f77bcf86cd799439021";
const authority = Object.freeze({
  businessId: BUSINESS,
  locationAccessMode: "all",
  permissions: ["feature-control:read"],
});
const services = ["ai-service", "backend", "frontend"];
const smokeNames = ["edge", "backend", "ai-service", "frontend", "frontend-ai-route"];
const images = services.map((service, index) => ({
  service, immutableReference:
    `ghcr.io/francescoguerriero/salonai-${service}@sha256:${String(index + 1).repeat(64)}`,
}));
function fixture() {
  const release = {
    schemaVersion: 1, releaseTag: "v8.15.18",
    sourceCommit: "a".repeat(40), images: images.map((image) => ({ ...image })),
  };
  const releaseRaw = JSON.stringify(release);
  return {
    release, releaseRaw,
    deployment: {
      deployedAtUtc: "2026-11-08T12:00:00.000Z",
      releaseTag: release.releaseTag,
      sourceCommit: release.sourceCommit,
      releaseManifestSha256: createHash("sha256").update(releaseRaw).digest("hex"),
      images: {
        aiService: images[0].immutableReference,
        backend: images[1].immutableReference,
        frontend: images[2].immutableReference,
      },
    },
    smoke: smokeNames.map((name) => ({ name, statusCode: 200, passed: true })),
  };
}

test("validated archive proves an historical deployment, not live runtime acceptance", () => {
  const proof = verifyArchivedModuleDeploymentEvidence(fixture());
  assert.equal(proof.evidenceValidated, true);
  assert.equal(proof.imageDigestCount, 3);
  assert.equal(proof.smokeCheckCount, 5);
  assert.equal(proof.releaseTag, "v8.15.18");
  assert.equal(proof.deploymentVerified, true);
  assert.equal(proof.currentReleaseVerified, null);
  assert.equal(proof.runtimeVerified, null);
  assert.equal(proof.productionAccepted, null);
  assert.equal(proof.activationAuthorised, false);
  assert.equal(Object.hasOwn(proof, "baseUrl"), false);
});

test("tampering, missing checks and swapped deployment image identities fail closed", () => {
  const bad = [
    (f) => { f.deployment.releaseTag = "v8.15.17"; },
    (f) => { f.release.sourceCommit = "b".repeat(40); },
    (f) => { f.release.images[0] = { ...f.release.images[0], immutableReference: "backend:latest" }; },
    (f) => { f.deployment.images.backend = f.deployment.images.frontend; },
    (f) => { f.smoke[0].passed = false; },
    (f) => { f.smoke.pop(); },
    (f) => { f.smoke[0].name = "backend"; },
    (f) => { f.deployment.releaseManifestSha256 = "b".repeat(64); },
    (f) => { f.deployment.deployedAtUtc = "invalid"; },
  ];
  for (const mutate of bad) {
    const f = fixture();
    mutate(f);
    assert.throws(() => verifyArchivedModuleDeploymentEvidence(f));
  }
});

test("missing or unconfigured archive never guesses deployment success", async () => {
  const proof = await inspectModuleDeploymentProvenance(
    { effectiveAuthority: authority }, { evidenceDirectory: "" });
  assert.equal(proof.evidenceAvailable, false);
  assert.equal(proof.deploymentVerified, null);
  assert.equal(proof.productionAccepted, null);
  const broken = await inspectModuleDeploymentProvenance(
    { effectiveAuthority: authority }, {
      evidenceDirectory: "/var/lib/aiibp/deployment-evidence",
      readArtifact: async () => { throw new Error("secret: path"); },
    });
  assert.equal(broken.evidenceValidated, null);
  assert.doesNotMatch(JSON.stringify(broken), /secret|\/var\/lib/);
});

test("trusted configured files are read by fixed name, never by user-supplied path", async () => {
  const f = fixture();
  const calls = [];
  const map = {
    "deployment.json": JSON.stringify(f.deployment),
    "release-manifest.json": f.releaseRaw,
    "smoke-tests.json": JSON.stringify(f.smoke),
  };
  const verified = await inspectModuleDeploymentProvenance(
    { effectiveAuthority: authority }, {
      evidenceDirectory: "/opt/aiibp-evidence",
      readArtifact: async (directory, name) => {
        calls.push([directory, name]);
        return map[name];
      },
    });
  assert.equal(verified.deploymentVerified, true);
  assert.deepEqual(calls.map((row) => row[1]),
    ["deployment.json", "release-manifest.json", "smoke-tests.json"]);
});

test("selected location, missing permission and invalid business cannot inspect files", async () => {
  for (const attrs of [
    { locationAccessMode: "selected" },
    { permissions: [] },
    { businessId: "untrusted" },
  ]) {
    let called = false;
    assert.throws(() => assertModuleDeploymentEvidenceReader({
      ...authority, ...attrs,
    }));
    await assert.rejects(inspectModuleDeploymentProvenance({
      effectiveAuthority: { ...authority, ...attrs },
    }, {
      evidenceDirectory: "/opt/aiibp",
      readArtifact: async () => { called = true; return ""; },
    }));
    assert.equal(called, false);
  }
});

test("deployment provenance route is RBAC-protected and dashboard read-only", async () => {
  const [routes, frontend] = await Promise.all([
    readFile(new URL("../routes/systemAdministrationRoutes.js", import.meta.url), "utf8"),
    readFile(new URL("../../../frontend/src/pages/ModuleCatalogueDashboardPage.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(routes,
    /"\/module-catalogue\/deployment-provenance",\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*requirePermissions\("feature-control:read"\)/);
  assert.match(frontend, /API\.get\("\/system-administration\/module-catalogue\/deployment-provenance"\)/);
  assert.match(frontend, /historical deployment record does not prove current runtime health/i);
  assert.doesNotMatch(frontend, /API\.(post|put|patch|delete)\(/);
});
