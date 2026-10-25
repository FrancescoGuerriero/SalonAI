import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  dataHubCatalogue,
  normaliseDataHubQuery,
} from "../features/integrationPlatform/dataHubService.js";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Stage 8 Data Hub query contract normalises and bounds fields", () => {
  const query = normaliseDataHubQuery({
    dateRange: { rollingDays: 99999 },
    dateGrain: "MONTH",
    dimensions: ["campaign", "provider", "campaign"],
    metrics: ["clicks", "impressions", "spend"],
    calculatedMetrics: ["CTR", "roas"],
    rowLimit: 50000,
  });

  assert.equal(query.dateRange.rollingDays, 3650);
  assert.equal(query.dateGrain, "month");
  assert.deepEqual(query.dimensions, ["dimensions.campaign", "provider"]);
  assert.deepEqual(query.metrics, ["metrics.clicks", "metrics.impressions", "metrics.spend"]);
  assert.deepEqual(query.calculatedMetrics, ["ctr", "roas"]);
  assert.equal(query.rowLimit, 1000);
});

test("Stage 8 Data Hub rejects unsafe field and calculated-metric references", () => {
  assert.throws(
    () => normaliseDataHubQuery({ dimensions: ["$where"] }),
    /Unsupported Data Hub field reference/
  );
  assert.throws(
    () => normaliseDataHubQuery({ metrics: ["metrics.clicks.$gt"] }),
    /Unsupported Data Hub field reference/
  );
  assert.throws(
    () => normaliseDataHubQuery({ calculatedMetrics: ["magic_roi"] }),
    /Unsupported calculated metric/
  );
});

test("Stage 8 catalogue extends Stage 5 sources and keeps destinations preview-only", () => {
  const catalogue = dataHubCatalogue();
  assert.equal(catalogue.version, "1.0.0");
  assert.ok(catalogue.sourceConnectors.some((connector) => connector.key === "ga4"));
  assert.ok(catalogue.sourceConnectors.some((connector) => connector.key === "generic"));
  assert.ok(catalogue.plannedSourceBlueprints.some((connector) => connector.key === "google_ads"));
  assert.ok(catalogue.destinations.some((destination) => destination.key === "bigquery"));
  assert.ok(catalogue.destinations.some((destination) => destination.key === "mcp_ai"));
  assert.ok(catalogue.destinations.every((destination) => destination.liveExecutionAuthorised === false));
  assert.equal(catalogue.safety.tenantScoped, true);
  assert.equal(catalogue.safety.destinationExecutionAuthorised, false);
  assert.equal(catalogue.safety.aiActionsAuthorised, false);
});

test("Stage 8 Data Hub models preserve tenant ownership and fail-safe execution defaults", async () => {
  const [viewModel, destinationModel, runModel] = await Promise.all([
    source("../models/DataHubSavedView.js"),
    source("../models/DataHubDestinationTask.js"),
    source("../models/DataHubDestinationRun.js"),
  ]);

  assert.match(viewModel, /business:[\s\S]*required:\s*true/);
  assert.match(viewModel, /business:\s*1,\s*key:\s*1/);
  assert.match(destinationModel, /business:[\s\S]*required:\s*true/);
  assert.match(destinationModel, /humanApprovalRequired:[\s\S]*default:\s*true/);
  assert.match(destinationModel, /executionAuthorised:[\s\S]*default:\s*false/);
  assert.match(runModel, /executionAuthorised:[\s\S]*default:\s*false/);
});

test("Stage 8 Data Hub service queries canonical normalised records and blocks secret config", async () => {
  const service = await source("../features/integrationPlatform/dataHubService.js");
  assert.match(service, /MarketingNormalisedRecord\.find\(match\)/);
  assert.match(service, /business:\s*businessId/);
  assert.match(service, /DATA_HUB_QUERY_SCAN_LIMIT/);
  assert.match(service, /FORBIDDEN_CONFIG_KEY/);
  assert.match(service, /store credentials in IntegrationApp credential versions/);
  assert.match(service, /externalWriteActionsAuthorised:\s*false/);
  assert.doesNotMatch(service, /createPaymentIntent|chargeCard|capturePayment/);
});

test("Stage 8 Data Hub API is permission protected and mounted under Integration Platform", async () => {
  const [routes, parentRoutes, controller] = await Promise.all([
    source("../features/integrationPlatform/dataHubRoutes.js"),
    source("../features/integrationPlatform/integrationPlatformRoutes.js"),
    source("../features/integrationPlatform/dataHubController.js"),
  ]);

  assert.match(routes, /const read = requirePermissions\("feature-control:read"\)/);
  assert.match(routes, /const write = requirePermissions\("feature-control:update"\)/);
  assert.match(routes, /\/catalogue/);
  assert.match(routes, /\/query/);
  assert.match(routes, /\/ai-evidence/);
  assert.match(routes, /\/saved-views/);
  assert.match(routes, /\/destinations/);
  assert.match(routes, /\/destinations\/:taskId\/preview/);
  assert.match(parentRoutes, /router\.use\(\s*"\/data-hub"/);
  assert.match(controller, /effectiveAuthority\?\.businessId/);
  assert.match(controller, /tenantContext\?\.businessId/);
});

test("Stage 8 management workspace exposes governed Data Hub tasks", async () => {
  const [page, service, router, navigation] = await Promise.all([
    source("../../../frontend/src/pages/DataHubPage.jsx"),
    source("../../../frontend/src/Services/dataHubService.js"),
    source("../../../frontend/src/components/stage8/Stage8WorkspaceRouter.jsx"),
    source("../../../frontend/src/components/navigation/managementNavigationConfig.js"),
  ]);

  assert.match(page, /AIIBP Data Hub/);
  assert.match(page, /Cross-source query builder/);
  assert.match(page, /Destination tasks/);
  assert.match(page, /Governed mode/);
  assert.match(page, /live external writes and AI actions remain disabled/);
  assert.match(service, /integration-platform\/data-hub/);
  assert.match(service, /ai-evidence/);
  assert.match(router, /\/admin\/system\/data-hub/);
  assert.match(router, /feature-control:read/);
  assert.match(navigation, /AIIBP Data Hub/);
});
