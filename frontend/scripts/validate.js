import { spawnSync } from "node:child_process";
import path from "node:path";

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

const testFiles = [
  path.join("src", "utils", "stylists.test.js"),
  path.join("src", "features", "roadmap", "roadmapFeatures.test.js"),
  path.join("src", "utils", "palette.test.js"),
  path.join("src", "utils", "csv.test.js"),
];

runNode(["--test", ...testFiles], "Frontend test suite");

const viteCli = path.join("node_modules", "vite", "bin", "vite.js");
runNode([viteCli, "build"], "Frontend production build");

console.log("[PASS] Frontend validation completed.");
