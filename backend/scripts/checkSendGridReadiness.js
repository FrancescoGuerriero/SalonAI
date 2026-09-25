import "dotenv/config";

import {
  buildSendGridOperationalReadinessReport,
} from "../src/integrations/messaging/sendGridReadinessService.js";
import {
  verifyEmailDeliveryConnection,
} from "../src/services/emailDeliveryService.js";

const report =
  await buildSendGridOperationalReadinessReport({
    verifyConnection:
      verifyEmailDeliveryConnection,
  });

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
