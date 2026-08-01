import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const evidenceDirectory = process.argv[2];
const releaseTag = process.argv[3];

if (!evidenceDirectory || !releaseTag) {
  console.error('Usage: node create-release-manifest.mjs <evidence-directory> <release-tag>');
  process.exit(1);
}

if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(releaseTag)) {
  throw new Error(`Invalid release tag: ${releaseTag}`);
}

const expectedServices = ['ai-service', 'backend', 'frontend'];
const imageEvidence = [];

for (const service of expectedServices) {
  const filePath = path.join(evidenceDirectory, `${service}.image.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing image evidence: ${filePath}`);
  }

  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (value.service !== service || value.tag !== releaseTag) {
    throw new Error(`Image evidence identity mismatch in ${filePath}`);
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(value.digest)) {
    throw new Error(`Invalid image digest in ${filePath}`);
  }
  imageEvidence.push(value);
}

imageEvidence.sort((left, right) => left.service.localeCompare(right.service));
const commits = new Set(imageEvidence.map((entry) => entry.commit));
if (commits.size !== 1) {
  throw new Error('All release images must be built from the same commit.');
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const sboms = expectedServices.map((service) => {
  const fileName = `${service}.cdx.json`;
  const filePath = path.join(evidenceDirectory, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing CycloneDX SBOM: ${filePath}`);
  }
  JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return { service, file: fileName, sha256: sha256(filePath) };
});

const scans = expectedServices.map((service) => {
  const fileName = `${service}.trivy.json`;
  const filePath = path.join(evidenceDirectory, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Trivy image report: ${filePath}`);
  }
  JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return { service, file: fileName, sha256: sha256(filePath) };
});

const manifest = {
  schemaVersion: 1,
  releaseTag,
  sourceCommit: [...commits][0],
  generatedAt: new Date().toISOString(),
  images: imageEvidence.map(({ service, image, digest }) => ({
    service,
    image,
    digest,
    immutableReference: `${image}@${digest}`,
  })),
  sboms,
  vulnerabilityReports: scans,
  attestations: {
    provenance: 'GitHub artifact attestation attached to each GHCR image digest',
    sbom: 'CycloneDX attestation attached to each GHCR image digest',
  },
};

const rollback = {
  schemaVersion: 1,
  releaseTag,
  sourceCommit: manifest.sourceCommit,
  generatedAt: manifest.generatedAt,
  purpose: 'Immutable references that can be used as the rollback target for a later release.',
  images: Object.fromEntries(manifest.images.map((entry) => [entry.service, entry.immutableReference])),
  instructions: [
    'Select the previously approved release manifest.',
    'Set each production image to its immutable image@sha256 digest.',
    'Run the production and required overlay Compose files together.',
    'Verify application health, observability and the release security gate.',
    'Do not use docker compose --remove-orphans when observability or backup overlays are running.',
  ],
};

fs.writeFileSync(path.join(evidenceDirectory, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(evidenceDirectory, 'rollback-metadata.json'), `${JSON.stringify(rollback, null, 2)}\n`);
console.log(`Created release manifest for ${releaseTag}.`);
