import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function runNode(args, label) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error(`[FAIL] ${label}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[FAIL] ${label} exited with code ${result.status}.`);
    process.exit(result.status ?? 1);
  }

  console.log(`[PASS] ${label}`);
}

runNode(["scripts/checkSource.js"], "Backend syntax check");

try {
  await import(pathToFileURL(path.resolve("src/app.js")).href);
  console.log("[PASS] Backend application import");
} catch (error) {
  console.error("[FAIL] Backend application import");
  console.error(error);
  process.exit(1);
}

const testDirectory = path.resolve("src/test");
const testFiles = readdirSync(testDirectory)
  .filter((name) => name.endsWith(".test.js"))
  .sort()
  .map((name) => path.join("src", "test", name));

if (testFiles.length === 0) {
  console.error("[FAIL] No backend test files were found.");
  process.exit(1);
}

runNode(["--test", ...testFiles], `Backend test suite (${testFiles.length} files)`);

console.log("[PASS] Backend validation completed.");
