import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import AiActionProposal from "../features/aiPlatform/AiActionProposal.js";
import {
  sanitiseProposalChanges,
  suggestAdviserActions,
} from "../features/aiRecommendations/aiAdviserProposalService.js";

test("Adviser action suggestions are page-context and permission scoped", () => {
  const appointmentUser = {
    role: "admin",
    permissions: [
      "ai:use",
      "appointment:update",
    ],
  };

  const actions =
    suggestAdviserActions({
      contextPath:
        "/calendar",
      user:
        appointmentUser,
    });

  assert.deepEqual(
    actions.map(
      (action) =>
        action.actionType
    ),
    [
      "appointment.reschedule_review",
    ]
  );
  assert.equal(
    actions[0]
      .automaticExecution,
    false
  );
  assert.equal(
    actions[0]
      .requiresHumanApproval,
    true
  );

  const noPermission =
    suggestAdviserActions({
      contextPath:
        "/calendar",
      user: {
        role: "admin",
        permissions: [
          "ai:use",
        ],
      },
    });

  assert.deepEqual(
    noPermission,
    []
  );
});

test("proposal changes are allow-listed and reject sensitive data", () => {
  assert.deepEqual(
    sanitiseProposalChanges({
      actionType:
        "appointment.reschedule_review",
      proposedChanges: {
        startsAt:
          "2026-10-01T09:00:00Z",
        endsAt:
          "2026-10-01T10:00:00Z",
        reason:
          "Customer requested a later slot.",
      },
    }),
    {
      startsAt:
        "2026-10-01T09:00:00Z",
      endsAt:
        "2026-10-01T10:00:00Z",
      reason:
        "Customer requested a later slot.",
    }
  );

  assert.throws(
    () =>
      sanitiseProposalChanges({
        actionType:
          "appointment.reschedule_review",
        proposedChanges: {
          customerEmail:
            "customer@example.com",
        },
      }),
    /not allowed/
  );

  assert.throws(
    () =>
      sanitiseProposalChanges({
        actionType:
          "customer.follow_up_review",
        proposedChanges: {
          reason: {
            phone:
              "+440000000000",
          },
        },
      }),
    /Sensitive field/
  );
});

test("proposal model records approval separately from execution and has no executable state", () => {
  const paths =
    AiActionProposal
      .schema
      .paths;

  assert.equal(
    Boolean(
      paths.status
    ),
    true
  );
  assert.equal(
    Boolean(
      paths.reviewedBy
    ),
    true
  );
  assert.equal(
    Boolean(
      paths.reviewedAt
    ),
    true
  );
  assert.equal(
    Boolean(
      paths.executionStatus
    ),
    true
  );
  assert.deepEqual(
    paths.executionStatus
      .options.enum,
    [
      "blocked",
    ]
  );
});

test("Adviser proposal API requires ai:use and exposes no execute route", async () => {
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
    /"\/adviser\/proposals"[\s\S]*?"ai:use"[\s\S]*?listProposals/
  );
  assert.match(
    routes,
    /"\/adviser\/proposals"[\s\S]*?"ai:use"[\s\S]*?createProposal/
  );
  assert.match(
    routes,
    /"\/adviser\/proposals\/:proposalId\/review"[\s\S]*?"ai:use"[\s\S]*?reviewProposal/
  );
  assert.equal(
    /adviser\/proposals[^"\n]*execute/.test(
      routes
    ),
    false
  );
});

test("proposal governance does not import or invoke operational mutation services", async () => {
  const service =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserProposalService.js",
        import.meta.url
      ),
      "utf8"
    );

  for (const mutation of [
    "rescheduleAppointment",
    "changeAppointmentStatus",
    "createManagedAppointment",
    "queueDormantOutreach",
    "queuePostAppointmentFollowUps",
    "updateProviderEvent",
    "deleteProviderEvent",
  ]) {
    assert.equal(
      service.includes(
        mutation
      ),
      false
    );
  }

  assert.match(
    service,
    /automaticExecution:\s*false/
  );
  assert.match(
    service,
    /executionStatus\s*=\s*"blocked"/
  );
  assert.match(
    service,
    /AuditLog\.create/
  );
});

test("Adviser query surfaces proposal templates without creating proposals", async () => {
  const service =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    service,
    /suggestAdviserActions/
  );
  assert.match(
    service,
    /suggestedActions/
  );
  assert.equal(
    service.includes(
      "AiActionProposal.create"
    ),
    false
  );
  assert.equal(
    service.includes(
      "createAdviserActionProposal"
    ),
    false
  );
  assert.match(
    service,
    /readOnly:\s*true/
  );
});
