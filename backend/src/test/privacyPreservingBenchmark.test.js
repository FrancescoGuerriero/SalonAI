import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("benchmark participation is explicit and append-only", async () => {
  const [model, service] = await Promise.all([
    source("../models/BenchmarkParticipation.js"),
    source("../features/benchmarking/benchmarkService.js"),
  ]);

  assert.match(model, /BENCHMARK_PARTICIPATION_IMMUTABLE/);
  assert.match(model, /aggregate_benchmarking/);
  assert.match(service, /noticeAcknowledged !== true/);
  assert.match(service, /BENCHMARK_PRIVACY_NOTICE_VERSION_REQUIRED/);
  assert.match(service, /trainingUseAllowed:\s*false/);
  assert.match(service, /advertisingUseAllowed:\s*false/);
  assert.match(service, /BenchmarkMetricContribution\.deleteMany\(\{ business: businessId \}\)/);
});

test("benchmark storage contains aggregate tenant contributions only", async () => {
  const [catalogue, contribution, service] = await Promise.all([
    source("../features/benchmarking/benchmarkMetricCatalogue.js"),
    source("../models/BenchmarkMetricContribution.js"),
    source("../features/benchmarking/benchmarkService.js"),
  ]);

  assert.match(catalogue, /minimumTenantSample:\s*10/);
  assert.match(catalogue, /rawOperationalRowsStored:\s*false/);
  assert.match(catalogue, /rawCustomerDataStored:\s*false/);
  assert.match(catalogue, /rawEmployeeDataStored:\s*false/);
  assert.match(catalogue, /clinicalDataStored:\s*false/);
  assert.match(catalogue, /communicationContentStored:\s*false/);
  assert.match(contribution, /sourceSampleSize/);
  assert.match(contribution, /metrics/);
  assert.doesNotMatch(contribution, /Customer|Employee|messageContent|clinicalProfile/);
  assert.match(service, /Appointment\.aggregate/);
  assert.doesNotMatch(service, /Customer\.find|User\.find|ClinicalProfile/);
});

test("published benchmark cohorts require at least ten tenants and suppress sparse metrics", async () => {
  const [catalogue, service, snapshot] = await Promise.all([
    source("../features/benchmarking/benchmarkMetricCatalogue.js"),
    source("../features/benchmarking/benchmarkService.js"),
    source("../models/BenchmarkCohortSnapshot.js"),
  ]);

  assert.match(catalogue, /minimumCohortTenants:\s*10/);
  assert.match(service, /contributions\.length < BENCHMARK_PRIVACY_POLICY\.minimumCohortTenants/);
  assert.match(service, /values\.length < BENCHMARK_PRIVACY_POLICY\.minimumCohortTenants/);
  assert.match(service, /suppressedMetricKeys/);
  assert.match(snapshot, /participantCountBand/);
  assert.match(snapshot, /BENCHMARK_SNAPSHOT_IMMUTABLE/);
});

test("benchmark cohort output does not expose tenant identifiers, exact extrema or exact participant count", async () => {
  const [catalogue, service] = await Promise.all([
    source("../features/benchmarking/benchmarkMetricCatalogue.js"),
    source("../features/benchmarking/benchmarkService.js"),
  ]);

  assert.match(catalogue, /cohortDimensions:\s*Object\.freeze\(\["vertical", "currency"\]\)/);
  assert.match(catalogue, /exactExtremaPublished:\s*false/);
  assert.match(service, /participantCountBand/);
  assert.match(service, /\.select\("-business -participation -metadata"\)/);
  assert.match(service, /Tenant identities, raw operational rows and individual extrema are not exposed/);
  assert.doesNotMatch(service, /publicSnapshot[\s\S]*participantCount:/);
  assert.doesNotMatch(service, /\bmin:\s*sorted|\bmax:\s*sorted/);
});

test("benchmark contributions use completed months, broad cohorts and bounded allowlisted KPIs", async () => {
  const [catalogue, service] = await Promise.all([
    source("../features/benchmarking/benchmarkMetricCatalogue.js"),
    source("../features/benchmarking/benchmarkService.js"),
  ]);

  for (const metric of [
    "appointment.completion_rate_pct",
    "appointment.no_show_rate_pct",
    "appointment.cancellation_rate_pct",
    "appointment.average_completed_value",
  ]) {
    assert.match(catalogue, new RegExp(metric.replaceAll(".", "\\.")));
  }
  assert.match(service, /Benchmark contributions use completed calendar months only/);
  assert.match(service, /vertical=/);
  assert.match(service, /currency=/);
  assert.match(service, /clampMetric/);
  assert.match(service, /BENCHMARK_TENANT_SAMPLE_TOO_SMALL/);
});

test("benchmark service claims no differential privacy or model-training use", async () => {
  const [catalogue, service] = await Promise.all([
    source("../features/benchmarking/benchmarkMetricCatalogue.js"),
    source("../features/benchmarking/benchmarkService.js"),
  ]);

  assert.match(catalogue, /differentialPrivacyApplied:\s*false/);
  assert.match(service, /modelTrainingUseAllowed:\s*false/);
  assert.match(service, /modelTrainingUse:\s*false/);
  assert.doesNotMatch(service, /trainModel|fitModel|fineTune|embedding/i);
});

test("benchmark routes use dedicated read/manage permissions and trusted tenant authority", async () => {
  const [routes, permissions] = await Promise.all([
    source("../features/benchmarking/benchmarkRoutes.js"),
    source("../constants/permissions.js"),
  ]);

  assert.match(routes, /trustedTenantContextMiddleware/);
  assert.match(routes, /effectiveAuthorityMiddleware/);
  assert.match(routes, /"benchmark:read"/);
  assert.match(routes, /"benchmark:manage"/);
  assert.match(permissions, /NON_DELEGABLE_EMPLOYEE_PERMISSIONS[\s\S]*"benchmark:manage"/);
});
