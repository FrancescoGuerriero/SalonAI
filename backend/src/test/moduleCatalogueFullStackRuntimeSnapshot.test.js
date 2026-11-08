import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  verifyFullStackRuntimeSnapshot,
  inspectFullStackRuntimeSnapshot,
} from "../features/moduleCatalogue/moduleCatalogueFullStackRuntimeSnapshot.js";

const BUSINESS = "507f1f77bcf86cd799439021";
const authority = {
  businessId: BUSINESS, locationAccessMode: "all",
  permissions: ["feature-control:read"],
};
const TAG = "v8.15.18";
const COMMIT = "a".repeat(40);
const NOW = new Date("2026-11-08T16:20:00.000Z");
const names = {
  "ai-service": "salonai-ai-service",
  backend: "salonai-backend",
  frontend: "salonai-frontend",
};
const reference = (service, i) =>
  `ghcr.io/francescoguerriero/salonai-${service}@sha256:${String(i + 1).repeat(64)}`;
function build() {
  const release = {
    releaseTag: TAG, sourceCommit: COMMIT,
    images: Object.keys(names).map((service, i) => ({
      service, immutableReference: reference(service, i),
    })),
  };
  const snapshot = {
    schemaVersion: 1, environment: "production", releaseTag: TAG,
    sourceCommit: COMMIT, collectedAtUtc: "2026-11-08T16:19:00.000Z",
    services: release.images.map(({ service, immutableReference }, i) => ({
      service, containerName: names[service],
      state: "running", health: "healthy",
      imageId: `sha256:${String(i + 4).repeat(64)}`,
      configuredImage: immutableReference,
      repoDigests: [immutableReference],
    })),
  };
  const releaseRaw = JSON.stringify(release);
  return {
    snapshot, release, releaseRaw,
    archive: {
      releaseManifestSha256: createHash("sha256").update(releaseRaw).digest("hex"),
      evidenceValidated: true, deploymentVerified: true,
      releaseTag: TAG, sourceCommit: COMMIT,
    },
    now: NOW,
  };
}
test("recent full-stack snapshot matches three exact image digest and health observations", () => {
  const result = verifyFullStackRuntimeSnapshot(build());
  assert.equal(result.snapshotEvidenceValid, true);
  assert.equal(result.serviceCount, 3);
  assert.equal(result.services.every((row) => row.digestMatched && row.health === "healthy"), true);
  assert.equal(result.currentReleaseVerified, null);
  assert.equal(result.runtimeVerified, null);
  assert.equal(result.productionAccepted, null);
  assert.equal(result.activationAuthorised, false);
  assert.equal(Object.hasOwn(result, "imageId"), false);
});

test("stale, future, mismatched, duplicate, unhealthy or unapproved image evidence is rejected", () => {
  const mutations = [
    (f) => { f.snapshot.collectedAtUtc = "2026-11-08T16:00:00Z"; },
    (f) => { f.snapshot.collectedAtUtc = "2026-11-08T16:21:00Z"; },
    (f) => { f.snapshot.sourceCommit = "b".repeat(40); },
    (f) => { f.snapshot.releaseTag = "v8.15.17"; },
    (f) => { f.snapshot.services[0].health = "unhealthy"; },
    (f) => { f.snapshot.services[0].state = "exited"; },
    (f) => { f.snapshot.services[0].containerName = "unknown"; },
    (f) => { f.snapshot.services[0].configuredImage = reference("backend", 1); },
    (f) => { f.snapshot.services[0].repoDigests = [reference("backend", 1)]; },
    (f) => { f.snapshot.services[0].imageId = "sha256:bad"; },
    (f) => { f.snapshot.services[1] = { ...f.snapshot.services[0] }; },
    (f) => { f.snapshot.services.pop(); },
    (f) => { f.release.images.pop(); },
    (f) => { f.archive.evidenceValidated = null; },
    (f) => { f.archive.releaseManifestSha256 = "b".repeat(64); },
  ];
  for (const mutate of mutations) {
    const f = build();
    mutate(f);
    const result = verifyFullStackRuntimeSnapshot(f);
    assert.equal(result.snapshotEvidenceValid, false);
    assert.equal(result.runtimeVerified, null);
    assert.equal(result.productionAccepted, null);
  }
});

test("unconfigured source and malformed host artifacts never imply current deployment", async () => {
  const empty = await inspectFullStackRuntimeSnapshot({
    effectiveAuthority: authority,
  }, { evidenceDirectory: "" });
  assert.equal(empty.snapshotEvidenceValid, null);
  assert.equal(empty.currentReleaseVerified, null);
  const bad = await inspectFullStackRuntimeSnapshot({
    effectiveAuthority: authority,
  }, {
    evidenceDirectory: "/srv/aiibp/evidence",
    archivedInspector: async () => build().archive,
    readArtifact: async () => { throw new Error("host-secret"); },
  });
  assert.equal(bad.snapshotEvidenceValid, null);
  assert.doesNotMatch(JSON.stringify(bad), /host-secret|\/srv\/aiibp/);
});

test("trusted source requires archive verification and reads fixed artifact basenames", async () => {
  const f = build();
  const calls = [];
  const result = await inspectFullStackRuntimeSnapshot({
    effectiveAuthority: authority,
  }, {
    evidenceDirectory: "/srv/evidence",
    now: NOW,
    archivedInspector: async () => f.archive,
    readArtifact: async (_directory, name) => {
      calls.push(name);
      return name === "runtime-snapshot.json"
        ? JSON.stringify(f.snapshot) : f.releaseRaw;
    },
  });
  assert.equal(result.snapshotEvidenceValid, true);
  assert.deepEqual(calls, ["runtime-snapshot.json", "release-manifest.json"]);
});

test("missing permissions and selected location are rejected before any artifact reads", async () => {
  for (const override of [
    { permissions: [] },
    { locationAccessMode: "selected" },
    { businessId: "not-trusted" },
  ]) {
    let touched = false;
    await assert.rejects(inspectFullStackRuntimeSnapshot({
      effectiveAuthority: { ...authority, ...override },
    }, {
      evidenceDirectory: "/srv/evidence",
      archivedInspector: async () => { touched = true; return build().archive; },
    }));
    assert.equal(touched, false);
  }
});

test("dashboard endpoint uses trusted authority and never writes operational state", async () => {
  const [routes, page, script] = await Promise.all([
    readFile(new URL("../routes/systemAdministrationRoutes.js", import.meta.url), "utf8"),
    readFile(new URL("../../../frontend/src/pages/ModuleCatalogueDashboardPage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../../scripts/deployment/Get-ReadOnlyRuntimeSnapshot.ps1", import.meta.url), "utf8"),
  ]);
  assert.match(routes, /"\/module-catalogue\/fullstack-runtime-snapshot",\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*requirePermissions\("feature-control:read"\)/);
  assert.match(page, /API\.get\("\/system-administration\/module-catalogue\/fullstack-runtime-snapshot"\)/);
  assert.doesNotMatch(page, /API\.(post|put|patch|delete)\(/);
  assert.match(script, /docker inspect --type container/);
  assert.doesNotMatch(script, /docker compose up|docker restart|docker exec/);
});
