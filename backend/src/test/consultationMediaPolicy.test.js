import assert from "node:assert/strict";
import test from "node:test";

import {
  assertConsultationMediaProcessingAllowed,
  buildConsultationMediaProcessingEnvelope,
} from "../features/consultations/consultationMediaPolicy.js";

function session(overrides = {}) {
  return {
    business: "64f000000000000000000001",
    location: "64f000000000000000000002",
    consultationType: "hair-colour-chemical",
    definitionVersion: "1",
    status: "in_progress",
    governance: {
      mediaProcessingConsent: true,
    },
    ...overrides,
  };
}

test("consultation media is consent gated and never persists provider URLs", () => {
  const accepted = assertConsultationMediaProcessingAllowed(session(), [
    {
      contentType: "image/jpeg",
      byteLength: 1024,
      providerReference: "twilio-media-ME123",
    },
  ]);

  assert.equal(accepted[0].persistence, "temporary-private-only");
  assert.throws(
    () =>
      assertConsultationMediaProcessingAllowed(session(), [
        {
          contentType: "image/jpeg",
          byteLength: 1024,
          providerReference: "https://provider.example/private/image.jpg",
        },
      ]),
    /must not be persisted/
  );
});

test("consultation media rejects missing consent and finalised sessions", () => {
  assert.throws(
    () =>
      assertConsultationMediaProcessingAllowed(
        session({ governance: { mediaProcessingConsent: false } }),
        [
          {
            contentType: "image/png",
            byteLength: 2048,
            providerReference: "media-1",
          },
        ]
      ),
    /consent is required/
  );

  assert.throws(
    () =>
      assertConsultationMediaProcessingAllowed(session({ status: "booked" }), [
        {
          contentType: "image/png",
          byteLength: 2048,
          providerReference: "media-1",
        },
      ]),
    /finalised consultation/
  );
});

test("media processing envelope preserves tenant and fail-closed authority", () => {
  const envelope = buildConsultationMediaProcessingEnvelope({
    session: session(),
    mediaItems: [
      {
        contentType: "image/webp",
        byteLength: 4096,
        providerReference: "meta-media-123",
      },
    ],
  });

  assert.equal(envelope.tenantContext.businessId, "64f000000000000000000001");
  assert.equal(envelope.constraints.humanReviewRequired, true);
  assert.equal(envelope.constraints.rawMediaPersistenceAllowed, false);
  assert.equal(envelope.constraints.medicalDiagnosisAllowed, false);
});
