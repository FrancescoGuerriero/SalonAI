import assert from "node:assert/strict";
import test from "node:test";

import CommunicationCampaign from "../models/CommunicationCampaign.js";
import CommunicationTemplate from "../models/CommunicationTemplate.js";
import MessageDelivery from "../models/MessageDelivery.js";

test("communications ownership indexes remain tenant-aware", () => {
  const campaignSlug = CommunicationCampaign.schema.indexes().find(
    ([fields, options]) => fields.business === 1 && fields.slug === 1 && options.unique
  );
  const templateSlug = CommunicationTemplate.schema.indexes().find(
    ([fields, options]) => fields.business === 1 && fields.slug === 1 && options.unique
  );
  const providerLookup = MessageDelivery.schema.indexes().find(
    ([fields]) =>
      fields.business === 1 &&
      fields.provider === 1 &&
      fields.providerMessageId === 1
  );

  assert.ok(campaignSlug);
  assert.ok(templateSlug);
  assert.ok(providerLookup);
});
