import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDemandForecastPayload,
} from "../features/aiRecommendations/aiDemandForecastingService.js";


function appointment({
  startsAt,
  status = "completed",
  serviceId = "service-cut",
  serviceName = "Cut and finish",
  servicePrice = 45,
  totalPrice = servicePrice,
  finalPrice,
  amountPaid,
} = {}) {
  return {
    startsAt:
      new Date(startsAt),

    status,

    service: {
      _id:
        serviceId,

      name:
        serviceName,

      price:
        servicePrice,
    },

    totalPrice,
    finalPrice,
    amountPaid,
  };
}


function shift({
  startsAt,
  endsAt,
  breakMinutes = 0,
  status = "published",
} = {}) {
  return {
    startsAt:
      new Date(startsAt),

    endsAt:
      new Date(endsAt),

    breakMinutes,
    status,
  };
}


function stylist({
  workingHours,
} = {}) {
  return {
    isActive: true,

    workingHours:
      workingHours || [
        {
          day: "Monday",
          available: true,
          start: "09:00",
          end: "17:00",
        },
        {
          day: "Tuesday",
          available: true,
          start: "09:00",
          end: "17:00",
        },
        {
          day: "Wednesday",
          available: true,
          start: "09:00",
          end: "17:00",
        },
        {
          day: "Thursday",
          available: true,
          start: "09:00",
          end: "17:00",
        },
        {
          day: "Friday",
          available: true,
          start: "09:00",
          end: "17:00",
        },
        {
          day: "Saturday",
          available: true,
          start: "09:00",
          end: "17:00",
        },
        {
          day: "Sunday",
          available: false,
          start: "09:00",
          end: "17:00",
        },
      ],
  };
}


function observationByDate(
  payload,
  date
) {
  return payload.observations.find(
    (observation) =>
      observation.business_date ===
      date
  );
}


test(
  "buildDemandForecastPayload creates the requested history",
  () => {
    const payload =
      buildDemandForecastPayload({
        asOfDate:
          "2026-07-28",

        lookbackDays:
          28,

        appointments:
          [],

        shifts:
          [],

        stylists: [
          stylist(),
        ],
      });

    assert.equal(
      payload.as_of_date,
      "2026-07-28"
    );

    assert.equal(
      payload.observations.length,
      28
    );

    assert.equal(
      payload
        .observations[0]
        .business_date,
      "2026-07-01"
    );

    assert.equal(
      payload
        .observations
        .at(-1)
        .business_date,
      "2026-07-28"
    );

    assert.equal(
      payload.settings.horizon_days,
      28
    );

    assert.deepEqual(
      payload.settings.business_days,
      [
        0,
        1,
        2,
        3,
        4,
        5,
      ]
    );
  }
);


test(
  "appointments are aggregated by date and status",
  () => {
    const payload =
      buildDemandForecastPayload({
        asOfDate:
          "2026-07-28",

        lookbackDays:
          28,

        stylists: [
          stylist(),
        ],

        appointments: [
          appointment({
            startsAt:
              "2026-07-27T09:00:00.000Z",

            status:
              "completed",

            amountPaid:
              50,
          }),

          appointment({
            startsAt:
              "2026-07-27T11:00:00.000Z",

            status:
              "cancelled",
          }),

          appointment({
            startsAt:
              "2026-07-27T14:00:00.000Z",

            status:
              "no_show",
          }),

          appointment({
            startsAt:
              "2026-07-27T16:00:00.000Z",

            status:
              "confirmed",
          }),
        ],
      });

    const observation =
      observationByDate(
        payload,
        "2026-07-27"
      );

    assert.ok(observation);

    assert.equal(
      observation.booked_appointments,
      4
    );

    assert.equal(
      observation.completed_appointments,
      1
    );

    assert.equal(
      observation.cancelled_appointments,
      1
    );

    assert.equal(
      observation.no_show_appointments,
      1
    );

    assert.equal(
      observation.pending_appointments,
      1
    );

    assert.equal(
      observation.total_revenue,
      50
    );
  }
);


