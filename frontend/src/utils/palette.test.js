import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(target);
    return /\.(css|js|jsx)$/.test(entry.name) && !entry.name.endsWith(".test.js") ? [target] : [];
  });
}

function hueAndSaturation(hex) {
  const [red, green, blue] = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta && maximum === red) hue = 60 * (((green - blue) / delta) % 6);
  if (delta && maximum === green) hue = 60 * ((blue - red) / delta + 2);
  if (delta && maximum === blue) hue = 60 * ((red - green) / delta + 4);
  if (hue < 0) hue += 360;
  return { hue, saturation: maximum ? delta / maximum : 0 };
}

test("interface source contains only neutral, gold and sand colour values", () => {
  const violations = [];
  for (const file of filesIn(root)) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const value = match[0].toLowerCase();
      const { hue, saturation } = hueAndSaturation(value);
      const neutral = saturation <= 0.13;
      const goldOrSand = hue >= 30 && hue <= 60;
      if (!neutral && !goldOrSand) violations.push(`${path.relative(root, file)}: ${value}`);
    }
  }
  assert.deepEqual(violations, []);
});

test("audited interactive UI does not use blue, indigo or navy utilities", () => {
  const auditedFiles = [
    path.join(root, "pages", "AdminStaffAccountsPage.jsx"),
    path.join(root, "pages", "StaffRoleManagementPage.jsx"),
    path.join(root, "components", "employees", "AddEmployeeModal.jsx"),
    path.join(root, "components", "communications", "CampaignComposerModal.jsx"),
    path.join(root, "components", "communications", "CampaignPreviewModal.jsx"),
    path.join(root, "components", "communications", "CommunicationTemplateModal.jsx"),
    path.join(root, "components", "communications", "CommunicationTemplatePreviewModal.jsx"),
    path.join(root, "components", "customers", "CustomerContactModal.jsx"),
  ];
  const violations = [];

  for (const file of auditedFiles) {
    const source = fs.readFileSync(file, "utf8");
    const utilityPattern =
      /\b(?:bg|text|border|ring|outline|accent|from|via|to)-(?:blue|indigo|navy)(?:-\d{2,3})?\b/gi;

    for (const match of source.matchAll(utilityPattern)) {
      violations.push(
        `${path.relative(root, file)}: ${match[0]}`
      );
    }
  }

  assert.deepEqual(violations, []);
});


test("approved SalonAI controls use lighter gold with black text", () => {
  const source = fs.readFileSync(
    path.join(root, "index.css"),
    "utf8"
  );

  assert.match(
    source,
    /--palette-gold:\s*#d8b84a;/i
  );
  assert.match(
    source,
    /\.app-button-primary\s*\{[^}]*color:\s*var\(--palette-black\)/s
  );
  assert.match(
    source,
    /\.navbar-register-link\s*\{[^}]*color:\s*var\(--palette-black\)/s
  );
  assert.match(
    source,
    /Approved SalonAI light-gold controls use black text for WCAG contrast/
  );
});
