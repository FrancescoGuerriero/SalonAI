#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, "..");
const manifest = JSON.parse(
  await readFile(resolve(frontendRoot, "figma/aiibp.tokens.json"), "utf8")
);
const accessToken = String(process.env.FIGMA_ACCESS_TOKEN || "").trim();

if (!accessToken) {
  throw new Error("FIGMA_ACCESS_TOKEN is required for Figma identity validation.");
}

const response = await fetch(
  `https://api.figma.com/v1/files/${manifest.figmaFileKey}/variables/local`,
  { headers: { "X-Figma-Token": accessToken } }
);
const body = await response.json().catch(() => null);
if (!response.ok) {
  const detail = body?.message || body?.err || body?.error || response.statusText;
  if (response.status === 403) {
    throw new Error(
      `Figma identity validation is unavailable: ${detail}. Enterprise Variables API access, file permission and file_variables:read are required.`
    );
  }
  throw new Error(`Figma identity validation failed (${response.status}): ${detail}`);
}

const collections = Object.values(body?.meta?.variableCollections || {});
const variables = Object.values(body?.meta?.variables || {});
const collectionById = new Map(collections.map((item) => [item.id, item]));
const collectionByName = new Map(collections.map((item) => [item.name, item]));
const variableById = new Map(variables.map((item) => [item.id, item]));
const variableByQualifiedName = new Map(
  variables.map((item) => [
    `${collectionById.get(item.variableCollectionId)?.name || "unknown"}::${item.name}`,
    item,
  ])
);
const errors = [];

for (const expected of manifest.collections) {
  const actualById = collectionById.get(expected.figmaId);
  const actualByName = collectionByName.get(expected.name);
  if (!actualById) {
    errors.push(
      actualByName
        ? `${expected.name}: collection was recreated (${expected.figmaId} -> ${actualByName.id}); explicit manifest migration required`
        : `${expected.name}: collection ${expected.figmaId} is missing`
    );
    continue;
  }
  if (actualById.name !== expected.name) {
    errors.push(
      `${expected.figmaId}: collection identity changed (${expected.name} -> ${actualById.name}); explicit migration required`
    );
    continue;
  }
  const modeById = actualById.modes?.find((mode) => mode.modeId === expected.mode.figmaId);
  const modeByName = actualById.modes?.find((mode) => mode.name === expected.mode.name);
  if (!modeById) {
    errors.push(
      modeByName
        ? `${expected.name}/${expected.mode.name}: mode was recreated (${expected.mode.figmaId} -> ${modeByName.modeId}); explicit migration required`
        : `${expected.name}/${expected.mode.name}: mode ${expected.mode.figmaId} is missing`
    );
  } else if (modeById.name !== expected.mode.name) {
    errors.push(
      `${expected.name}/${expected.mode.figmaId}: mode identity changed (${expected.mode.name} -> ${modeById.name})`
    );
  }
}

for (const expected of manifest.tokens) {
  const actualById = variableById.get(expected.figmaId);
  const actualByName = variableByQualifiedName.get(
    `${expected.collection}::${expected.name}`
  );
  if (!actualById) {
    errors.push(
      actualByName
        ? `${expected.collection}/${expected.name}: variable was recreated (${expected.figmaId} -> ${actualByName.id}); explicit manifest migration required`
        : `${expected.collection}/${expected.name}: variable ${expected.figmaId} is missing`
    );
    continue;
  }
  const collectionName = collectionById.get(actualById.variableCollectionId)?.name || "unknown";
  if (actualById.name !== expected.name || collectionName !== expected.collection) {
    errors.push(
      `${expected.figmaId}: identity changed; expected ${expected.collection}/${expected.name}, found ${collectionName}/${actualById.name}`
    );
  }
  if (actualById.resolvedType !== expected.type) {
    errors.push(
      `${expected.collection}/${expected.name}: type changed (${expected.type} -> ${actualById.resolvedType})`
    );
  }
}

if (errors.length) {
  throw new Error(`Figma stable-identity guard failed:\n- ${errors.join("\n- ")}`);
}

process.stdout.write(
  `Validated stable Figma identities for ${manifest.collections.length} collections and ${manifest.tokens.length} variables.\n`
);
