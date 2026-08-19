import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import Appointment from "../models/Appointment.js";

function appointmentData(
  overrides = {}
) {
  return {
    customer:
      new mongoose.Types.ObjectId(),

    stylist:
      new mongoose.Types.ObjectId(),

    service:
      new mongoose.Types.ObjectId(),

    appointmentDate:
      new Date(
        "2030-01-01T10:00:00.000Z"
      ),

    appointmentTime:
      "10:00",

    totalPrice:
      50,

    ...overrides,
  };
}

test(
  "appointment without invoice number leaves the field absent",
  () => {
    const appointment =
      new Appointment(
        appointmentData()
      );

    assert.equal(
      appointment.invoiceNumber,
      undefined
    );
  }
);

test(
  "null invoice number is normalised to an absent field",
  () => {
    const appointment =
      new Appointment(
        appointmentData({
          invoiceNumber: null,
        })
      );

    assert.equal(
      appointment.invoiceNumber,
      undefined
    );
  }
);

test(
  "blank invoice number is normalised to an absent field",
  () => {
    const appointment =
      new Appointment(
        appointmentData({
          invoiceNumber: "   ",
        })
      );

    assert.equal(
      appointment.invoiceNumber,
      undefined
    );
  }
);

test(
  "real invoice numbers are trimmed and retained",
  () => {
    const appointment =
      new Appointment(
        appointmentData({
          invoiceNumber:
            "  INV-2026-0001  ",
        })
      );

    assert.equal(
      appointment.invoiceNumber,
      "INV-2026-0001"
    );
  }
);