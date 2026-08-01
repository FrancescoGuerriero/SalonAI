import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";

import {
  after,
  afterEach,
  before,
  test,
} from "node:test";

import app from "../app.js";
import Appointment from "../models/Appointment.js";
import DailyClose from "../models/DailyClose.js";
import Stylist from "../models/Stylist.js";
import Order from "../features/commerce/Order.js";

import {
  calculateDailyCloseSummary,
  closeDailyClose,
  reopenDailyClose,
} from "../services/dailyCloseService.js";

let server;
let baseUrl;

const originalMethods = {
  appointmentFind: Appointment.find,
  orderFind: Order.find,
  stylistCountDocuments: Stylist.countDocuments,
  dailyCloseFindOne: DailyClose.findOne,
  dailyCloseFindOneAndUpdate: DailyClose.findOneAndUpdate,
};

function queryResult(value) {
  const query = {
    populate() {
      return query;
    },
    sort() {
      return query;
    },
    lean() {
      return Promise.resolve(value);
    },
  };

  return query;
}

function dailyCloseDocument(value) {
  return {
    ...value,
    populate() {
      return this;
    },
    save() {
      return Promise.resolve(this);
    },
    toObject() {
      return { ...this };
    },
  };
}

before(async () => {
  server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

afterEach(() => {
  Appointment.find = originalMethods.appointmentFind;
  Order.find = originalMethods.orderFind;
  Stylist.countDocuments = originalMethods.stylistCountDocuments;
  DailyClose.findOne = originalMethods.dailyCloseFindOne;
  DailyClose.findOneAndUpdate = originalMethods.dailyCloseFindOneAndUpdate;
});

for (const request of [
  {
    method: "GET",
    pathname: "/api/daily-close?date=2026-07-27",
  },
  {
    method: "POST",
    pathname: "/api/daily-close/close",
  },
]) {
  test(`${request.method} ${request.pathname} rejects unauthenticated requests`, async () => {
    const response = await fetch(`${baseUrl}${request.pathname}`, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
      },
      body:
        request.method === "POST"
          ? JSON.stringify({ date: "2026-07-27" })
          : undefined,
    });

    assert.equal(response.status, 401);

    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.code, "AUTHENTICATION_REQUIRED");
  });
}

test("daily closing summary reconciles appointments, payments and product orders", async () => {
  const appointmentId = new mongoose.Types.ObjectId();

  Appointment.find = () =>
    queryResult([
      {
        _id: appointmentId,
        appointmentDate: new Date("2026-07-27T10:00:00"),
        appointmentTime: "10:00",
        startsAt: new Date("2026-07-27T10:00:00"),
        status: "completed",
        finalPrice: 50,
        totalPrice: 50,
        amountPaid: 50,
        balanceDue: 0,
        paymentMethod: "cash",
        paymentStatus: "paid",
        customer: {
          firstName: "Francesco",
          lastName: "Customer",
        },
        stylist: {
          firstName: "Alex",
          lastName: "Stylist",
        },
        service: {
          name: "Cut and finish",
        },
      },
      {
        _id: new mongoose.Types.ObjectId(),
        appointmentDate: new Date("2026-07-27T14:00:00"),
        appointmentTime: "14:00",
        startsAt: new Date("2026-07-27T14:00:00"),
        status: "confirmed",
        finalPrice: 80,
        amountPaid: 20,
        balanceDue: 60,
        paymentMethod: "card",
        paymentStatus: "partially_paid",
        customer: {
          firstName: "Morgan",
          lastName: "Customer",
        },
        stylist: {
          firstName: "Jamie",
          lastName: "Stylist",
        },
        service: {
          name: "Colour service",
        },
      },
    ]);

  Order.find = () =>
    queryResult([
      {
        status: "paid",
        total: 30,
        createdAt: new Date("2026-07-27T11:00:00"),
        paidAt: new Date("2026-07-27T11:01:00"),
      },
    ]);

  Stylist.countDocuments = async () => 2;

  const result = await calculateDailyCloseSummary("2026-07-27");

  assert.equal(result.appointments.total, 2);
  assert.equal(result.appointments.completed, 1);
  assert.equal(result.appointments.unresolved, 1);
  assert.equal(result.appointments.completedRevenue, 50);
  assert.equal(result.appointments.collected, 70);
  assert.equal(result.appointments.outstandingBalance, 60);
  assert.equal(result.expectedCash, 50);
  assert.equal(result.orders.revenue, 30);
  assert.equal(result.totalCollected, 100);
  assert.equal(result.activeStylists, 2);
  assert.equal(result.appointments.unresolvedItems[0].service, "Colour service");
});

