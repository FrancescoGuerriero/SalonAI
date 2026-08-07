import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBookingConfirmationMessage,
  normaliseIncomingWhatsApp,
  normaliseWhatsAppPhone,
  splitCustomerName,
  validateBookingSessionInput,
} from "../features/premium/whatsapp/whatsappService.js";

test("WhatsApp phone numbers are stored in international format", () => {
  assert.equal(
    normaliseWhatsAppPhone("whatsapp:+44 7700 900123"),
    "+447700900123"
  );
  assert.equal(normaliseWhatsAppPhone("00447700900123"), "+447700900123");
  assert.throws(() => normaliseWhatsAppPhone("07700"), /international format/i);
});

test("Twilio and console webhook payloads map to one safe shape", () => {
  assert.deepEqual(
    normaliseIncomingWhatsApp({
      From: "whatsapp:+447700900123",
      Body: "  I would like to book  ",
      MessageSid: "SM123",
      ProfileName: "Alex Example",
    }),
    {
      phone: "+447700900123",
      message: "I would like to book",
      providerMessageId: "SM123",
      displayName: "Alex Example",
    }
  );
});

test("WhatsApp booking sessions require a complete valid slot", () => {
  assert.deepEqual(
    validateBookingSessionInput({
      serviceId: "service-id",
      stylistId: "stylist-id",
      appointmentDate: "2030-06-15",
      appointmentTime: "10:30",
    }),
    {
      serviceId: "service-id",
      stylistId: "stylist-id",
      appointmentDate: "2030-06-15",
      appointmentTime: "10:30",
    }
  );

  assert.throws(
    () =>
      validateBookingSessionInput({
        serviceId: "service-id",
        stylistId: "stylist-id",
        appointmentDate: "15/06/2030",
        appointmentTime: "10:30",
      }),
    /YYYY-MM-DD/
  );
});

test("WhatsApp customer names have safe booking fallbacks", () => {
  assert.deepEqual(splitCustomerName(""), {
    firstName: "WhatsApp",
    lastName: "Customer",
  });
  assert.deepEqual(splitCustomerName("Alex Morgan"), {
    firstName: "Alex",
    lastName: "Morgan",
  });
});

test("confirmation messages include the verified booking details", () => {
  const message = buildBookingConfirmationMessage({
    serviceName: "Cut and finish",
    stylistName: "Alex Morgan",
    appointmentDate: new Date("2030-06-15T10:30:00Z"),
    appointmentTime: "10:30",
  });

  assert.match(message, /confirmed/i);
  assert.match(message, /Cut and finish/);
  assert.match(message, /Alex Morgan/);
  assert.match(message, /10:30/);
});
