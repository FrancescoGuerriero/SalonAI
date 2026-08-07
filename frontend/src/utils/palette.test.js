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
