import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const DIST_ASSETS = path.resolve(
  process.cwd(),
  "dist",
  "assets"
);

const BUDGETS = Object.freeze({
  entryJsGzip: 120 * 1024,
  sharedCssGzip: 40 * 1024,
  anyJsGzip: 130 * 1024,
});

function kilobytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

async function assetRows() {
  const names = await readdir(
    DIST_ASSETS
  );

  return Promise.all(
    names
      .filter(
        (name) =>
          name.endsWith(".js") ||
          name.endsWith(".css")
      )
      .map(async (name) => {
        const data =
          await readFile(
            path.join(
              DIST_ASSETS,
              name
            )
          );

        return {
          name,
          bytes:
            data.byteLength,
          gzipBytes:
            gzipSync(data)
              .byteLength,
        };
      })
  );
}

function largest(
  rows,
  predicate
) {
  return rows
    .filter(predicate)
    .sort(
      (left, right) =>
        right.gzipBytes -
        left.gzipBytes
    )[0];
}

const rows =
  await assetRows();

const entry =
  largest(
    rows,
    (row) =>
      /^index-[^.]+\.js$/.test(
        row.name
      )
  );

const sharedCss =
  largest(
    rows,
    (row) =>
      /^index-[^.]+\.css$/.test(
        row.name
      )
  );

const largestJs =
  largest(
    rows,
    (row) =>
      row.name.endsWith(
        ".js"
      )
  );

if (
  !entry ||
  !sharedCss ||
  !largestJs
) {
  throw new Error(
    "Unable to identify the production entry JS/CSS assets for bundle-budget validation."
  );
}

const checks = [
  {
    label:
      "Shared entry JavaScript",
    asset: entry,
    budget:
      BUDGETS.entryJsGzip,
  },
  {
    label:
      "Shared stylesheet",
    asset:
      sharedCss,
    budget:
      BUDGETS.sharedCssGzip,
  },
  {
    label:
      "Largest JavaScript chunk",
    asset:
      largestJs,
    budget:
      BUDGETS.anyJsGzip,
  },
];

let failed = false;

console.log(
  "SalonAI frontend bundle budget"
);

for (
  const check
  of checks
) {
  const withinBudget =
    check.asset.gzipBytes <=
    check.budget;

  console.log(
    `${withinBudget ? "[PASS]" : "[FAIL]"} ${check.label}: ${check.asset.name} = ${kilobytes(check.asset.gzipBytes)} gzip (budget ${kilobytes(check.budget)})`
  );

  failed ||= !withinBudget;
}

console.log(
  `[INFO] Shared entry raw size: ${kilobytes(entry.bytes)}`
);
console.log(
  `[INFO] Shared CSS raw size: ${kilobytes(sharedCss.bytes)}`
);
console.log(
  `[INFO] Largest JS raw size: ${kilobytes(largestJs.bytes)}`
);

if (failed) {
  process.exitCode = 1;
}
