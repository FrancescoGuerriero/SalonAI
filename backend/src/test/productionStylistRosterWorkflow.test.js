import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

const workflowUrl =
  new URL(
    "../../../.github/workflows/classify-production-stylist-roster.yml",
    import.meta.url
  );

test(
  "production roster workflow governs prepare finalize and legacy rollback phases",
  async () => {
    const workflow =
      await readFile(
        workflowUrl,
        "utf8"
      );

    assert.match(
      workflow,
      /workflow_dispatch:/
    );

    assert.match(
      workflow,
      /PREPARE/
    );

    assert.match(
      workflow,
      /FINALIZE/
    );

    assert.match(
      workflow,
      /ROLLBACK_PREP/
    );

    assert.match(
      workflow,
      /group: salonai-production-deployment/
    );

    assert.match(
      workflow,
      /environment:\s*\n\s*name: production/
    );

    assert.match(
      workflow,
      /CLASSIFY-V8\.14\.10/
    );

    assert.match(
      workflow,
      /validate-deployment-evidence\.mjs/
    );

    assert.match(
      workflow,
      /immutableReference/
    );

    assert.match(
      workflow,
      /BACKEND_MIGRATION_IMAGE/
    );

    assert.match(
      workflow,
      /--prepare/
    );

    assert.match(
      workflow,
      /--finalize/
    );

    assert.match(
      workflow,
      /--legacy-rollback/
    );

    assert.match(
      workflow,
      /--apply/
    );

    assert.match(
      workflow,
      /--verify/
    );

    assert.match(
      workflow,
      /APP_VERSION/
    );

    assert.match(
      workflow,
      /requires the requested release to be deployed/
    );

    assert.match(
      workflow,
      /docker run --rm/
    );

    assert.match(
      workflow,
      /--network salonai-private/
    );

    assert.match(
      workflow,
      /--security-opt no-new-privileges:true/
    );

    assert.match(
      workflow,
      /--cap-drop ALL/
    );

    assert.doesNotMatch(
      workflow,
      /docker exec\s+salonai-backend\s+node\s+scripts\/classifyProductionStylistRoster/
    );

    assert.doesNotMatch(
      workflow,
      /MONGODB_URI:\s*\$\{\{\s*secrets\./
    );
  }
);

test(
  "finalize and rollback preparation require the actual target backend image",
  async () => {
    const workflow =
      await readFile(
        workflowUrl,
        "utf8"
      );

    assert.match(
      workflow,
      /FINALIZE.*ROLLBACK_PREP/
    );

    assert.match(
      workflow,
      /target_backend_image="\$3"/
    );

    assert.match(
      workflow,
      /\.Config\.Image/
    );

    assert.match(
      workflow,
      /running_config_image/
    );

    assert.match(
      workflow,
      /running_image_id/
    );

    assert.match(
      workflow,
      /docker image inspect/
    );

    assert.match(
      workflow,
      /target_image_id/
    );

    assert.match(
      workflow,
      /running backend image ID to match the target immutable release image/
    );
  }
);

test(
  "production roster evidence validation uses trusted deployment controls",
  async () => {
    const workflow =
      await readFile(
        workflowUrl,
        "utf8"
      );

    assert.match(
      workflow,
      /path: deployment-control/
    );

    assert.match(
      workflow,
      /deployment-control\/scripts\/ci\/validate-deployment-evidence\.mjs/
    );

    assert.doesNotMatch(
      workflow,
      /release-source\/scripts\/ci\/validate-deployment-evidence\.mjs/
    );
  }
);


test(
  "production P0 verification shares the production deployment concurrency lock",
  async () => {
    const workflow =
      await readFile(
        new URL(
          "../../../.github/workflows/production-p0-verification.yml",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      workflow,
      /group:\s*salonai-production-deployment/
    );

    assert.match(
      workflow,
      /cancel-in-progress:\s*false/
    );
  }
);
