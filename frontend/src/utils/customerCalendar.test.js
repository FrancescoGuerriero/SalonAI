import assert from "node:assert/strict";
import test from "node:test";

import {
  appointmentIcs,
  calendarEventFromAppointment,
  canAddAppointmentToCalendar,
  googleCalendarUrl,
  outlookCalendarUrl,
} from "./customerCalendar.js";

const appointment = {
  _id:
    "appointment-123",
  startsAt:
    "2099-05-18T13:00:00.000Z",
  endsAt:
    "2099-05-18T14:00:00.000Z",
  status: "confirmed",
  service: {
    name:
      "Cut & Finish",
  },
  stylist: {
    name:
      "Salon Stylist",
  },
};

test("customer calendar event is built without customer OAuth data", () => {
  const event =
    calendarEventFromAppointment(
      appointment,
      {
        salonName:
          "SalonAI",
        salonAddress:
          "London, UK",
      }
    );

  assert.equal(
    event.title,
    "Cut & Finish · SalonAI"
  );
  assert.equal(
    event.location,
    "London, UK"
  );
  assert.equal(
    event.timeZone,
    "Europe/London"
  );
  assert.equal(
    event.start.toISOString(),
    appointment.startsAt
  );
});

test("Google add-to-calendar link is a one-way prefilled event", () => {
  const event =
    calendarEventFromAppointment(
      appointment,
      {
        salonName:
          "SalonAI",
      }
    );
  const url =
    new URL(
      googleCalendarUrl(
        event
      )
    );

  assert.equal(
    url.hostname,
    "calendar.google.com"
  );
  assert.equal(
    url.searchParams.get(
      "action"
    ),
    "TEMPLATE"
  );
  assert.equal(
    url.searchParams.get(
      "stz"
    ),
    "Europe/London"
  );
  assert.match(
    url.searchParams.get(
      "dates"
    ),
    /^20990518T130000Z\/20990518T140000Z$/
  );
});

test("Outlook add-to-calendar link contains prefilled event times", () => {
  const event =
    calendarEventFromAppointment(
      appointment,
      {
        salonName:
          "SalonAI",
      }
    );
  const url =
    new URL(
      outlookCalendarUrl(
        event
      )
    );

  assert.equal(
    url.hostname,
    "outlook.live.com"
  );
  assert.equal(
    url.searchParams.get(
      "rru"
    ),
    "addevent"
  );
  assert.equal(
    url.searchParams.get(
      "startdt"
    ),
    "2099-05-18T13:00:00Z"
  );
  assert.equal(
    url.searchParams.get(
      "enddt"
    ),
    "2099-05-18T14:00:00Z"
  );
});

test("ICS export includes a complete VEVENT", () => {
  const event =
    calendarEventFromAppointment(
      appointment,
      {
        salonName:
          "SalonAI",
      }
    );
  const ics =
    appointmentIcs(
      event
    );

  assert.match(
    ics,
    /BEGIN:VCALENDAR/
  );
  assert.match(
    ics,
    /BEGIN:VEVENT/
  );
  assert.match(
    ics,
    /DTSTART:20990518T130000Z/
  );
  assert.match(
    ics,
    /DTEND:20990518T140000Z/
  );
  assert.match(
    ics,
    /SUMMARY:Cut & Finish · SalonAI/
  );
  assert.match(
    ics,
    /END:VEVENT/
  );
});

test("terminal appointments are not offered as future calendar additions", () => {
  for (const status of [
    "completed",
    "cancelled",
    "no_show",
  ]) {
    assert.equal(
      canAddAppointmentToCalendar({
        ...appointment,
        status,
      }),
      false
    );
  }

  assert.equal(
    canAddAppointmentToCalendar(
      appointment
    ),
    true
  );
});
