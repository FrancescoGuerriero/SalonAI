import assert
  from "node:assert/strict";

import test
  from "node:test";

import mongoose
  from "mongoose";

import Appointment
  from "../models/Appointment.js";

function appointmentIds() {
  return {
    customer:
      new mongoose.Types.ObjectId(),

    stylist:
      new mongoose.Types.ObjectId(),

    service:
      new mongoose.Types.ObjectId(),
  };
}

test(
  "Appointment stores summer salon wall time as the correct UTC instant",
  async () => {
    const ids =
      appointmentIds();

    const appointment =
      new Appointment({
        ...ids,

        appointmentDate:
          "2026-09-02",

        appointmentTime:
          "12:30",

        duration: 60,
        totalPrice: 68,
        status: "confirmed",
      });

    await appointment.validate();

    assert.equal(
      appointment.startsAt.toISOString(),
      "2026-09-02T11:30:00.000Z"
    );

    assert.equal(
      appointment.endsAt.toISOString(),
      "2026-09-02T12:30:00.000Z"
    );

    assert.equal(
      appointment.appointmentDate.toISOString(),
      "2026-09-02T11:00:00.000Z"
    );

    assert.equal(
      appointment.appointmentTime,
      "12:30"
    );
  }
);

test(
  "Appointment stores winter salon wall time using GMT",
  async () => {
    const ids =
      appointmentIds();

    const appointment =
      new Appointment({
        ...ids,

        appointmentDate:
          "2026-12-02",

        appointmentTime:
          "12:30",

        duration: 60,
        totalPrice: 68,
      });

    await appointment.validate();

    assert.equal(
      appointment.startsAt.toISOString(),
      "2026-12-02T12:30:00.000Z"
    );

    assert.equal(
      appointment.endsAt.toISOString(),
      "2026-12-02T13:30:00.000Z"
    );

    assert.equal(
      appointment.appointmentDate.toISOString(),
      "2026-12-02T12:00:00.000Z"
    );
  }
);

test(
  "Appointment rejects nonexistent spring DST wall time",
  async () => {
    const ids =
      appointmentIds();

    const appointment =
      new Appointment({
        ...ids,

        appointmentDate:
          "2026-03-29",

        appointmentTime:
          "01:30",

        duration: 60,
        totalPrice: 68,
      });

    await assert.rejects(
      appointment.validate(),
      /valid local time/
    );
  }
);

test(
  "Appointment rejects ambiguous autumn DST wall time",
  async () => {
    const ids =
      appointmentIds();

    const appointment =
      new Appointment({
        ...ids,

        appointmentDate:
          "2026-10-25",

        appointmentTime:
          "01:30",

        duration: 60,
        totalPrice: 68,
      });

    await assert.rejects(
      appointment.validate(),
      /ambiguous/
    );
  }
);

test(
  "recordReschedule retains London wall-clock time from UTC instant",
  () => {
    const ids =
      appointmentIds();

    const appointment =
      new Appointment({
        ...ids,

        appointmentDate:
          "2026-08-30",

        appointmentTime:
          "10:00",

        duration: 60,
        totalPrice: 68,
      });

    appointment.recordReschedule({
      stylist:
        ids.stylist,

      startsAt:
        new Date(
          "2026-09-02T11:30:00.000Z"
        ),

      endsAt:
        new Date(
          "2026-09-02T12:30:00.000Z"
        ),
    });

    assert.equal(
      appointment.appointmentTime,
      "12:30"
    );

    assert.equal(
      appointment.appointmentDate.toISOString(),
      "2026-09-02T11:00:00.000Z"
    );

    assert.equal(
      appointment.startsAt.toISOString(),
      "2026-09-02T11:30:00.000Z"
    );
  }
);
