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
import Customer from "../models/customer.js";
import CustomerNote from "../models/CustomerNote.js";
import CustomerContactLog from "../models/customerContactLog.js";
import Stylist from "../models/Stylist.js";
import StaffTimeOff from "../features/staff/StaffTimeOff.js";
import dashboardOperationsService from "../services/dashboardOperationsService.js";
import {
  getCustomerOperations,
} from "../services/customerOperationsService.js";

let server;
let baseUrl;

const originalMethods = {
  appointmentAggregate: Appointment.aggregate,
  appointmentFind: Appointment.find,
  customerFindById: Customer.findById,
  customerNoteAggregate: CustomerNote.aggregate,
  customerNoteFind: CustomerNote.find,
  contactCountDocuments: CustomerContactLog.countDocuments,
  contactFind: CustomerContactLog.find,
  stylistFind: Stylist.find,
  staffTimeOffFind: StaffTimeOff.find,
};

function queryResult(value) {
  const query = {
    populate() {
      return query;
    },
    select() {
      return query;
    },
    sort() {
      return query;
    },
    limit() {
      return query;
    },
    lean() {
      return Promise.resolve(value);
    },
  };

  return query;
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
    server.close((error) =>
      error ? reject(error) : resolve()
    );
  });
});

afterEach(() => {
  Appointment.aggregate = originalMethods.appointmentAggregate;
  Appointment.find = originalMethods.appointmentFind;
  Customer.findById = originalMethods.customerFindById;
  CustomerNote.aggregate = originalMethods.customerNoteAggregate;
  CustomerNote.find = originalMethods.customerNoteFind;
  CustomerContactLog.countDocuments =
    originalMethods.contactCountDocuments;
  CustomerContactLog.find = originalMethods.contactFind;
  Stylist.find = originalMethods.stylistFind;
  StaffTimeOff.find = originalMethods.staffTimeOffFind;
});

for (const pathname of [
  "/api/dashboard/operations",
  `/api/customer-profiles/${new mongoose.Types.ObjectId()}/operations`,
]) {
  test(`GET ${pathname} rejects unauthenticated requests`, async () => {
    const response = await fetch(`${baseUrl}${pathname}`);

    assert.equal(response.status, 401);

    const body = await response.json();

    assert.equal(body.success, false);
    assert.equal(body.code, "AUTHENTICATION_REQUIRED");
  });
}

test("dashboard operations calculates today's capacity, payments and next booking", async () => {
  const now = new Date();
  const startsAt = new Date(now.getTime() + 30 * 60_000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
  const dayName = now.toLocaleDateString("en-GB", {
    weekday: "long",
  });

  Appointment.find = () =>
    queryResult([
      {
        _id: new mongoose.Types.ObjectId(),
        appointmentDate: now,
        appointmentTime: startsAt.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        startsAt,
        endsAt,
        duration: 60,
        status: "pending",
        paymentStatus: "partially_paid",
        amountPaid: 20,
        balanceDue: 30,
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
    ]);

  Stylist.find = () =>
    queryResult([
      {
        _id: new mongoose.Types.ObjectId(),
        firstName: "Alex",
        lastName: "Stylist",
        isActive: true,
        workingHours: [
          {
            day: dayName,
            available: true,
            start: "09:00",
            end: "17:00",
          },
        ],
      },
    ]);

  StaffTimeOff.find = () => queryResult([]);

  const snapshot = await dashboardOperationsService.getSnapshot();

  assert.equal(snapshot.appointmentsToday, 1);
  assert.equal(snapshot.activeStylists, 1);
  assert.equal(snapshot.staffOnLeave, 0);
  assert.equal(snapshot.pendingApprovals, 1);
  assert.equal(snapshot.bookedMinutes, 60);
  assert.equal(snapshot.scheduledMinutes, 480);
  assert.equal(snapshot.utilisationPercent, 12.5);
  assert.equal(snapshot.revenueCollected, 20);
  assert.equal(snapshot.outstandingBalance, 30);
  assert.equal(snapshot.nextAppointments.length, 1);
  assert.equal(snapshot.nextAppointments[0].customer, "Francesco Customer");
  assert.equal(snapshot.nextAppointments[0].stylist, "Alex Stylist");
  assert.equal(snapshot.nextAppointments[0].service, "Cut and finish");
});

test("customer operations rejects an invalid customer ID before querying MongoDB", async () => {
  await assert.rejects(
    () => getCustomerOperations("not-an-object-id"),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_CUSTOMER_ID");
      return true;
    }
  );
});

test("customer operations returns a not-found error for an absent profile", async () => {
  Customer.findById = () => queryResult(null);

  await assert.rejects(
    () => getCustomerOperations(String(new mongoose.Types.ObjectId())),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "CUSTOMER_NOT_FOUND");
      return true;
    }
  );
});

