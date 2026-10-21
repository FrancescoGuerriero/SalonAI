import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const OUTPUT_TAIL_LIMIT = 12_000;

function appendTail(current, chunk) {
  const combined = `${current}${chunk}`;
  return combined.length <= OUTPUT_TAIL_LIMIT
    ? combined
    : combined.slice(-OUTPUT_TAIL_LIMIT);
}

function githubAnnotationText(value) {
  return String(value ?? "")
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

async function runNode(args, label) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      shell: false,
      stdio: ["inherit", "pipe", "pipe"],
    });

    let outputTail = "";

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      outputTail = appendTail(outputTail, chunk.toString());
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      outputTail = appendTail(outputTail, chunk.toString());
    });

    child.once("error", (error) => {
      reject(new Error(`[FAIL] ${label}: ${error.message}`));
    });

    child.once("close", (code, signal) => {
      if (code === 0) {
        console.log(`[PASS] ${label}`);
        resolve();
        return;
      }

      const termination = signal
        ? `signal ${signal}`
        : `code ${code ?? "unknown"}`;
      const detail = outputTail.trim() || "No child-process output was captured.";
      const failure = new Error(
        `[FAIL] ${label} exited with ${termination}.\n${detail}`
      );
      reject(failure);
    });
  }).catch((error) => {
    const message = error?.message || String(error);
    if (process.env.GITHUB_ACTIONS === "true") {
      console.error(
        `::error title=${githubAnnotationText(label)}::${githubAnnotationText(message)}`
      );
    }
    console.error(message);
    process.exit(1);
  });
}

await runNode(["scripts/checkSource.js"], "Backend syntax check");

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

for (const testFile of testFiles) {
  await runNode(
    ["--test", testFile],
    `Backend diagnostic test (${testFile})`
  );
}

console.log("[PASS] Backend diagnostic validation completed.");
