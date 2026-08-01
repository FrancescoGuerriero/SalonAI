import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";

import { after, before, test } from "node:test";

import app from "../app.js";
import {
  buildStaffPerformanceReport,
  calculateBracketRate,
  calculateCommission,
  sanitisePlanInput,
} from "../features/staffPerformance/staffPerformanceService.js";

let server;
let baseUrl;

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

for (const request of [
  {
    method: "GET",
    pathname: "/api/future/staff-performance?months=1",
  },
  {
    method: "PUT",
    pathname: `/api/future/staff-performance/stylists/${new mongoose.Types.ObjectId()}/plan`,
  },
  {
    method: "PATCH",
    pathname: `/api/future/staff-performance/retail-orders/${new mongoose.Types.ObjectId()}/assignment`,
  },
]) {
  test(
    `${request.method} ${request.pathname} rejects unauthenticated requests`,
    async () => {
      const response = await fetch(`${baseUrl}${request.pathname}`, {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
        },
        body:
          request.method === "GET"
            ? undefined
            : JSON.stringify({
                stylistId: new mongoose.Types.ObjectId().toString(),
              }),
      });

      assert.equal(response.status, 401);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.code, "AUTHENTICATION_REQUIRED");
    }
  );
}

test("commission tiers use the highest reached revenue threshold", () => {
  const rule = {
    enabled: true,
    ratePercent: 20,
    tiers: [
      { threshold: 1000, ratePercent: 25 },
      { threshold: 2000, ratePercent: 30 },
    ],
  };

  assert.equal(calculateBracketRate(500, rule), 20);
  assert.equal(calculateBracketRate(1500, rule), 25);
  assert.equal(calculateBracketRate(2500, rule), 30);
  assert.deepEqual(calculateCommission(2500, rule), {
    ratePercent: 30,
    amount: 750,
  });
});

test("plan input clamps unsafe commission and target values", () => {
  const result = sanitisePlanInput({
    serviceCommission: {
      enabled: true,
      basis: "collected",
      ratePercent: 140,
      tiers: [{ threshold: -5, ratePercent: 150 }],
    },
    retailCommission: {
      enabled: true,
      basis: "unsupported",
      ratePercent: -10,
    },
    monthlyTargets: {
      serviceRevenue: -500,
      retailRevenue: 1000,
      completedAppointments: -2,
      rebookingRate: 120,
      productivityRate: 500,
    },
  });

  assert.equal(result.serviceCommission.ratePercent, 100);
  assert.equal(result.serviceCommission.tiers[0].threshold, 0);
  assert.equal(result.serviceCommission.tiers[0].ratePercent, 100);
  assert.equal(result.retailCommission.basis, "subtotal");
  assert.equal(result.retailCommission.ratePercent, 0);
  assert.equal(result.monthlyTargets.serviceRevenue, 0);
  assert.equal(result.monthlyTargets.retailRevenue, 1000);
  assert.equal(result.monthlyTargets.completedAppointments, 0);
  assert.equal(result.monthlyTargets.rebookingRate, 100);
  assert.equal(result.monthlyTargets.productivityRate, 300);
});

test("staff report combines service, retail, rota, rebooking and commission", () => {
  const stylistId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const firstAppointmentId = new mongoose.Types.ObjectId();
  const secondAppointmentId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const startDate = new Date("2026-07-01T00:00:00.000Z");
  const endDate = new Date("2026-08-01T00:00:00.000Z");

  const stylist = {
    _id: stylistId,
    firstName: "Alex",
    lastName: "Stylist",
    email: "alex@example.com",
  };

  const result = buildStaffPerformanceReport({
    stylists: [stylist],
    plans: [
      {
        stylist: stylistId,
        serviceCommission: {
          enabled: true,
          basis: "earned",
          ratePercent: 40,
          tiers: [],
        },
        retailCommission: {
          enabled: true,
          basis: "subtotal",
          ratePercent: 10,
          tiers: [],
        },
        monthlyTargets: {
          serviceRevenue: 100,
          retailRevenue: 50,
          completedAppointments: 1,
          rebookingRate: 50,
          productivityRate: 20,
        },
      },
    ],
    appointments: [
      {
        _id: firstAppointmentId,
        stylist,
        customer: { _id: customerId },
        startsAt: new Date("2026-07-05T10:00:00.000Z"),
        status: "completed",
        duration: 60,
        finalPrice: 100,
        amountPaid: 100,
        paymentStatus: "paid",
      },
      {
        _id: secondAppointmentId,
        stylist,
        customer: { _id: customerId },
        startsAt: new Date("2026-07-20T10:00:00.000Z"),
        status: "confirmed",
        duration: 60,
        finalPrice: 100,
        amountPaid: 0,
        paymentStatus: "pending",
      },
    ],
    shifts: [
      {
        staff: stylist,
        startsAt: new Date("2026-07-05T09:00:00.000Z"),
        endsAt: new Date("2026-07-05T17:00:00.000Z"),
        breakMinutes: 30,
        status: "published",
      },
    ],
    orders: [
      {
        _id: orderId,
        orderNumber: "SA-TEST",
        status: "paid",
        subtotal: 50,
        discountTotal: 0,
        total: 50,
        paidAt: new Date("2026-07-06T12:00:00.000Z"),
        contact: { name: "Customer" },
        items: [{ quantity: 1 }],
      },
    ],
    attributions: [
      {
        order: orderId,
        stylist,
      },
    ],
    startDate,
    endDate,
    months: 1,
  });

  const member = result.staff[0];

  assert.equal(member.serviceRevenue, 100);
  assert.equal(member.retailRevenue, 50);
  assert.equal(member.totalRevenue, 150);
  assert.equal(member.commission.service, 40);
  assert.equal(member.commission.retail, 5);
  assert.equal(member.commission.total, 45);
  assert.equal(member.successfulRebookings, 1);
  assert.equal(member.rebookingRate, 100);
  assert.equal(member.scheduledHours, 7.5);
  assert.equal(member.productiveHours, 1);
  assert.equal(member.productivityRate, 13.3);
  assert.equal(result.summary.totalCommission, 45);
  assert.equal(result.retailOrders.unassignedCount, 0);
});

test("unassigned paid orders remain visible for manager attribution", () => {
  const stylistId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const startDate = new Date("2026-07-01T00:00:00.000Z");
  const endDate = new Date("2026-08-01T00:00:00.000Z");

  const result = buildStaffPerformanceReport({
    stylists: [
      {
        _id: stylistId,
        firstName: "Jamie",
        lastName: "Stylist",
      },
    ],
    plans: [],
    appointments: [],
    shifts: [],
    orders: [
      {
        _id: orderId,
        orderNumber: "SA-UNASSIGNED",
        status: "paid",
        subtotal: 35,
        discountTotal: 5,
        total: 30,
        paidAt: new Date("2026-07-10T12:00:00.000Z"),
        contact: { name: "Retail Customer" },
        items: [{ quantity: 2 }],
      },
    ],
    attributions: [],
    startDate,
    endDate,
    months: 1,
  });

  assert.equal(result.retailOrders.unassignedCount, 1);
  assert.equal(result.retailOrders.unassigned[0].retailRevenue, 30);
  assert.equal(result.retailOrders.unassigned[0].itemCount, 2);
});
