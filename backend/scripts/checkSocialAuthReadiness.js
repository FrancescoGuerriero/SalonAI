import "dotenv/config";

import {
  buildSocialAuthReadinessReport,
} from "../src/features/socialAuth/socialAuthReadinessService.js";

const report =
  buildSocialAuthReadinessReport();

console.log(
  JSON.stringify(
    report,
    null,
    2
  )
);

if (
  report.readyForAcceptance !==
  true
) {
  process.exitCode = 1;
}
