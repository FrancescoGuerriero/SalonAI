import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  deriveCustomerLifecycleState,
  deriveCustomerSegments,
} from "../features/premium/automation/stage7CrmService.js";

test("Point 7 lifecycle classification is deterministic", () => {
  const now = new Date("2026-10-25T12:00:00.000Z");

  assert.equal(
    deriveCustomerLifecycleState(
      { completedAppointmentCount: 0 },
      { now }
    ),
    "prospect"
  );

  assert.equal(
    deriveCustomerLifecycleState(
      {
        completedAppointmentCount: 3,
        firstVisit: "2026-05-01T12:00:00.000Z",
        lastVisit: "2026-08-01T12:00:00.000Z",
      },
      { now }
    ),
    "at_risk"
  );

  assert.equal(
    deriveCustomerLifecycleState(
      {
        completedAppointmentCount: 12,
        firstVisit: "2025-01-01T12:00:00.000Z",
        lastVisit: "2026-10-20T12:00:00.000Z",
        totalSpent: 1600,
        loyaltyTier: "gold",
      },
      { now }
    ),
    "loyal"
  );
});

test("Point 7 deterministic segments honour consent and customer value", () => {
  const segments = deriveCustomerSegments(
    {
      completedAppointmentCount: 10,
      totalSpent: 1250,
      membershipStatus: "active",
      email: "customer@example.com",
      phone: "+447700900123",
      communicationPreferences: {
        promotionalMessages: true,
        unsubscribed: false,
        emailUnsubscribed: false,
        smsUnsubscribed: false,
        whatsappUnsubscribed: false,
        whatsappMarketing: true,
      },
      marketing: {
        emailConsent: true,
        emailSuppressed: false,
        smsConsent: true,
        whatsappConsent: true,
      },
    },
    "loyal"
  );

  for (const expected of [
    "loyal",
    "repeat_customer",
    "high_value",
    "active_member",
    "contactable_email",
    "contactable_sms",
    "contactable_whatsapp",
  ]) {
    assert.ok(segments.includes(expected));
  }
});

test("Point 7 retention definitions are business scoped and billing-aware", async () => {
  const model = await readFile(
    new URL(
      "../features/premium/automation/RetentionJourney.js",
      import.meta.url
    ),
    "utf8"
  );
  const facade = await readFile(
    new URL(
      "../features/premium/automation/stage7RetentionService.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(model, /business:[\s\S]*required:\s*true/);
  assert.match(model, /membership_payment_failed/);
  assert.match(model, /membership_payment_recovered/);
  assert.match(model, /business:\s*1,\s*enabled:\s*1/);
  assert.match(facade, /requireRetentionBusinessId/);
  assert.match(facade, /RetentionJourney\.find\(\{\s*business:\s*businessId/);
  assert.match(facade, /executionAuthorised:\s*false/);
});

test("Point 7 Customer 360 and enrolment ledger do not create a parallel payment executor", async () => {
  const crm = await readFile(
    new URL(
      "../features/premium/automation/stage7CrmService.js",
      import.meta.url
    ),
    "utf8"
  );
  const journey = await readFile(
    new URL(
      "../features/premium/automation/stage7JourneyService.js",
      import.meta.url
    ),
    "utf8"
  );
  const enrolmentModel = await readFile(
    new URL(
      "../features/premium/automation/RetentionJourneyEnrollment.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(crm, /type:\s*"customer_360"/);
  assert.match(crm, /deterministic:\s*true/);
  assert.match(journey, /executionAuthorised:\s*false/);
  assert.match(journey, /membership_payment_recovered/);
  assert.doesNotMatch(journey, /retryPayment|chargeCard|createPaymentIntent|capturePayment/);
  assert.match(enrolmentModel, /idempotencyKey/);
  assert.match(enrolmentModel, /business:\s*1,\s*idempotencyKey:\s*1/);
});

test("Point 7 routes expose CRM, enrolment and campaign-to-revenue reads behind permissions", async () => {
  const routes = await readFile(
    new URL(
      "../features/premium/automation/automationRoutes.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(routes, /\/customers\/:customerId\/360/);
  assert.match(routes, /\/crm\/segments/);
  assert.match(routes, /\/enrollments/);
  assert.match(routes, /\/measurement\/campaign-revenue/);
  assert.match(routes, /customer:read/);
  assert.match(routes, /retention-automation:manage/);
});
