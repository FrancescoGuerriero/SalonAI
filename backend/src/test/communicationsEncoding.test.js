import assert from "node:assert/strict";
import {
  readdir,
  readFile,
} from "node:fs/promises";
import path from "node:path";
import {
  fileURLToPath,
} from "node:url";
import test from "node:test";

const featuresRoot =
  fileURLToPath(
    new URL(
      "../features/",
      import.meta.url
    )
  );

async function javascriptFiles(
  directory
) {
  const entries =
    await readdir(
      directory,
      {
        withFileTypes: true,
      }
    );

  const files = [];

  for (const entry of entries) {
    const fullPath =
      path.join(
        directory,
        entry.name
      );

    if (entry.isDirectory()) {
      files.push(
        ...await javascriptFiles(
          fullPath
        )
      );

      continue;
    }

    if (
      entry.isFile() &&
      entry.name.endsWith(".js")
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

test(
  "customer-facing feature source contains no mojibake pound signs",
  async () => {
    const badPound =
      "\u00c2\u00a3";

    const files =
      await javascriptFiles(
        featuresRoot
      );

    const offenders = [];

    for (const file of files) {
      const content =
        await readFile(
          file,
          "utf8"
        );

      if (
        content.includes(
          badPound
        )
      ) {
        offenders.push(
          path.relative(
            featuresRoot,
            file
          )
        );
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Mojibake pound signs found in: ${offenders.join(", ")}`
    );
  }
);