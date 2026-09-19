import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  normaliseAdviserFeedback,
} from "../features/aiRecommendations/aiAdviserFeedbackService.js";

test("Adviser feedback accepts only explicit useful or not-useful ratings", () => {
  assert.deepEqual(
    normaliseAdviserFeedback({
      rating: 1,
      comment:
        "Relevant answer",
    }),
    {
      rating: 1,
      useful: true,
      comment:
        "Relevant answer",
    }
  );

  assert.deepEqual(
    normaliseAdviserFeedback({
      rating: -1,
    }),
    {
      rating: -1,
      useful: false,
      comment: "",
    }
  );

  assert.throws(
    () =>
      normaliseAdviserFeedback({
        rating: 0,
      }),
    /must be 1.*or -1/
  );
});

test("Adviser feedback limits free-text feedback before persistence", () => {
  assert.throws(
    () =>
      normaliseAdviserFeedback({
        rating: 1,
        comment:
          "x".repeat(
            1001
          ),
      }),
    /1000 characters or fewer/
  );
});

test("Adviser feedback persistence is constrained to the authenticated inference owner", async () => {
  const service =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserFeedbackService.js",
        import.meta.url
      ),
      "utf8"
    );
  const adviser =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserService.js",
        import.meta.url
      ),
      "utf8"
    );
  const schema =
    await readFile(
      new URL(
        "../features/aiPlatform/AiInferenceLog.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    service,
    /capability:[\s\S]*?CAPABILITY/
  );
  assert.match(
    service,
    /"context\.actorUserId":[\s\S]*?actorUserId/
  );
  assert.match(
    adviser,
    /actorUserId:[\s\S]*?user\?\._id/
  );
  assert.match(
    schema,
    /actorUserId:[\s\S]*?Schema\.Types\.ObjectId/
  );
  assert.match(
    schema,
    /submittedAt/
  );
});

test("Adviser feedback route and UI remain governed by ai:use and inferenceId", async () => {
  const routes =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiRecommendationRoutes.js",
        import.meta.url
      ),
      "utf8"
    );
  const api =
    await readFile(
      new URL(
        "../../../frontend/src/Services/aiAdviserService.js",
        import.meta.url
      ),
      "utf8"
    );
  const ui =
    await readFile(
      new URL(
        "../../../frontend/src/components/ai/SalonAiAdviser.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    routes,
    /\/adviser\/inferences\/:inferenceId\/feedback/
  );
  assert.match(
    routes,
    /feedback"[\s\S]*?"ai:use"/
  );
  assert.match(
    api,
    /submitSalonAiAdviserFeedback/
  );
  assert.match(
    api,
    /inferences\/\$\{inferenceId\}\/feedback/
  );
  assert.match(
    ui,
    /result\.inferenceId/
  );
  assert.match(
    ui,
    /Was this useful\?/
  );
  assert.match(
    ui,
    /aria-pressed/
  );
});
