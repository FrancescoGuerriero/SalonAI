import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

test(
  "all-services stylist assignment is guarded, aggregate-only and production-safe",
  async () => {
    const script =
      await readFile(
        new URL(
          "../../scripts/assignAllServicesToStylists.js",
          import.meta.url
        ),
        "utf8"
      );

    const workflow =
      await readFile(
        new URL(
          "../../../.github/workflows/production-assign-all-services-to-stylists.yml",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      script,
      /STYLIST_SERVICE_ASSIGNMENT_CONFIRM/
    );
    assert.match(
      script,
      /ASSIGN_ALL_SERVICES_TO_ALL_STYLISTS/
    );
    assert.match(
      script,
      /Stylist\.updateMany\(/
    );
    assert.match(
      script,
      /toUpdateCount/
    );
    assert.doesNotMatch(
      script,
      /email:\s*stylist\.email/
    );

    assert.match(
      workflow,
      /group:\s*salonai-production-deployment/
    );
    assert.match(
      workflow,
      /docker exec salonai-backend node scripts\/assignAllServicesToStylists\.js/
    );
    assert.match(
      workflow,
      /STYLIST_SERVICE_ASSIGNMENT_CONFIRM=ASSIGN_ALL_SERVICES_TO_ALL_STYLISTS/
    );
    assert.doesNotMatch(
      workflow,
      /docker exec salonai-backend npm/
    );
  }
);
