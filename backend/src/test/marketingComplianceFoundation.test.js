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
import {
  getExplicitConsentValue,
  resolveCustomerConsent,
} from "../services/campaignDeliveryService.js";

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

test("signed preference token round-trips and remains bound to the canonical customer id", () => {
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
            "changed@example.com",
        }
      ),
      true
    );

    assert.equal(
      tokenMatchesCustomer(
        payload,
        {
          _id:
            "64f000000000000000000002",
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


test("legacy marketing fields do not grant the new channel opt-in", () => {
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


test("provider suppression takes precedence over a local email opt-in", () => {
  const consent =
    getExplicitConsentValue(
      {
        communicationPreferences: {
          emailMarketing: true,
        },
        marketing: {
          emailConsent: true,
          emailSuppressed: true,
        },
      },
      "email",
      {
        campaignType:
          "promotion",
      }
    );

  assert.deepEqual(
    consent,
    {
      found: true,
      granted: false,
      source:
        "marketing.emailSuppressed",
    }
  );
});
