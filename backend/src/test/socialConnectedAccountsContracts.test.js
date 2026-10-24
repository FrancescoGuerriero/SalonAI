import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("connected social accounts are tenant-owned and keep provider secrets write-only", async () => {
  const service = await source(
    "../features/integrationPlatform/socialConnectedAccountsService.js"
  );
  const credentialService = await source(
    "../features/integrationPlatform/providerCredentialService.js"
  );

  assert.match(service, /business:\s*businessId/);
  assert.match(service, /storeProviderCredential/);
  assert.match(service, /role:\s*"access_token"/);
  assert.match(service, /CONNECTED_ACCOUNT_ACCESS_TOKEN_REQUIRED/);
  assert.match(service, /credentialStored/);
  assert.match(service, /CredentialVersion\.updateMany/);
  assert.match(service, /status:\s*"revoked"/);
  assert.doesNotMatch(service, /secretCiphertext|secretIv|secretTag/);

  assert.match(credentialService, /encryptIntegrationSecret\(secret\)/);
  assert.match(credentialService, /secretReturned:\s*false/);
  assert.match(credentialService, /delete value\.secretCiphertext/);
  assert.match(credentialService, /business:\s*businessId/);
});

test("connected-account routes preserve read/write RBAC boundaries", async () => {
  const routes = await source(
    "../features/integrationPlatform/integrationPlatformRoutes.js"
  );
  const controller = await source(
    "../features/integrationPlatform/socialConnectedAccountsController.js"
  );

  assert.match(routes, /const read = requirePermissions\("feature-control:read"\)/);
  assert.match(routes, /const write = requirePermissions\("feature-control:update"\)/);
  assert.match(routes, /"\/connected-accounts"[\s\S]*?read/);
  assert.match(routes, /"\/connected-accounts\/:provider"[\s\S]*?write/);
  assert.match(routes, /"\/connected-accounts\/:provider\/disconnect"[\s\S]*?write/);
  assert.match(controller, /effectiveAuthority\?\.businessId/);
  assert.match(controller, /tenantContext\?\.businessId/);
});

test("connected-account UI exposes only the four approved social providers and keeps messaging work on hold", async () => {
  const service = await source(
    "../features/integrationPlatform/socialConnectedAccountsService.js"
  );
  const page = await source(
    "../../../frontend/src/pages/ConnectedAccountsPage.jsx"
  );
  const api = await source(
    "../../../frontend/src/Services/socialConnectedAccountsApi.js"
  );
  const router = await source(
    "../../../frontend/src/components/stage5/Stage5WorkspaceRouter.jsx"
  );
  const navigation = await source(
    "../../../frontend/src/components/navigation/managementNavigationConfig.js"
  );

  for (const provider of [
    "facebook",
    "instagram",
    "linkedin",
    "google_business_profile",
  ]) {
    assert.match(service, new RegExp(`${provider}: Object\\.freeze`));
  }

  assert.match(page, /Connected accounts/);
  assert.match(page, /type="password"/);
  assert.match(page, /never returned to the browser/);
  assert.match(page, /Twilio and transactional\/marketing email connections are on hold/);
  assert.match(page, /connection does not activate publishing/);
  assert.match(api, /\/integration-platform\/connected-accounts/);
  assert.match(router, /\/admin\/system\/connected-accounts/);
  assert.match(navigation, /"\/admin\/system\/connected-accounts", "Connected accounts"/);
});
