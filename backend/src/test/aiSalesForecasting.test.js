import assert from "node:assert/strict";
import test from "node:test";

import {
  AiSalesForecastingError,
  buildSalesForecastPayload,
} from "../features/aiRecommendations/aiSalesForecastingService.js";


const AS_OF_DATE = "2026-07-28";


function objectId(value) {
  return {
    _id: value,

    toString() {
      return value;
    },
  };
}


function buildCompletedAppointment({
  id = "appointment-1",
  completedAt = "2026-07-27T14:00:00.000Z",
  totalPrice = 80,
  discount = 5,
  tax = 0,
  amountPaid = 75,
  paymentStatus = "paid",
  serviceCategory = "Haircut",
} = {}) {
  return {
    _id: id,
    completedAt: new Date(
      completedAt
    ),
    startsAt: new Date(
      completedAt
    ),
    appointmentDate: new Date(
      completedAt
    ),
    status: "completed",
    totalPrice,
    discount,
    tax,
    finalPrice:
      totalPrice -
      discount,
    amountPaid,
    paymentStatus,

    service: {
      _id:
        `service-${id}`,

      name:
        "Cut and Finish",

      category:
        serviceCategory,

      price:
        totalPrice,
    },
  };
}


function buildOrder({
  id = "order-1",
  updatedAt = "2026-07-27T15:00:00.000Z",
  subtotal = 50,
  discountTotal = 5,
  total = 45,
  status = "completed",
} = {}) {
  return {
    _id: id,
    updatedAt: new Date(
      updatedAt
    ),
    createdAt: new Date(
      updatedAt
    ),
    subtotal,
    discountTotal,
    total,
    status,

    items: [
      {
        product: {
          _id: "product-1",
          name: "Repair Shampoo",
          category: "Shampoo",
          price: 20,
          costPrice: 8,
        },

        name: "Repair Shampoo",
        quantity: 2,
        unitPrice: 20,
        lineTotal: 40,
      },

      {
        product: {
          _id: "product-2",
          name: "Hair Oil",
          category: "Treatment",
          price: 10,
          costPrice: 3,
        },

        name: "Hair Oil",
        quantity: 1,
        unitPrice: 10,
        lineTotal: 10,
      },
    ],
  };
}


function buildPayment({
  id = "payment-1",
  paidAt = "2026-07-27T16:00:00.000Z",
  purpose = "other",
  amount = 30,
  status = "paid",
  appointment = null,
  order = null,
  metadata = {},
} = {}) {
  return {
    _id: id,
    paidAt: new Date(
      paidAt
    ),
    createdAt: new Date(
      paidAt
    ),
    updatedAt: new Date(
      paidAt
    ),
    purpose,
    amount,
    currency: "GBP",
    status,
    appointment,
    order,
    metadata,
  };
}


function findObservation(
  payload,
  businessDate
) {
  return (
    payload.observations.find(
      (item) =>
        item.business_date ===
        businessDate
    )
  );
}


test(
  "buildSalesForecastPayload creates the complete history window",
  () => {
    const payload =
      buildSalesForecastPayload({
        asOfDate:
          AS_OF_DATE,

        lookbackDays:
          90,
      });

    assert.equal(
      payload.as_of_date,
      AS_OF_DATE
    );

    assert.equal(
      payload
        .observations
        .length,
      90
    );

    assert.equal(
      payload
        .observations
        .at(-1)
        .business_date,
      AS_OF_DATE
    );

    assert.equal(
      payload.settings.currency,
      "GBP"
    );

    assert.equal(
      payload.settings.timezone,
      "Europe/London"
    );
  }
);


test(
  "completed appointments become service sales",
  () => {
    const appointment =
      buildCompletedAppointment();

    const payment =
      buildPayment({
        appointment:
          objectId(
            "appointment-1"
          ),

        amount:
          75,
      });

    const payload =
      buildSalesForecastPayload({
        asOfDate:
          AS_OF_DATE,

        lookbackDays:
          90,

        appointments: [
          appointment,
        ],

        payments: [
          payment,
        ],
      });

    const observation =
      findObservation(
        payload,
        "2026-07-27"
      );

    assert.equal(
      observation.gross_sales,
      80
    );

    assert.equal(
      observation.discounts,
      5
    );

    assert.equal(
      observation.net_sales,
      75
    );

    assert.equal(
      observation.collected_sales,
      75
    );

    assert.equal(
      observation.service_sales,
      75
    );

    assert.equal(
      observation.completed_appointments,
      1
    );

    assert.equal(
      observation.transactions,
      1
    );

    assert.equal(
      observation
        .channels[0]
        .channel,
      "services"
    );
  }
);


