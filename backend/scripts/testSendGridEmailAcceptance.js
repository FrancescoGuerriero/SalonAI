import "dotenv/config";

import {
  runSendGridEmailAcceptance,
} from "../src/integrations/messaging/sendGridEmailAcceptanceService.js";

try {
  const result =
    await runSendGridEmailAcceptance();

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
          "SENDGRID_EMAIL_ACCEPTANCE_FAILED",
        message:
          error?.message ||
          "Twilio SendGrid email acceptance failed.",
      },
      null,
      2
    )
  );

  process.exitCode =
    1;
}