test("daily close rejects an incomplete checklist", async () => {
  await assert.rejects(
    () =>
      closeDailyClose(
        "2026-07-27",
        {
          checklist: {
            appointmentsReviewed: true,
          },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          role: "manager",
        }
      ),
    (error) => {
      assert.equal(error.statusCode, 422);
      assert.equal(error.code, "DAILY_CLOSE_CHECKLIST_INCOMPLETE");
      return true;
    }
  );
});

test("daily close requires an override for unresolved appointments", async () => {
  Appointment.find = () =>
    queryResult([
      {
        _id: new mongoose.Types.ObjectId(),
        appointmentDate: new Date("2026-07-27T15:00:00"),
        appointmentTime: "15:00",
        status: "confirmed",
        finalPrice: 40,
        amountPaid: 0,
        balanceDue: 40,
        paymentMethod: "card",
        customer: {},
        stylist: {},
        service: { name: "Blow dry" },
      },
    ]);

  Order.find = () => queryResult([]);
  Stylist.countDocuments = async () => 1;
  DailyClose.findOne = async () => null;

  const checklist = {
    appointmentsReviewed: true,
    paymentsReconciled: true,
    cashCounted: true,
    ordersReviewed: true,
    followUpsReviewed: true,
    premisesSecured: true,
  };

  await assert.rejects(
    () =>
      closeDailyClose(
        "2026-07-27",
        { checklist },
        { _id: new mongoose.Types.ObjectId() }
      ),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "DAILY_CLOSE_UNRESOLVED_APPOINTMENTS");
      return true;
    }
  );
});

test("daily close stores the cash variance and immutable summary snapshot", async () => {
  Appointment.find = () =>
    queryResult([
      {
        _id: new mongoose.Types.ObjectId(),
        appointmentDate: new Date("2026-07-27T09:00:00"),
        appointmentTime: "09:00",
        status: "completed",
        finalPrice: 75,
        amountPaid: 75,
        balanceDue: 0,
        paymentMethod: "cash",
        customer: {},
        stylist: {},
        service: { name: "Haircut" },
      },
    ]);

  Order.find = () => queryResult([]);
  Stylist.countDocuments = async () => 1;
  DailyClose.findOne = async () => null;

  let updatePayload;

  DailyClose.findOneAndUpdate = (filter, update) => {
    updatePayload = { filter, update };

    return dailyCloseDocument({
      _id: new mongoose.Types.ObjectId(),
      dateKey: filter.dateKey,
      ...update.$set,
    });
  };

  const checklist = {
    appointmentsReviewed: true,
    paymentsReconciled: true,
    cashCounted: true,
    ordersReviewed: true,
    followUpsReviewed: true,
    premisesSecured: true,
  };

  const result = await closeDailyClose(
    "2026-07-27",
    {
      checklist,
      countedCash: 80,
      notes: "Closing completed.",
    },
    {
      _id: new mongoose.Types.ObjectId(),
      role: "manager",
    }
  );

  assert.equal(updatePayload.update.$set.status, "closed");
  assert.equal(updatePayload.update.$set.expectedCash, 75);
  assert.equal(updatePayload.update.$set.cashVariance, 5);
  assert.equal(result.close.status, "closed");
  assert.equal(result.summary.totalCollected, 75);
});

test("reopening a day requires an audit reason", async () => {
  await assert.rejects(
    () =>
      reopenDailyClose(
        "2026-07-27",
        { reason: "short" },
        { _id: new mongoose.Types.ObjectId() }
      ),
    (error) => {
      assert.equal(error.statusCode, 422);
      assert.equal(error.code, "DAILY_CLOSE_REOPEN_REASON_REQUIRED");
      return true;
    }
  );
});