test(
  "retail orders include discounts, units and cost of goods",
  () => {
    const order =
      buildOrder();

    const payment =
      buildPayment({
        order:
          objectId(
            "order-1"
          ),

        amount:
          45,
      });

    const payload =
      buildSalesForecastPayload({
        asOfDate:
          AS_OF_DATE,

        lookbackDays:
          90,

        orders: [
          order,
        ],

        payments: [
          payment,
        ],
      });

    const observation =
      findObservation(
        payload,
        "2026-07-27"
      );

    assert.equal(
      observation.gross_sales,
      50
    );

    assert.equal(
      observation.discounts,
      5
    );

    assert.equal(
      observation.net_sales,
      45
    );

    assert.equal(
      observation.collected_sales,
      45
    );

    assert.equal(
      observation.retail_sales,
      45
    );

    assert.equal(
      observation.cost_of_goods,
      19
    );

    assert.equal(
      observation.units_sold,
      3
    );

    assert.equal(
      observation.paid_orders,
      1
    );

    assert.equal(
      observation.transactions,
      1
    );

    assert.equal(
      observation
        .categories
        .length,
      2
    );
  }
);


test(
  "membership payments become membership sales",
  () => {
    const payment =
      buildPayment({
        purpose:
          "membership",

        amount:
          60,

        metadata: {
          planName:
            "Gold Membership",
        },
      });

    const payload =
      buildSalesForecastPayload({
        asOfDate:
          AS_OF_DATE,

        lookbackDays:
          90,

        payments: [
          payment,
        ],
      });

    const observation =
      findObservation(
        payload,
        "2026-07-27"
      );

    assert.equal(
      observation.membership_sales,
      60
    );

    assert.equal(
      observation.net_sales,
      60
    );

    assert.equal(
      observation.collected_sales,
      60
    );

    assert.equal(
      observation.transactions,
      1
    );

    assert.equal(
      observation
        .categories[0]
        .category_name,
      "Gold Membership"
    );
  }
);


test(
  "gift-card payments are detected through metadata",
  () => {
    const payment =
      buildPayment({
        purpose:
          "other",

        amount:
          40,

        metadata: {
          saleChannel:
            "gift_cards",

          categoryName:
            "Digital gift cards",
        },
      });

    const payload =
      buildSalesForecastPayload({
        asOfDate:
          AS_OF_DATE,

        lookbackDays:
          90,

        payments: [
          payment,
        ],
      });

    const observation =
      findObservation(
        payload,
        "2026-07-27"
      );

    assert.equal(
      observation.gift_card_sales,
      40
    );

    assert.equal(
      observation.other_sales,
      0
    );

    assert.equal(
      observation
        .categories[0]
        .category_name,
      "Digital gift cards"
    );
  }
);


test(
  "referenced appointment payments are not counted as separate other sales",
  () => {
    const appointment =
      buildCompletedAppointment();

    const payment =
      buildPayment({
        purpose:
          "appointment",

        appointment:
          objectId(
            "appointment-1"
          ),

        amount:
          75,
      });

    const payload =
      buildSalesForecastPayload({
        asOfDate:
          AS_OF_DATE,

        lookbackDays:
          90,

        appointments: [
          appointment,
        ],

        payments: [
          payment,
        ],
      });

    const observation =
      findObservation(
        payload,
        "2026-07-27"
      );

    assert.equal(
      observation.service_sales,
      75
    );

    assert.equal(
      observation.other_sales,
      0
    );

    assert.equal(
      observation.net_sales,
      75
    );
  }
);


test(
  "refunded appointment payments reduce net and collected sales",
  () => {
    const appointment =
      buildCompletedAppointment({
        totalPrice:
          80,

        discount:
          0,

        amountPaid:
          80,
      });

    const payment =
      buildPayment({
        appointment:
          objectId(
            "appointment-1"
          ),

        amount:
          80,

        status:
          "refunded",
      });

    const payload =
      buildSalesForecastPayload({
        asOfDate:
          AS_OF_DATE,

        lookbackDays:
          90,

        appointments: [
          appointment,
        ],

        payments: [
          payment,
        ],
      });

    const observation =
      findObservation(
        payload,
        "2026-07-27"
      );

    assert.equal(
      observation.gross_sales,
      80
    );

    assert.equal(
      observation.refunds,
      80
    );

    assert.equal(
      observation.net_sales,
      0
    );

    assert.equal(
      observation.collected_sales,
      0
    );
  }
);


