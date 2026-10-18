import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  buildNoShowInferenceDocuments,
  normaliseNoShowOutcome,
  observeNoShowOutcomeForAppointment,
} from "../features/aiPlatform/noShowInferenceLedgerService.js";

const BUSINESS_ID =
  "507f1f77bcf86cd799439021";
const LOCATION_ID =
  "507f1f77bcf86cd799439022";

test("no-show prediction ledger stores governed tenant appointment evidence without customer identifiers", () => {
  const documents =
    buildNoShowInferenceDocuments({
      businessId:
        BUSINESS_ID,
      locationId:
        LOCATION_ID,
      requestId:
        "req-1",
      actorRole:
        "admin",
      latencyMs:
        145,
      prediction: {
        metadata: {
          model_name:
            "salonai-no-show-risk-rules-v1",
          provider_mode:
            "local",
        },
        predictions: [
          {
            appointment_key:
              "507f1f77bcf86cd799439011",
            customer_key:
              "customer-private-id",
            appointment_date:
              "2026-09-22T10:00:00.000Z",
            probability:
              0.72,
            risk_level:
              "high",
            confidence:
              0.8,
            risk_factors: [
              {
                code:
                  "history_no_show",
                label:
                  "Previous no-show history",
                contribution:
                  0.3,
              },
            ],
            recommended_actions: [
              "Request confirmation",
            ],
          },
        ],
      },
    });

  assert.equal(
    documents.length,
    1
  );

  const document =
    documents[0];

  assert.equal(
    String(document.business),
    BUSINESS_ID
  );
  assert.equal(
    String(document.location),
    LOCATION_ID
  );
  assert.equal(
    document.capability,
    "no-show-prediction"
  );
  assert.equal(
    document.featureVersion,
    "no-show-v1"
  );
  assert.equal(
    document.modelVersion,
    "v1"
  );
  assert.equal(
    document.entityType,
    "appointment"
  );
  assert.equal(
    document.entityKey,
    "507f1f77bcf86cd799439011"
  );
  assert.equal(
    document.prediction
      .probability,
    0.72
  );
  assert.equal(
    document.confidence,
    0.8
  );
  assert.equal(
    document.context
      .actorRole,
    "admin"
  );
  assert.equal(
    JSON.stringify(
      document
    ).includes(
      "customer-private-id"
    ),
    false
  );
});

test("no-show prediction evidence fails closed without trusted Business provenance", () => {
  assert.throws(
    () =>
      buildNoShowInferenceDocuments({
        prediction: {
          predictions: [],
        },
      }),
    /Trusted Business provenance is required/
  );
});

test("completed and no-show statuses become binary evaluation labels", () => {
  const completed =
    normaliseNoShowOutcome({
      _id:
        "507f1f77bcf86cd799439011",
      status:
        "completed",
      completedAt:
        "2026-09-22T11:00:00.000Z",
    });
  const noShow =
    normaliseNoShowOutcome({
      _id:
        "507f1f77bcf86cd799439012",
      status:
        "no_show",
      noShowAt:
        "2026-09-22T11:05:00.000Z",
    });

  assert.equal(
    completed.outcome
      .noShowLabel,
    0
  );
  assert.equal(
    completed.outcome
      .evaluationEligible,
    true
  );
  assert.equal(
    noShow.outcome
      .noShowLabel,
    1
  );
  assert.equal(
    noShow.outcome
      .evaluationEligible,
    true
  );
});

test("cancelled appointments are observed but excluded from binary no-show evaluation", () => {
  const cancelled =
    normaliseNoShowOutcome({
      _id:
        "507f1f77bcf86cd799439013",
      status:
        "cancelled",
      cancelledAt:
        "2026-09-22T09:00:00.000Z",
    });

  assert.equal(
    cancelled.outcome
      .appointmentStatus,
    "cancelled"
  );
  assert.equal(
    cancelled.outcome
      .noShowLabel,
    null
  );
  assert.equal(
    cancelled.outcome
      .evaluationEligible,
    false
  );
  assert.equal(
    cancelled.outcome
      .cancellationExcluded,
    true
  );
});

test("non-terminal appointments do not create observed outcomes", () => {
  assert.equal(
    normaliseNoShowOutcome({
      _id:
        "507f1f77bcf86cd799439014",
      status:
        "confirmed",
    }),
    null
  );
});

test("legacy terminal appointment without Business provenance skips outcome linkage instead of updating globally", async () => {
  const result =
    await observeNoShowOutcomeForAppointment({
      _id:
        "507f1f77bcf86cd799439014",
      status:
        "completed",
      completedAt:
        "2026-09-22T11:00:00.000Z",
    });

  assert.deepEqual(
    result,
    {
      matched: 0,
      modified: 0,
      skipped:
        "missing_business_scope",
    }
  );
});

test("production no-show prediction path logs tenant-scoped inferences and appointment saves link terminal outcomes", async () => {
  const predictionService =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiNoShowPredictionService.js",
        import.meta.url
      ),
      "utf8"
    );
  const ledgerService =
    await readFile(
      new URL(
        "../features/aiPlatform/noShowInferenceLedgerService.js",
        import.meta.url
      ),
      "utf8"
    );
  const appointmentModel =
    await readFile(
      new URL(
        "../models/Appointment.js",
        import.meta.url
      ),
      "utf8"
    );
  const inferenceSchema =
    await readFile(
      new URL(
        "../features/aiPlatform/AiInferenceLog.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    predictionService,
    /buildAiTenantFilter/
  );
  assert.match(
    predictionService,
    /businessId:[\s\S]*?tenantScope\.businessId/
  );
  assert.match(
    ledgerService,
    /business,[\s\S]*?capability:/
  );
  assert.match(
    ledgerService,
    /updateMany\([\s\S]*?business,[\s\S]*?capability:/
  );
  assert.match(
    appointmentModel,
    /observeNoShowOutcomeForAppointment/
  );
  assert.match(
    appointmentModel,
    /No-show inference outcome linkage failed/
  );
  assert.match(
    inferenceSchema,
    /required\(\)[\s\S]*?no-show-prediction/
  );
});


test("no-show reconciliation command is Business-scoped, dry-run first and requires explicit apply confirmation", async () => {
  const script =
    await readFile(
      new URL(
        "../../scripts/reconcileNoShowInferenceOutcomes.js",
        import.meta.url
      ),
      "utf8"
    );
  const service =
    await readFile(
      new URL(
        "../features/aiPlatform/noShowOutcomeReconciliationService.js",
        import.meta.url
      ),
      "utf8"
    );
  const packageJson =
    JSON.parse(
      await readFile(
        new URL(
          "../../package.json",
          import.meta.url
        ),
        "utf8"
      )
    );

  assert.match(
    script,
    /--business-id=<trusted Business ObjectId>/
  );
  assert.match(
    script,
    /--apply/
  );
  assert.match(
    script,
    /--confirm=reconcile-no-show-outcomes/
  );
  assert.match(
    script,
    /dry-run/
  );
  assert.match(
    service,
    /AiInferenceLog\.find\(\{[\s\S]*?business:[\s\S]*?scope\.businessId/
  );
  assert.match(
    service,
    /Appointment\.find\(\{[\s\S]*?business:[\s\S]*?scope\.businessId/
  );
  assert.equal(
    packageJson.scripts[
      "ai:outcomes:no-show"
    ],
    "node scripts/reconcileNoShowInferenceOutcomes.js"
  );
});
