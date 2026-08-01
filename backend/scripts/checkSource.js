import {
  readdir,
} from "node:fs/promises";
import path from "node:path";
import {
  spawnSync,
} from "node:child_process";

const sourceRoots = [
  path.resolve("src"),
  path.resolve("scripts"),
  path.resolve("test"),
];

async function collectJavaScriptFiles(
  directory
) {
  let entries;

  try {
    entries =
      await readdir(
        directory,
        {
          withFileTypes: true,
        }
      );
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const files = [];

  for (const entry of entries) {
    const entryPath =
      path.join(
        directory,
        entry.name
      );

    if (entry.isDirectory()) {
      files.push(
        ...await collectJavaScriptFiles(
          entryPath
        )
      );
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".js")
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

const files = (
  await Promise.all(
    sourceRoots.map(
      collectJavaScriptFiles
    )
  )
).flat();

let failed = false;

for (const file of files) {
  const result =
    spawnSync(
      process.execPath,
      [
        "--check",
        file,
      ],
      {
        encoding: "utf8",
      }
    );

  if (result.status !== 0) {
    failed = true;
    process.stderr.write(
      result.stderr ||
      `Syntax check failed: ${file}\n`
    );
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(
    `Syntax check passed for ${files.length} JavaScript files.`
  );
}
