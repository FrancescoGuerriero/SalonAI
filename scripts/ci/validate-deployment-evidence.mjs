import fs from 'node:fs';
import path from 'node:path';

const [evidenceDirectory, expectedReleaseTag, expectedSourceCommit] = process.argv.slice(2);

if (!evidenceDirectory || !expectedReleaseTag || !expectedSourceCommit) {
  console.error(
    'Usage: node validate-deployment-evidence.mjs <evidence-directory> <release-tag> <source-commit>',
  );
  process.exit(1);
}

if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(expectedReleaseTag)) {
  throw new Error(`Invalid expected release tag: ${expectedReleaseTag}`);
}

if (!/^[a-f0-9]{40}$/.test(expectedSourceCommit)) {
  throw new Error(`Invalid expected source commit: ${expectedSourceCommit}`);
}

function readJson(fileName) {
  const filePath = path.join(evidenceDirectory, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing release evidence: ${fileName}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const checksumPath = path.join(evidenceDirectory, 'SHA256SUMS.txt');
if (!fs.existsSync(checksumPath)) {
  throw new Error('Missing release evidence: SHA256SUMS.txt');
}

const checksumEntries = new Set(
  fs
    .readFileSync(checksumPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^[a-f0-9]{64}\s+\*?(.+)$/);
      if (!match) throw new Error(`Invalid SHA256SUMS entry: ${line}`);
      return match[1];
    }),
);

for (const fileName of ['release-manifest.json', 'rollback-metadata.json']) {
  if (!checksumEntries.has(fileName)) {
    throw new Error(`SHA256SUMS.txt does not cover ${fileName}`);
  }
}

const manifest = readJson('release-manifest.json');
const rollback = readJson('rollback-metadata.json');

if (manifest.schemaVersion !== 1 || rollback.schemaVersion !== 1) {
  throw new Error('Unsupported release evidence schema version.');
}

for (const [name, value] of [
  ['release manifest tag', manifest.releaseTag],
  ['rollback metadata tag', rollback.releaseTag],
]) {
  if (value !== expectedReleaseTag) {
    throw new Error(`${name} does not match ${expectedReleaseTag}.`);
  }
}

for (const [name, value] of [
  ['release manifest commit', manifest.sourceCommit],
  ['rollback metadata commit', rollback.sourceCommit],
]) {
  if (value !== expectedSourceCommit) {
    throw new Error(`${name} does not match ${expectedSourceCommit}.`);
  }
}

const expectedServices = ['ai-service', 'backend', 'frontend'];
const manifestImages = new Map();

for (const image of manifest.images ?? []) {
  if (!expectedServices.includes(image.service) || manifestImages.has(image.service)) {
    throw new Error(`Unexpected or duplicate release service: ${image.service}`);
  }
  if (!/^ghcr\.io\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/.test(image.immutableReference)) {
    throw new Error(`Invalid immutable image reference for ${image.service}.`);
  }
  if (image.immutableReference !== `${image.image}@${image.digest}`) {
    throw new Error(`Image identity mismatch for ${image.service}.`);
  }
  manifestImages.set(image.service, image.immutableReference);
}

for (const service of expectedServices) {
  if (!manifestImages.has(service)) {
    throw new Error(`Release manifest is missing ${service}.`);
  }
  if (rollback.images?.[service] !== manifestImages.get(service)) {
    throw new Error(`Rollback metadata does not match ${service}.`);
  }
}

if (Object.keys(rollback.images ?? {}).sort().join(',') !== expectedServices.sort().join(',')) {
  throw new Error('Rollback metadata contains an unexpected service set.');
}

console.log(`[PASS] Verified deployment evidence for ${expectedReleaseTag}.`);
