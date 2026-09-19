import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  isAdviserProposalPreparable,
  prepareCampaignDraftFromProposal,
} from "../features/aiRecommendations/aiAdviserProposalPreparationService.js";

test("only the low-risk campaign review proposal can prepare a draft", () => {
  assert.equal(
    isAdviserProposalPreparable(
      "communications.campaign_review"
    ),
    true
  );

  for (const actionType of [
    "appointment.reschedule_review",
    "appointment.cancel_review",
    "customer.follow_up_review",
    "inventory.restock_review",
    "service.catalogue_review",
  ]) {
    assert.equal(
      isAdviserProposalPreparable(
        actionType
      ),
      false
    );
  }
});

test("campaign preparation always creates an unscheduled draft through the canonical duplicate service", async () => {
  let call = null;

  const result =
    await prepareCampaignDraftFromProposal(
      {
        actionType:
          "communications.campaign_review",
        targetId:
          "campaign-123",
        proposedChanges: {
          channel:
            "sms",
          scheduledFor:
            "2026-10-01T10:00:00Z",
          reason:
            "AI suggestion",
        },
      },
      {
        _id:
          "user-1",
      },
      {
        duplicateCampaign:
          async (
            campaignId,
            payload,
            user
          ) => {
            call = {
              campaignId,
              payload,
              user,
            };

            return {
              _id:
                "draft-456",
              status:
                "draft",
            };
          },
      }
    );

  assert.equal(
    call.campaignId,
    "campaign-123"
  );
  assert.equal(
    call.payload.channel,
    "sms"
  );
  assert.deepEqual(
    call.payload.schedule,
    {
      mode: "draft",
      scheduledAt: null,
    }
  );
  assert.equal(
    "scheduledFor" in
      call.payload,
    false
  );
  assert.equal(
    result.entityId,
    "draft-456"
  );
  assert.equal(
    result.status,
    "draft"
  );
});

test("draft preparation service cannot launch, schedule, send or mutate appointments and inventory", async () => {
  const source =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserProposalPreparationService.js",
        import.meta.url
      ),
      "utf8"
    );

  for (const forbidden of [
    "launchCommunicationCampaign",
    "scheduleCommunicationCampaign",
    "sendCommunication",
    "sendWhatsApp",
    "sendSms",
    "rescheduleAppointment",
    "changeAppointmentStatus",
    "inventory",
    "purchaseOrder",
  ]) {
    assert.equal(
      source.includes(
        forbidden
      ),
      false
    );
  }

  assert.match(
    source,
    /duplicateCommunicationCampaign/
  );
  assert.match(
    source,
    /deliveryTriggered:\s*false/
  );
});

test("Adviser preparation endpoint remains behind ai:use and is explicitly separate from review", async () => {
  const routes =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiRecommendationRoutes.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    routes,
    /"\/adviser\/proposals\/:proposalId\/prepare"[\s\S]*?"ai:use"[\s\S]*?prepareProposalDraft/
  );
  assert.equal(
    /adviser\/proposals[^"\n]*execute/.test(
      routes
    ),
    false
  );
});
