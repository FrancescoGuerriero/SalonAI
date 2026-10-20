import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCommunicationCampaignFilter,
  buildCommunicationDeliveryFilter,
  buildCommunicationTemplateFilter,
  communicationObjectId,
} from "../services/communicationQueryFilterService.js";

const VALID_ID = "64f000000000000000000001";

test("communications query filters reject object-shaped identifier input", () => {
  for (const buildFilter of [
    () => buildCommunicationCampaignFilter({ createdBy: { $ne: null } }),
    () => buildCommunicationTemplateFilter({ createdBy: [VALID_ID] }),
    () => buildCommunicationDeliveryFilter({ campaignId: { $gt: "" } }),
    () => buildCommunicationDeliveryFilter({ customerId: { $ne: null } }),
  ]) {
    assert.throws(
      buildFilter,
      (error) =>
        error?.code === "INVALID_COMMUNICATION_QUERY_FILTER" &&
        error?.statusCode === 400
    );
  }
});

test("communications identifier filters are materialised as ObjectId values", () => {
  const id = communicationObjectId(VALID_ID, "createdBy");
  assert.equal(id.toHexString(), VALID_ID);

  const campaign = buildCommunicationCampaignFilter({ createdBy: VALID_ID });
  assert.equal(campaign.createdBy.toHexString(), VALID_ID);

  const delivery = buildCommunicationDeliveryFilter({
    campaignId: VALID_ID,
    customerId: VALID_ID,
  });
  assert.equal(delivery.campaign.toHexString(), VALID_ID);
  assert.equal(delivery.customer.toHexString(), VALID_ID);
});

test("campaign and template search use Mongo text search rather than dynamic regular expressions", () => {
  assert.deepEqual(buildCommunicationCampaignFilter({ search: "summer colour" }).$text, {
    $search: "summer colour",
  });
  assert.deepEqual(buildCommunicationTemplateFilter({ search: "appointment reminder" }).$text, {
    $search: "appointment reminder",
  });
});

test("delivery search uses bounded scalar exact matching", () => {
  const filter = buildCommunicationDeliveryFilter({ search: "Client@example.com" });
  assert.deepEqual(filter.$or, [
    { deliveryId: "Client@example.com" },
    { providerMessageId: "Client@example.com" },
    { "recipient.email": "client@example.com" },
    { "recipient.phone": "Client@examplecom" },
    { "recipient.name": "Client@example.com" },
  ]);
});

test("communications query filters reject oversized or non-scalar search input", () => {
  assert.throws(
    () => buildCommunicationCampaignFilter({ search: "x".repeat(201) }),
    (error) => error?.code === "INVALID_COMMUNICATION_QUERY_FILTER"
  );
  assert.throws(
    () => buildCommunicationTemplateFilter({ search: { $regex: ".*" } }),
    (error) => error?.code === "INVALID_COMMUNICATION_QUERY_FILTER"
  );
  assert.throws(
    () => buildCommunicationDeliveryFilter({ search: ["anything"] }),
    (error) => error?.code === "INVALID_COMMUNICATION_QUERY_FILTER"
  );
});

test("communications query filters reject malformed dates and booleans", () => {
  assert.throws(
    () => buildCommunicationCampaignFilter({ startDate: { $ne: null } }),
    (error) => error?.code === "INVALID_COMMUNICATION_QUERY_FILTER"
  );
  assert.throws(
    () => buildCommunicationTemplateFilter({ active: { $ne: false } }),
    (error) => error?.code === "INVALID_COMMUNICATION_QUERY_FILTER"
  );
  assert.throws(
    () => buildCommunicationDeliveryFilter({ retryable: "perhaps" }),
    (error) => error?.code === "INVALID_COMMUNICATION_QUERY_FILTER"
  );
});