test(
  "partially refunded payments use metadata refund amount",
  () => {
    const payment =
      buildPayment({
        purpose:
          "membership",

        amount:
          100,

        status:
          "partially_refunded",

        metadata: {
          refundedAmount:
            25,
        },
      });

    const payload =
      buildSalesForecastPayload({
        asOfDate:
          AS_OF_DATE,

        lookbackDays:
          90,

        payments: [
          payment,
        ],
      });

    const observation =
      findObservation(
        payload,
        "2026-07-27"
      );

    assert.equal(
      observation.gross_sales,
      100
    );

    assert.equal(
      observation.refunds,
      25
    );

    assert.equal(
      observation.net_sales,
      75
    );

    assert.equal(
      observation.collected_sales,
      75
    );
  }
);


test(
  "custom forecast settings are normalised",
  () => {
    const payload =
      buildSalesForecastPayload({
        asOfDate:
          AS_OF_DATE,

        lookbackDays:
          120,

        horizonDays:
          60,

        minimumHistoryDays:
          75,

        recentWindowDays:
          21,

        baselineWindowDays:
          100,

        confidenceLevel:
          0.95,

        weekdaySeasonalityWeight:
          0.7,

        recentTrendWeight:
          0.3,

        scenarioAdjustment:
          0.15,

        businessDays: [
          1,
          2,
          3,
          4,
          5,
        ],

        includeProfitForecast:
          false,

        includeCategoryForecast:
          false,
      });

    assert.equal(
      payload
        .observations
        .length,
      120
    );

    assert.equal(
      payload
        .settings
        .horizon_days,
      60
    );

    assert.equal(
      payload
        .settings
        .minimum_history_days,
      75
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
      100
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
        .weekday_seasonality_weight,
      0.7
    );

    assert.equal(
      payload
        .settings
        .recent_trend_weight,
      0.3
    );

    assert.equal(
      payload
        .settings
        .scenario_adjustment,
      0.15
    );

    assert.deepEqual(
      payload
        .settings
        .business_days,
      [
        1,
        2,
        3,
        4,
        5,
      ]
    );

    assert.equal(
      payload
        .settings
        .include_profit_forecast,
      false
    );

    assert.equal(
      payload
        .settings
        .include_category_forecast,
      false
    );
  }
);


test(
  "invalid as-of dates are rejected",
  () => {
    assert.throws(
      () =>
        buildSalesForecastPayload({
          asOfDate:
            "28-07-2026",

          lookbackDays:
            90,
        }),

      (error) => {
        assert.equal(
          error instanceof
            AiSalesForecastingError,
          true
        );

        assert.equal(
          error.code,
          "INVALID_SALES_FORECAST_DATE"
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


test(
  "future and out-of-window records are excluded",
  () => {
    const payload =
      buildSalesForecastPayload({
        asOfDate:
          AS_OF_DATE,

        lookbackDays:
          90,

        appointments: [
          buildCompletedAppointment({
            id:
              "future-appointment",

            completedAt:
              "2026-07-29T12:00:00.000Z",
          }),

          buildCompletedAppointment({
            id:
              "old-appointment",

            completedAt:
              "2025-01-01T12:00:00.000Z",
          }),
        ],
      });

    const totalNet =
      payload.observations.reduce(
        (
          sum,
          observation
        ) =>
          sum +
          observation.net_sales,
        0
      );

    assert.equal(
      totalNet,
      0
    );
  }
);


test(
  "payload contains aggregate sales data only",
  () => {
    const appointment =
      buildCompletedAppointment();

    appointment.customer = {
      firstName:
        "Private",

      lastName:
        "Customer",

      email:
        "private@example.com",
    };

    appointment.staff = {
      firstName:
        "Private",

      lastName:
        "Stylist",
    };

    appointment.notes =
      "Sensitive appointment note";

    const payload =
      buildSalesForecastPayload({
        asOfDate:
          AS_OF_DATE,

        lookbackDays:
          90,

        appointments: [
          appointment,
        ],
      });

    const serialised =
      JSON.stringify(
        payload
      );

    assert.equal(
      serialised.includes(
        "private@example.com"
      ),
      false
    );

    assert.equal(
      serialised.includes(
        "Private"
      ),
      false
    );

    assert.equal(
      serialised.includes(
        "Sensitive appointment note"
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        payload
          .observations[0],
        "customer"
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        payload
          .observations[0],
        "staff"
      ),
      false
    );
  }
);