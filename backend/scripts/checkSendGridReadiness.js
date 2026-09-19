import "dotenv/config";

import {
  buildSendGridReadinessReport,
} from "../src/integrations/messaging/sendGridReadinessService.js";

const report =
  buildSendGridReadinessReport();

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
