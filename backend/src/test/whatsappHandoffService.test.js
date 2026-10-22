import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResumeWhatsAppBotMutation,
  isExpiredUnconfirmedWhatsAppBooking,
  resolveWhatsAppResumeMode,
} from "../features/premium/whatsapp/whatsappHandoffService.js";

function conversation(overrides = {}) {
  const bookingSession = {
    stage: "review",
    serviceId: "service-1",
    stylistId: "stylist-1",
    appointmentDate:
      new Date(
        "2030-06-15T12:00:00.000Z"
      ),
    appointmentTime: "15:00",
    duration: 60,
    price: 68,
    availableSlots: [],
    appointmentId: null,
    confirmed: false,
    confirmationState: "pending",
    confirmedAt: null,
    confirmedBy: null,
    expiresAt:
      new Date(
        "2030-06-01T10:00:00.000Z"
      ),
    ...(overrides.bookingSession || {}),
  };

  const automation = {
    mode: "human",
    handoffRequested: true,
    handoffReason:
      "customer_confirmed_slot",
    ...(overrides.automation || {}),
  };

  return {
    _id: "conversation-1",
    status: "awaiting_confirmation",
    assignedTo: "manager-1",
    ...overrides,
    bookingSession,
    automation,
  };
}

test(
  "expired unconfirmed WhatsApp handoff resets stale booking state before bot resume",
  () => {
    const now =
      new Date(
        "2030-06-01T10:30:00.000Z"
      );

    const current =
      conversation();

    assert.equal(
      isExpiredUnconfirmedWhatsAppBooking(
        current,
        { now }
      ),
      true
    );

    const mutation =
      buildResumeWhatsAppBotMutation(
        current,
        { now }
      );

    assert.equal(
      mutation.staleBookingReset,
      true
    );

    assert.equal(
      mutation.update.$set.assignedTo,
      null
    );

    assert.equal(
      mutation.update.$set[
        "automation.mode"
      ],
      "bot"
    );

    assert.equal(
      mutation.update.$set[
        "automation.handoffRequested"
      ],
      false
    );

    assert.equal(
      mutation.update.$set.status,
      "open"
    );

    assert.equal(
      mutation.update.$set[
        "bookingSession.stage"
      ],
      "idle"
    );

    assert.equal(
      mutation.update.$set[
        "bookingSession.expiresAt"
      ],
      null
    );

    assert.equal(
      Object.hasOwn(
        mutation.update.$set,
        "messages"
      ),
      false
    );

    assert.deepEqual(
      mutation.filter[
        "bookingSession.expiresAt"
      ],
      { $lte: now }
    );
  }
);

test(
  "active pending booking is preserved while human handoff is released",
  () => {
    const now =
      new Date(
        "2030-06-01T09:30:00.000Z"
      );

    const mutation =
      buildResumeWhatsAppBotMutation(
        conversation(),
        { now }
      );

    assert.equal(
      mutation.staleBookingReset,
      false
    );

    assert.equal(
      mutation.update.$set[
        "automation.mode"
      ],
      "bot"
    );

    assert.equal(
      mutation.update.$set.assignedTo,
      null
    );

    assert.equal(
      Object.hasOwn(
        mutation.update.$set,
        "bookingSession.stage"
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        mutation.update.$set,
        "status"
      ),
      false
    );
  }
);

test(
  "booking confirmation in progress blocks bot resume",
  () => {
    const current =
      conversation({
        bookingSession: {
          confirmationState:
            "processing",
        },
      });

    assert.throws(
      () =>
        buildResumeWhatsAppBotMutation(
          current
        ),
      (error) => {
        assert.equal(
          error.statusCode,
          409
        );

        assert.equal(
          error.code,
          "WHATSAPP_BOT_RESUME_CONFIRMATION_IN_PROGRESS"
        );

        return true;
      }
    );
  }
);

test(
  "completed booking blocks handoff resume from corrupting appointment state",
  () => {
    const current =
      conversation({
        bookingSession: {
          appointmentId:
            "appointment-1",
          confirmed: true,
          confirmationState:
            "completed",
          stage: "confirmed",
        },
      });

    assert.throws(
      () =>
        buildResumeWhatsAppBotMutation(
          current
        ),
      (error) => {
        assert.equal(
          error.statusCode,
          409
        );

        assert.equal(
          error.code,
          "WHATSAPP_BOT_RESUME_BOOKING_COMPLETED"
        );

        return true;
      }
    );
  }
);

test(
  "resume mutation is idempotent for an already released active session",
  () => {
    const current =
      conversation({
        assignedTo: null,
        automation: {
          mode: "bot",
          handoffRequested: false,
          handoffReason: "",
        },
      });

    const mutation =
      buildResumeWhatsAppBotMutation(
        current,
        {
          now: new Date(
            "2030-06-01T09:30:00.000Z"
          ),
        }
      );

    assert.equal(
      mutation.staleBookingReset,
      false
    );

    assert.equal(
      mutation.update.$set.assignedTo,
      null
    );

    assert.equal(
      mutation.update.$set[
        "automation.mode"
      ],
      "bot"
    );

    assert.equal(
      mutation.update.$set[
        "automation.handoffRequested"
      ],
      false
    );
  }
);

test(
  "collectable scoped consultation resumes directly into consultation mode",
  () => {
    const current = conversation({
      activeConsultationId: "consultation-1",
    });
    const consultationSession = {
      _id: "consultation-1",
      status: "more_information_required",
    };

    assert.equal(
      resolveWhatsAppResumeMode(current, consultationSession),
      "consultation"
    );

    const mutation = buildResumeWhatsAppBotMutation(current, {
      now: new Date("2030-06-01T09:30:00.000Z"),
      consultationSession,
    });

    assert.equal(mutation.resumeMode, "consultation");
    assert.equal(
      mutation.update.$set["automation.mode"],
      "consultation"
    );
    assert.equal(
      mutation.update.$set["automation.lastAction"],
      "resume_consultation"
    );
    assert.equal(
      mutation.update.$set["automation.lastIntent"],
      "consultation"
    );
  }
);

test(
  "consultations awaiting or beyond human review do not re-enter automated collection",
  () => {
    const current = conversation({
      activeConsultationId: "consultation-1",
    });

    for (const status of [
      "awaiting_review",
      "in_person_required",
      "approved",
      "booking_ready",
      "booked",
      "closed",
      "archived",
    ]) {
      const consultationSession = {
        _id: "consultation-1",
        status,
      };

      assert.equal(
        resolveWhatsAppResumeMode(current, consultationSession),
        "bot",
        status
      );
    }
  }
);

test(
  "mismatched or missing consultation evidence fails closed to generic bot mode",
  () => {
    const current = conversation({
      activeConsultationId: "consultation-1",
    });

    assert.equal(resolveWhatsAppResumeMode(current, null), "bot");
    assert.equal(
      resolveWhatsAppResumeMode(current, {
        _id: "consultation-2",
        status: "in_progress",
      }),
      "bot"
    );
  }
);
