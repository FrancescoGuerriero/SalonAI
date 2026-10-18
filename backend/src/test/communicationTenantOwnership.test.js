import assert from "node:assert/strict";
import test from "node:test";

import CommunicationCampaign from "../models/CommunicationCampaign.js";
import CommunicationCampaignRecipient from "../models/CommunicationCampaignRecipient.js";
import CommunicationTemplate from "../models/CommunicationTemplate.js";
import MessageDelivery from "../models/MessageDelivery.js";
import ScheduledCommunication from "../features/scheduler/ScheduledCommunication.js";
import {
  assertCommunicationResourceWithinScope,
  communicationBusinessFilter,
  communicationLocationFilter,
  stripCommunicationOwnershipInput,
} from "../services/communicationOwnershipScope.js";
import {
  buildCommunicationOwnershipPlan,
  calculateCommunicationOwnershipPlanFingerprint,
} from "../platform/tenancy/communicationOwnershipMigration.js";
import {
  assertCommunicationApplyAuthorization,
  COMMUNICATION_TENANT_BACKFILL_CONFIRMATION,
} from "../../scripts/applyCommunicationTenantBackfill.js";
import {
  assertCommunicationReadOnlyArguments,
} from "../../scripts/checkCommunicationTenantReadiness.js";

test("canonical communications models expose transitional Business/Location ownership", () => {
  for (const Model of [
    CommunicationCampaign,
    CommunicationCampaignRecipient,
    CommunicationTemplate,
    ScheduledCommunication,
    MessageDelivery,
  ]) {
    assert.ok(Model.schema.path("business"));
    assert.ok(Model.schema.path("location"));
  }
});

test("campaign and template slugs declare tenant-local uniqueness", () => {
  const campaignIndex = CommunicationCampaign.schema.indexes().find(
    ([fields, options]) => fields.business === 1 && fields.slug === 1 && options.unique
  );
  const templateIndex = CommunicationTemplate.schema.indexes().find(
    ([fields, options]) => fields.business === 1 && fields.slug === 1 && options.unique
  );
  assert.ok(campaignIndex);
  assert.ok(templateIndex);
});

test("canonical single-location communication records produce deterministic ownership plan", () => {
  const input = {
    business: { _id: "507f1f77bcf86cd799439011" },
    location: { _id: "507f1f77bcf86cd799439012" },
    campaigns: [
      {
        _id: "507f1f77bcf86cd799439021",
        slug: "campaign-one",
        location: "507f1f77bcf86cd799439012",
      },
    ],
    recipients: [
      {
        _id: "507f1f77bcf86cd799439022",
        campaign: "507f1f77bcf86cd799439021",
        customer: "507f1f77bcf86cd799439030",
      },
    ],
    templates: [
      {
        _id: "507f1f77bcf86cd799439023",
        slug: "template-email",
      },
    ],
    scheduledCommunications: [
      {
        _id: "507f1f77bcf86cd799439024",
        appointment: "507f1f77bcf86cd799439040",
        customer: "507f1f77bcf86cd799439030",
      },
    ],
    messageDeliveries: [
      {
        _id: "507f1f77bcf86cd799439025",
        campaign: "507f1f77bcf86cd799439021",
      },
    ],
  };

  const first = buildCommunicationOwnershipPlan(input);
  const second = buildCommunicationOwnershipPlan(input);

  assert.equal(first.executable, true);
  assert.equal(first.summary.operationCount, 5);
  assert.equal(
    first.operations.find((operation) => operation.recordType === "CommunicationCampaignRecipient")
      .set.location,
    input.location._id
  );
  assert.equal(
    first.operations.find((operation) => operation.recordType === "ScheduledCommunication")
      .set.location,
    input.location._id
  );
  assert.equal(
    first.operations.find((operation) => operation.recordType === "MessageDelivery")
      .set.location,
    input.location._id
  );
  assert.equal(
    calculateCommunicationOwnershipPlanFingerprint(first),
    calculateCommunicationOwnershipPlanFingerprint(second)
  );
});

test("communications ownership fails closed for duplicate slugs, orphan campaigns and foreign ownership", () => {
  const plan = buildCommunicationOwnershipPlan({
    business: { _id: "507f1f77bcf86cd799439011" },
    location: { _id: "507f1f77bcf86cd799439012" },
    campaigns: [
      {
        _id: "507f1f77bcf86cd799439021",
        business: "507f1f77bcf86cd799439099",
        slug: "same",
      },
      {
        _id: "507f1f77bcf86cd799439022",
        slug: "same",
      },
    ],
    recipients: [
      {
        _id: "507f1f77bcf86cd799439023",
        campaign: "507f1f77bcf86cd799439098",
        customer: "507f1f77bcf86cd799439030",
      },
    ],
  });

  assert.equal(plan.executable, false);
  assert.ok(plan.blockers.some((item) => item.type === "duplicate-campaign-slug"));
  assert.ok(plan.blockers.some((item) => item.type === "recipient-orphan-campaign"));
  assert.ok(plan.blockers.some((item) => item.type === "foreign-business-ownership"));
});

test("communications scope consumes only trusted context and strips client tenant authority", () => {
  const context = {
    businessId: "507f1f77bcf86cd799439011",
    locationId: "507f1f77bcf86cd799439012",
  };

  assert.deepEqual(communicationBusinessFilter(context), {
    business: context.businessId,
  });
  assert.deepEqual(
    communicationLocationFilter(context, { includeBusinessWide: false }),
    {
      business: context.businessId,
      location: context.locationId,
    }
  );
  assert.equal(
    assertCommunicationResourceWithinScope(
      { business: context.businessId, location: context.locationId },
      context,
      { requireLocation: true }
    ),
    true
  );
  assert.throws(() =>
    assertCommunicationResourceWithinScope(
      {
        business: "507f1f77bcf86cd799439099",
        location: context.locationId,
      },
      context
    )
  );
  assert.deepEqual(
    stripCommunicationOwnershipInput({
      name: "Campaign",
      business: "attacker-business",
      businessId: "attacker-business",
      location: "attacker-location",
      locationId: "attacker-location",
      tenant: "attacker-tenant",
      tenantId: "attacker-tenant",
    }),
    { name: "Campaign" }
  );
});

test("communications readiness rejects write-like flags", () => {
  assert.equal(assertCommunicationReadOnlyArguments([]), true);
  assert.throws(() => assertCommunicationReadOnlyArguments(["--apply"]));
  assert.throws(() => assertCommunicationReadOnlyArguments(["--backfill=yes"]));
});

test("guarded communications apply requires exact confirmation and reviewed fingerprint", () => {
  const fingerprint = "a".repeat(64);
  assert.throws(() =>
    assertCommunicationApplyAuthorization({
      args: [],
      environment: {},
      actualFingerprint: fingerprint,
    })
  );
  assert.throws(() =>
    assertCommunicationApplyAuthorization({
      args: ["--apply"],
      environment: {
        COMMUNICATION_TENANT_BACKFILL_CONFIRM: COMMUNICATION_TENANT_BACKFILL_CONFIRMATION,
        COMMUNICATION_TENANT_BACKFILL_PLAN_FINGERPRINT: "b".repeat(64),
      },
      actualFingerprint: fingerprint,
    })
  );
});
