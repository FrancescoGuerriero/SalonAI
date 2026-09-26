import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(relativePath, import.meta.url),
    "utf8"
  );
}

test(
  "admin overview uses canonical dashboard permission instead of role-only routes",
  async () => {
    const app = await source(
      "../../../frontend/src/App.jsx"
    );
    const navigation = await source(
      "../../../frontend/src/components/navigation/managementNavigationConfig.js"
    );

    assert.match(
      app,
      /path="admin"[\s\S]{0,180}permissionPage\(\s*AdminDashboard,\s*"dashboard:view"\s*\)/
    );

    assert.doesNotMatch(
      app,
      /AdminRoute|ManagementRoute|adminPage\(|managementPage\(/
    );

    assert.match(
      navigation,
      /\["\/admin",[^\n]*false,\s*"dashboard:view"/
    );
  }
);
