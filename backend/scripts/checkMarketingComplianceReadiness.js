import {
  getMarketingComplianceReadiness,
} from "../src/config/legalComplianceConfig.js";

const report =
  getMarketingComplianceReadiness();

console.log(
  JSON.stringify(
    report,
    null,
    2
  )
);

if (!report.ready) {
  console.error(
    `Marketing compliance readiness is blocked: ${report.blockers.join(", ")}`
  );
  process.exitCode = 1;
} else {
  console.log(
    "[READY] Marketing legal identity and public preference controls are configured."
  );
}
