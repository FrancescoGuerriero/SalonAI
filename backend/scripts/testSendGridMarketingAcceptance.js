import "dotenv/config";

import {
  runSendGridMarketingAcceptance,
} from "../src/integrations/messaging/sendGridMarketingAcceptanceService.js";

try {
  const result =
    await runSendGridMarketingAcceptance();

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        success:
          false,
        code:
          error?.code ||
          "SENDGRID_MARKETING_ACCEPTANCE_FAILED",
        message:
          error?.message ||
          "Twilio SendGrid marketing acceptance failed.",
      },
      null,
      2
    )
  );

  process.exitCode =
    1;
}
