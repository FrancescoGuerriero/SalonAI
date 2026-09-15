import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import Stylist from "../models/Stylist.js";
import {
  resolveStylistName,
} from "../features/premium/whatsapp/stylistName.js";
import {
  buildBookingConfirmationMessage,
} from "../features/premium/whatsapp/whatsappService.js";


test(
  "resolves legacy stylist name from a hydrated Mongoose document",
  () => {
    const legacyStylist =
      Stylist.hydrate({
        _id:
          new mongoose.Types.ObjectId(),
        name:
          "Emma Johnson",
      });

    /*
     * Reproduces the production
     * legacy-data behaviour.
     */
    assert.equal(
      legacyStylist.name,
      undefined
    );

    assert.equal(
      legacyStylist.fullName,
      "undefined undefined"
    );

    assert.equal(
      legacyStylist
        .toObject({
          virtuals: false,
        })
        .name,
      "Emma Johnson"
    );

    assert.equal(
      resolveStylistName(
        legacyStylist
      ),
      "Emma Johnson"
    );
  }
);


test(
  "resolves modern first and last name stylist documents",
  () => {
    const stylist =
      Stylist.hydrate({
        _id:
          new mongoose.Types.ObjectId(),
        firstName:
          "Emma",
        lastName:
          "Johnson",
      });

    assert.equal(
      resolveStylistName(
        stylist
      ),
      "Emma Johnson"
    );
  }
);


test(
  "resolves plain legacy name records",
  () => {
    assert.equal(
      resolveStylistName({
        name:
          "Emma Johnson",
      }),
      "Emma Johnson"
    );
  }
);


test(
  "resolves plain fullName records",
  () => {
    assert.equal(
      resolveStylistName({
        fullName:
          "Emma Johnson",
      }),
      "Emma Johnson"
    );
  }
);


test(
  "uses a safe fallback when no stylist name exists",
  () => {
    assert.equal(
      resolveStylistName({}),
      "Salon professional"
    );
  }
);


test(
  "final WhatsApp confirmation contains legacy stylist name",
  () => {
    const legacyStylist =
      Stylist.hydrate({
        _id:
          new mongoose.Types.ObjectId(),
        name:
          "Emma Johnson",
      });

    const message =
      buildBookingConfirmationMessage({
        serviceName:
          "Blow-dry",
        stylistName:
          resolveStylistName(
            legacyStylist
          ),
        appointmentDate:
          new Date(
            "2026-09-15T11:30:00.000Z"
          ),
        appointmentTime:
          "12:30",
      });

    assert.match(
      message,
      /Service: Blow-dry\./
    );

    assert.match(
      message,
      /Stylist: Emma Johnson\./
    );

    assert.match(
      message,
      /Time: 12:30\./
    );

    assert.doesNotMatch(
      message,
      /undefined undefined/
    );
  }
);
