import process from "node:process";

try {
  process.loadEnvFile?.();
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

import {
  getAiServiceHealth,
  getAiServiceReadiness,
} from "../src/services/aiMicroserviceClient.js";

async function main() {
  const [
    health,
    readiness,
  ] = await Promise.all([
    getAiServiceHealth(),
    getAiServiceReadiness(),
  ]);

  console.log(
    JSON.stringify(
      {
        success: true,
        health,
        readiness,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        success: false,
        code:
          error.code ||
          "AI_SERVICE_CHECK_FAILED",
        message:
          error.message,
        status:
          error.status ||
          null,
      },
      null,
      2
    )
  );

  process.exitCode = 1;
});