test("customer operations aggregates appointments, balances, notes and contacts", async () => {
  const customerId = new mongoose.Types.ObjectId();
  const appointmentId = new mongoose.Types.ObjectId();
  const serviceId = new mongoose.Types.ObjectId();
  const stylistId = new mongoose.Types.ObjectId();
  const now = new Date();

  Customer.findById = () =>
    queryResult({
      _id: customerId,
      firstName: "Francesco",
      lastName: "Customer",
      preferredName: "Frank",
      email: "frank@example.com",
      phone: "07123456789",
      status: "active",
      totalSpent: 300,
      visitCount: 4,
      loyaltyPoints: 120,
      lastVisit: new Date(now.getTime() - 7 * 86_400_000),
      nextAppointment: new Date(now.getTime() + 7 * 86_400_000),
    });

  Appointment.aggregate = async () => [
    {
      totalAppointments: 4,
      completedAppointments: 3,
      cancelledAppointments: 0,
      noShowAppointments: 1,
      totalBookedValue: 350,
      totalPaid: 300,
      outstandingBalance: 50,
    },
  ];

  let appointmentFindCall = 0;
  Appointment.find = () => {
    appointmentFindCall += 1;

    const appointment = {
      _id: appointmentId,
      appointmentDate: now,
      appointmentTime: "14:00",
      startsAt: new Date(now.getTime() + 86_400_000),
      endsAt: new Date(now.getTime() + 90_000_000),
      duration: 60,
      status: "confirmed",
      paymentStatus: "partially_paid",
      totalPrice: 80,
      finalPrice: 75,
      amountPaid: 25,
      balanceDue: 50,
      service: {
        _id: serviceId,
        name: "Colour service",
        duration: 60,
        price: 80,
      },
      stylist: {
        _id: stylistId,
        firstName: "Alex",
        lastName: "Stylist",
      },
    };

    return queryResult(
      appointmentFindCall === 1 ? [appointment] : [appointment]
    );
  };

  CustomerNote.aggregate = async () => [
    {
      totalNotes: 2,
      pinnedNotes: 1,
      openFollowUps: 1,
      overdueFollowUps: 1,
    },
  ];

  CustomerNote.find = () =>
    queryResult([
      {
        _id: new mongoose.Types.ObjectId(),
        title: "Patch test follow-up",
        content: "Call before the next colour appointment.",
        type: "follow_up",
        visibility: "management",
        pinned: true,
        requiresFollowUp: true,
        followUpAt: new Date(now.getTime() - 86_400_000),
        followUpCompleted: false,
        createdAt: now,
      },
    ]);

  CustomerContactLog.countDocuments = async () => 3;
  CustomerContactLog.find = () =>
    queryResult([
      {
        _id: new mongoose.Types.ObjectId(),
        channel: "email",
        direction: "outbound",
        subject: "Appointment reminder",
        message: "Your appointment is tomorrow.",
        status: "sent",
        recipient: "frank@example.com",
        sentAt: now,
        createdAt: now,
      },
    ]);

  const result = await getCustomerOperations(String(customerId));

  assert.equal(result.customer.name, "Frank");
  assert.equal(result.customer.totalSpent, 300);
  assert.equal(result.appointments.total, 4);
  assert.equal(result.appointments.completed, 3);
  assert.equal(result.appointments.noShows, 1);
  assert.equal(result.appointments.completionRate, 75);
  assert.equal(result.appointments.totalBookedValue, 350);
  assert.equal(result.appointments.totalPaid, 300);
  assert.equal(result.appointments.outstandingBalance, 50);
  assert.equal(result.appointments.upcoming.length, 1);
  assert.equal(result.appointments.upcoming[0].service.name, "Colour service");
  assert.equal(result.appointments.upcoming[0].stylist.name, "Alex Stylist");
  assert.equal(result.notes.total, 2);
  assert.equal(result.notes.openFollowUps, 1);
  assert.equal(result.notes.overdueFollowUps, 1);
  assert.equal(result.communications.total, 3);
  assert.equal(result.communications.recent.length, 1);
});
