#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const [, , lockPath, packageName] = process.argv;

if (!lockPath || !packageName) {
  console.error("Usage: node read-package-lock-versions.cjs <package-lock.json> <package-name>");
  process.exit(2);
}

let document;
try {
  document = JSON.parse(fs.readFileSync(lockPath, "utf8"));
} catch (error) {
  console.error(`Unable to parse package lockfile: ${error.message}`);
  process.exit(3);
}

const versions = new Set();
const expectedSuffix = `/node_modules/${packageName}`;

if (document.packages && typeof document.packages === "object") {
  for (const [rawPath, metadata] of Object.entries(document.packages)) {
    if (!metadata || typeof metadata !== "object" || typeof metadata.version !== "string") {
      continue;
    }

    const packagePath = String(rawPath).replace(/\\/g, "/");
    if (packagePath === `node_modules/${packageName}` || packagePath.endsWith(expectedSuffix)) {
      versions.add(metadata.version);
    }
  }
}

function visitDependencies(dependencies) {
  if (!dependencies || typeof dependencies !== "object") {
    return;
  }

  for (const [name, metadata] of Object.entries(dependencies)) {
    if (!metadata || typeof metadata !== "object") {
      continue;
    }

    if (name === packageName && typeof metadata.version === "string") {
      versions.add(metadata.version);
    }

    visitDependencies(metadata.dependencies);
  }
}

visitDependencies(document.dependencies);

for (const version of [...versions].sort()) {
  process.stdout.write(`${version}\n`);
}
