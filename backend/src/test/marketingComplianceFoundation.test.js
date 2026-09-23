import assert from "node:assert/strict";
import test from "node:test";

import Customer from "../models/customer.js";
import {
  getMarketingComplianceReadiness,
} from "../config/legalComplianceConfig.js";
import {
  createMarketingPreferenceToken,
  tokenMatchesCustomer,
  verifyMarketingPreferenceToken,
} from "../services/marketingPreferenceTokenService.js";
import {
  marketingConsentFromPreferences,
} from "../features/customerExperience/customerCommunicationPreferencesController.js";

test("new customer marketing consent fails closed by default", () => {
  const customer =
    new Customer({
      firstName: "Test",
      lastName: "Customer",
      email:
        "test@example.com",
    });

  assert.equal(
    customer.communicationPreferences
      .promotionalMessages,
    false
  );
  assert.equal(
    customer.communicationPreferences
      .emailMarketing,
    false
  );
  assert.equal(
    customer.communicationPreferences
      .smsMarketing,
    false
  );
  assert.equal(
    customer.communicationPreferences
      .whatsappMarketing,
    false
  );
  assert.equal(
    customer.marketing
      .emailConsent,
    false
  );
  assert.equal(
    customer.marketing
      .smsConsent,
    false
  );
  assert.equal(
    customer.marketing
      .whatsappConsent,
    false
  );
});

test("marketing consent requires an affirmative channel-specific preference", () => {
  assert.equal(
    marketingConsentFromPreferences(
      {},
      "email"
    ),
    false
  );

  assert.equal(
    marketingConsentFromPreferences(
      {
        emailMarketing: true,
        emailUnsubscribed: false,
        unsubscribed: false,
      },
      "email"
    ),
    true
  );

  assert.equal(
    marketingConsentFromPreferences(
      {
        emailMarketing: true,
        emailUnsubscribed: true,
        unsubscribed: false,
      },
      "email"
    ),
    false
  );
});

test("marketing compliance readiness requires public identity and address controls", () => {
  const report =
    getMarketingComplianceReadiness({
      FRONTEND_URL:
        "https://salon.example",
      LEGAL_BUSINESS_NAME:
        "Salon Example Ltd",
      LEGAL_POSTAL_ADDRESS:
        "",
      PRIVACY_CONTACT_EMAIL:
        "privacy@salon.example",
      MARKETING_PREFERENCE_TOKEN_SECRET:
        "x".repeat(32),
    });

  assert.equal(
    report.ready,
    false
  );
  assert.ok(
    report.blockers.includes(
      "postalAddress"
    )
  );
});

test("signed preference token round-trips and binds to customer identity", () => {
  const original =
    process.env
      .MARKETING_PREFERENCE_TOKEN_SECRET;

  process.env
    .MARKETING_PREFERENCE_TOKEN_SECRET =
      "test-secret-0123456789-test-secret-0123456789";

  try {
    const customer = {
      _id:
        "64f000000000000000000001",
      email:
        "customer@example.com",
    };

    const token =
      createMarketingPreferenceToken({
        customerId:
          customer._id,
        email:
          customer.email,
      });
    const payload =
      verifyMarketingPreferenceToken(
        token
      );

    assert.equal(
      tokenMatchesCustomer(
        payload,
        customer
      ),
      true
    );

    assert.equal(
      tokenMatchesCustomer(
        payload,
        {
          ...customer,
          email:
            "other@example.com",
        }
      ),
      false
    );
  } finally {
    if (original === undefined) {
      delete process.env
        .MARKETING_PREFERENCE_TOKEN_SECRET;
    } else {
      process.env
        .MARKETING_PREFERENCE_TOKEN_SECRET =
          original;
    }
  }
});


test("legacy marketing fields do not grant the new channel opt-in", async () => {
  const {
    resolveCustomerConsent,
  } =
    await import(
      "../services/campaignDeliveryService.js"
    );

  const consent =
    resolveCustomerConsent(
      {
        communicationPreferences: {
          promotionalMessages: true,
          emailUnsubscribed: false,
          unsubscribed: false,
        },
        marketing: {
          emailConsent: true,
          emailSuppressed: false,
        },
      },
      "email",
      {
        consentRequired: true,
        excludeUnsubscribed: true,
        campaignType: "general",
      }
    );

  assert.equal(
    consent.granted,
    false
  );
  assert.equal(
    consent.source,
    "communicationPreferences.emailMarketing"
  );
});
