import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const validator = path.join(import.meta.dirname, 'validate-deployment-evidence.mjs');
const releaseTag = 'v8.0.0';
const sourceCommit = '42c79e32a0af0fe6190397aa4061481a05b6051c';
const services = ['ai-service', 'backend', 'frontend'];

function digest(character) {
  return `sha256:${character.repeat(64)}`;
}

function buildEvidence() {
  const images = services.map((service, index) => {
    const image = `ghcr.io/francescoguerriero/salonai-${service}`;
    const imageDigest = digest(String(index + 1));
    return {
      service,
      image,
      digest: imageDigest,
      immutableReference: `${image}@${imageDigest}`,
    };
  });

  return {
    manifest: {
      schemaVersion: 1,
      releaseTag,
      sourceCommit,
      images,
    },
    rollback: {
      schemaVersion: 1,
      releaseTag,
      sourceCommit,
      images: Object.fromEntries(
        images.map((image) => [image.service, image.immutableReference]),
      ),
    },
  };
}

function writeEvidence(directory, evidence, checksumFiles = true) {
  const files = {
    'release-manifest.json': `${JSON.stringify(evidence.manifest, null, 2)}\n`,
    'rollback-metadata.json': `${JSON.stringify(evidence.rollback, null, 2)}\n`,
  };

  for (const [fileName, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(directory, fileName), content);
  }

  const includedFiles = checksumFiles ? Object.keys(files) : ['release-manifest.json'];
  const checksumText = includedFiles
    .map((fileName) => {
      const hash = crypto.createHash('sha256').update(files[fileName]).digest('hex');
      return `${hash}  ${fileName}`;
    })
    .join('\n');
  fs.writeFileSync(path.join(directory, 'SHA256SUMS.txt'), `${checksumText}\n`);
}

function validate(directory, expectedCommit = sourceCommit) {
  return spawnSync(
    process.execPath,
    [validator, directory, releaseTag, expectedCommit],
    { encoding: 'utf8' },
  );
}

function expectFailure(mutator, expectedMessage, checksumFiles = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salonai-evidence-test-'));
  try {
    const evidence = buildEvidence();
    mutator(evidence);
    writeEvidence(directory, evidence, checksumFiles);
    const result = validate(directory);
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(`${result.stdout}\n${result.stderr}`, expectedMessage);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

const validDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'salonai-evidence-test-'));
try {
  writeEvidence(validDirectory, buildEvidence());
  const result = validate(validDirectory);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Verified deployment evidence for v8\.0\.0/);
} finally {
  fs.rmSync(validDirectory, { recursive: true, force: true });
}

expectFailure(
  (evidence) => {
    evidence.rollback.images.backend = `${evidence.rollback.images.backend.slice(0, -1)}f`;
  },
  /Rollback metadata does not match backend/,
);

expectFailure(
  (evidence) => {
    evidence.manifest.images.push({
      service: 'edge',
      image: 'ghcr.io/francescoguerriero/salonai-edge',
      digest: digest('a'),
      immutableReference: `ghcr.io/francescoguerriero/salonai-edge@${digest('a')}`,
    });
  },
  /Unexpected or duplicate release service: edge/,
);

expectFailure(
  () => {},
  /SHA256SUMS\.txt does not cover rollback-metadata\.json/,
  false,
);

const mismatchedCommitDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'salonai-evidence-test-'),
);
try {
  writeEvidence(mismatchedCommitDirectory, buildEvidence());
  const result = validate(mismatchedCommitDirectory, 'a'.repeat(40));
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /release manifest commit does not match/);
} finally {
  fs.rmSync(mismatchedCommitDirectory, { recursive: true, force: true });
}

console.log('[PASS] Deployment evidence validator regression tests passed.');