test(
  "completed appointment revenue uses paid or final values",
  () => {
    const payload =
      buildDemandForecastPayload({
        asOfDate:
          "2026-07-28",

        lookbackDays:
          28,

        stylists: [
          stylist(),
        ],

        appointments: [
          appointment({
            startsAt:
              "2026-07-25T09:00:00.000Z",

            amountPaid:
              75,

            finalPrice:
              90,

            totalPrice:
              100,
          }),

          appointment({
            startsAt:
              "2026-07-25T11:00:00.000Z",

            amountPaid:
              0,

            finalPrice:
              65,

            totalPrice:
              80,
          }),

          appointment({
            startsAt:
              "2026-07-25T13:00:00.000Z",

            status:
              "cancelled",

            amountPaid:
              100,
          }),
        ],
      });

    const observation =
      observationByDate(
        payload,
        "2026-07-25"
      );

    assert.equal(
      observation.total_revenue,
      140
    );
  }
);


test(
  "service demand is aggregated without customer data",
  () => {
    const payload =
      buildDemandForecastPayload({
        asOfDate:
          "2026-07-28",

        lookbackDays:
          28,

        stylists: [
          stylist(),
        ],

        appointments: [
          appointment({
            startsAt:
              "2026-07-24T09:00:00.000Z",

            serviceId:
              "service-cut",

            serviceName:
              "Cut and finish",

            amountPaid:
              45,
          }),

          appointment({
            startsAt:
              "2026-07-24T10:00:00.000Z",

            serviceId:
              "service-cut",

            serviceName:
              "Cut and finish",

            status:
              "cancelled",
          }),

          appointment({
            startsAt:
              "2026-07-24T14:00:00.000Z",

            serviceId:
              "service-colour",

            serviceName:
              "Colour service",

            amountPaid:
              80,
          }),
        ],
      });

    const observation =
      observationByDate(
        payload,
        "2026-07-24"
      );

    assert.equal(
      observation.services.length,
      2
    );

    const cut =
      observation.services.find(
        (service) =>
          service.service_key ===
          "service-cut"
      );

    const colour =
      observation.services.find(
        (service) =>
          service.service_key ===
          "service-colour"
      );

    assert.equal(
      cut.booked_appointments,
      2
    );

    assert.equal(
      cut.completed_appointments,
      1
    );

    assert.equal(
      cut.cancelled_appointments,
      1
    );

    assert.equal(
      cut.revenue,
      45
    );

    assert.equal(
      colour.booked_appointments,
      1
    );

    assert.equal(
      colour.revenue,
      80
    );

    const serialised =
      JSON.stringify(payload);

    assert.equal(
      serialised.includes(
        "customer"
      ),
      false
    );

    assert.equal(
      serialised.includes(
        "email"
      ),
      false
    );

    assert.equal(
      serialised.includes(
        "phone"
      ),
      false
    );
  }
);


test(
  "appointments are grouped into time buckets",
  () => {
    const payload =
      buildDemandForecastPayload({
        asOfDate:
          "2026-07-28",

        lookbackDays:
          28,

        stylists: [
          stylist(),
        ],

        appointments: [
          appointment({
            startsAt:
              "2026-07-23T08:00:00.000Z",
          }),

          appointment({
            startsAt:
              "2026-07-23T12:00:00.000Z",
          }),

          appointment({
            startsAt:
              "2026-07-23T17:00:00.000Z",
          }),
        ],
      });

    const observation =
      observationByDate(
        payload,
        "2026-07-23"
      );

    const buckets =
      Object.fromEntries(
        observation
          .time_buckets
          .map(
            (bucket) => [
              bucket.bucket,
              bucket,
            ]
          )
      );

    assert.equal(
      buckets
        .morning
        .booked_appointments,
      1
    );

    assert.equal(
      buckets
        .afternoon
        .booked_appointments,
      1
    );

    assert.equal(
      buckets
        .evening
        .booked_appointments,
      1
    );
  }
);


