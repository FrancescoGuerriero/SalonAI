import assert
  from "node:assert/strict";

import test
  from "node:test";

import {
  buildAvailableSlots,
  parseBookingDate,
  stylistOffersService,
} from "../services/bookingAvailabilityService.js";

const FUTURE_DATE =
  "2030-06-15";

const BEFORE_FUTURE_DATE =
  new Date(
    "2030-06-14T12:00:00.000Z"
  );

test(
  "parseBookingDate accepts real calendar dates in the salon timezone",
  () => {
    const date =
      parseBookingDate(
        FUTURE_DATE
      );

    /*
     * 15 June 2030 is BST.
     * Noon London = 11:00 UTC.
     */
    assert.equal(
      date.toISOString(),
      "2030-06-15T11:00:00.000Z"
    );
  }
);

test(
  "parseBookingDate rejects impossible calendar dates",
  () => {
    assert.throws(
      () =>
        parseBookingDate(
          "2030-02-30"
        ),
      /valid calendar date/
    );
  }
);

test(
  "buildAvailableSlots fits the complete service inside working hours",
  () => {
    const slots =
      buildAvailableSlots({
        date:
          FUTURE_DATE,

        ranges: [
          {
            start:
              "09:00",
            end:
              "11:00",
          },
        ],

        duration: 60,

        now:
          BEFORE_FUTURE_DATE,
      });

    assert.deepEqual(
      slots,
      [
        "09:00",
        "09:30",
        "10:00",
      ]
    );
  }
);

test(
  "buildAvailableSlots removes times that overlap absolute appointments",
  () => {
    const slots =
      buildAvailableSlots({
        date:
          FUTURE_DATE,

        ranges: [
          {
            start:
              "09:00",
            end:
              "12:00",
          },
        ],

        duration: 60,

        now:
          BEFORE_FUTURE_DATE,

        appointments: [
          {
            /*
             * 09:30-10:30 London
             * during BST.
             */
            startsAt:
              new Date(
                "2030-06-15T08:30:00.000Z"
              ),

            endsAt:
              new Date(
                "2030-06-15T09:30:00.000Z"
              ),

            status:
              "confirmed",
          },
        ],
      });

    assert.deepEqual(
      slots,
      [
        "10:30",
        "11:00",
      ]
    );
  }
);

test(
  "buildAvailableSlots reconstructs legacy appointment date and time in salon timezone",
  () => {
    const slots =
      buildAvailableSlots({
        date:
          FUTURE_DATE,

        ranges: [
          {
            start:
              "09:00",
            end:
              "12:00",
          },
        ],

        duration: 60,

        now:
          BEFORE_FUTURE_DATE,

        appointments: [
          {
            appointmentDate:
              new Date(
                "2030-06-15T11:00:00.000Z"
              ),

            appointmentTime:
              "09:30",

            duration:
              60,

            status:
              "confirmed",
          },
        ],
      });

    assert.deepEqual(
      slots,
      [
        "10:30",
        "11:00",
      ]
    );
  }
);

test(
  "buildAvailableSlots removes approved time-off intervals",
  () => {
    const slots =
      buildAvailableSlots({
        date:
          FUTURE_DATE,

        ranges: [
          {
            start:
              "09:00",
            end:
              "12:00",
          },
        ],

        duration: 30,

        now:
          BEFORE_FUTURE_DATE,

        timeOff: [
          {
            /*
             * 10:00-11:00 London
             * during BST.
             */
            startsAt:
              new Date(
                "2030-06-15T09:00:00.000Z"
              ),

            endsAt:
              new Date(
                "2030-06-15T10:00:00.000Z"
              ),
          },
        ],
      });

    assert.deepEqual(
      slots,
      [
        "09:00",
        "09:30",
        "11:00",
        "11:30",
      ]
    );
  }
);

test(
  "buildAvailableSlots ignores cancelled appointments",
  () => {
    const slots =
      buildAvailableSlots({
        date:
          FUTURE_DATE,

        ranges: [
          {
            start:
              "09:00",
            end:
              "10:00",
          },
        ],

        duration: 30,

        now:
          BEFORE_FUTURE_DATE,

        appointments: [
          {
            appointmentDate:
              new Date(
                "2030-06-15T11:00:00.000Z"
              ),

            appointmentTime:
              "09:00",

            duration: 30,

            status:
              "cancelled",
          },
        ],
      });

    assert.deepEqual(
      slots,
      [
        "09:00",
        "09:30",
      ]
    );
  }
);

test(
  "buildAvailableSlots does not offer elapsed salon times",
  () => {
    const slots =
      buildAvailableSlots({
        date:
          FUTURE_DATE,

        ranges: [
          {
            start:
              "09:00",
            end:
              "11:00",
          },
        ],

        duration: 30,

        /*
         * 09:35 London =
         * 08:35 UTC in June.
         */
        now:
          new Date(
            "2030-06-15T08:35:00.000Z"
          ),
      });

    assert.deepEqual(
      slots,
      [
        "10:00",
        "10:30",
      ]
    );
  }
);

test(
  "stylistOffersService enforces explicit service assignments",
  () => {
    assert.equal(
      stylistOffersService(
        {
          services: [
            {
              _id:
                "service-a",
            },

            "service-b",
          ],
        },

        "service-b"
      ),
      true
    );

    assert.equal(
      stylistOffersService(
        {
          services: [
            {
              _id:
                "service-a",
            },
          ],
        },

        "service-b"
      ),
      false
    );

    assert.equal(
      stylistOffersService(
        {
          services: [],
        },

        "service-b"
      ),
      true
    );
  }
);