test(
  "published rota shifts provide available staff hours",
  () => {
    const payload =
      buildDemandForecastPayload({
        asOfDate:
          "2026-07-28",

        lookbackDays:
          28,

        stylists: [
          stylist(),
        ],

        shifts: [
          shift({
            startsAt:
              "2026-07-22T08:00:00.000Z",

            endsAt:
              "2026-07-22T16:00:00.000Z",

            breakMinutes:
              60,
          }),

          shift({
            startsAt:
              "2026-07-22T09:00:00.000Z",

            endsAt:
              "2026-07-22T17:00:00.000Z",

            breakMinutes:
              30,
          }),
        ],
      });

    const observation =
      observationByDate(
        payload,
        "2026-07-22"
      );

    assert.equal(
      observation.available_staff_hours,
      14.5
    );

    assert.equal(
      observation.appointment_capacity,
      11
    );
  }
);


test(
  "stylist working hours provide fallback capacity",
  () => {
    const payload =
      buildDemandForecastPayload({
        asOfDate:
          "2026-07-28",

        lookbackDays:
          28,

        appointments:
          [],

        shifts:
          [],

        stylists: [
          stylist(),
          stylist(),
        ],

        appointmentsPerStaffHour:
          0.75,
      });

    const monday =
      observationByDate(
        payload,
        "2026-07-27"
      );

    assert.equal(
      monday.available_staff_hours,
      16
    );

    assert.equal(
      monday.appointment_capacity,
      12
    );

    const sunday =
      observationByDate(
        payload,
        "2026-07-26"
      );

    assert.equal(
      sunday.available_staff_hours,
      0
    );

    assert.equal(
      sunday.appointment_capacity,
      0
    );
  }
);


test(
  "custom forecasting settings are normalised",
  () => {
    const payload =
      buildDemandForecastPayload({
        asOfDate:
          "2026-07-28",

        lookbackDays:
          120,

        horizonDays:
          42,

        minimumHistoryDays:
          40,

        recentWindowDays:
          21,

        baselineWindowDays:
          70,

        confidenceLevel:
          0.95,

        targetUtilisation:
          0.85,

        appointmentsPerStaffHour:
          1,

        staffShiftHours:
          7.5,

        businessDays:
          [
            0,
            1,
            2,
            3,
            4,
          ],

        includeRevenueForecast:
          false,

        stylists: [
          stylist(),
        ],
      });

    assert.equal(
      payload.observations.length,
      120
    );

    assert.equal(
      payload.settings.horizon_days,
      42
    );

    assert.equal(
      payload
        .settings
        .minimum_history_days,
      40
    );

    assert.equal(
      payload
        .settings
        .recent_window_days,
      21
    );

    assert.equal(
      payload
        .settings
        .baseline_window_days,
      70
    );

    assert.equal(
      payload
        .settings
        .confidence_level,
      0.95
    );

    assert.equal(
      payload
        .settings
        .target_utilisation,
      0.85
    );

    assert.equal(
      payload
        .settings
        .appointments_per_staff_hour,
      1
    );

    assert.equal(
      payload
        .settings
        .staff_shift_hours,
      7.5
    );

    assert.deepEqual(
      payload.settings.business_days,
      [
        0,
        1,
        2,
        3,
        4,
      ]
    );

    assert.equal(
      payload
        .settings
        .include_revenue_forecast,
      false
    );
  }
);


test(
  "invalid as-of dates are rejected",
  () => {
    assert.throws(
      () =>
        buildDemandForecastPayload({
          asOfDate:
            "28-07-2026",

          lookbackDays:
            28,

          appointments:
            [],

          shifts:
            [],

          stylists:
            [],
        }),

      (error) => {
        assert.equal(
          error.code,
          "INVALID_DEMAND_FORECAST_DATE"
        );

        assert.equal(
          error.status,
          400
        );

        return true;
      }
    );
  }
);