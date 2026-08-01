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
import Stylist from "../models/Stylist.js";
import StaffTimeOff from "../features/staff/StaffTimeOff.js";
import StaffAttendance from "../features/staffRota/StaffAttendance.js";
import StaffShift from "../features/staffRota/StaffShift.js";

import {
  calculateRotaMetrics,
  clockInStaffShift,
  createStaffShift,
  shiftScheduledMinutes,
} from "../features/staffRota/staffRotaService.js";

let server;
let baseUrl;

const originalMethods = {
  stylistFindById: Stylist.findById,
  shiftFindById: StaffShift.findById,
  shiftFindOne: StaffShift.findOne,
  shiftCreate: StaffShift.create,
  timeOffFindOne: StaffTimeOff.findOne,
  attendanceFindOne: StaffAttendance.findOne,
  attendanceFindOneAndUpdate: StaffAttendance.findOneAndUpdate,
  attendanceCreate: StaffAttendance.create,
};

function leanQuery(value) {
  return {
    lean() {
      return Promise.resolve(value);
    },
  };
}

function attendanceDocument(value) {
  return {
    ...value,
    save() {
      return Promise.resolve(this);
    },
    populate() {
      return Promise.resolve(this);
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
  Stylist.findById = originalMethods.stylistFindById;
  StaffShift.findById = originalMethods.shiftFindById;
  StaffShift.findOne = originalMethods.shiftFindOne;
  StaffShift.create = originalMethods.shiftCreate;
  StaffTimeOff.findOne = originalMethods.timeOffFindOne;
  StaffAttendance.findOne = originalMethods.attendanceFindOne;
  StaffAttendance.findOneAndUpdate = originalMethods.attendanceFindOneAndUpdate;
  StaffAttendance.create = originalMethods.attendanceCreate;
});

for (const request of [
  {
    method: "GET",
    pathname: "/api/future/staff-rota/week?startDate=2026-07-27",
  },
  {
    method: "POST",
    pathname: "/api/future/staff-rota/shifts",
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
          request.method === "POST"
            ? JSON.stringify({})
            : undefined,
      });

      assert.equal(response.status, 401);

      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.code, "AUTHENTICATION_REQUIRED");
    }
  );
}

test("staff shift validation rejects an invalid time range and break", async () => {
  const shift = new StaffShift({
    staff: new mongoose.Types.ObjectId(),
    startsAt: new Date("2026-07-27T17:00:00"),
    endsAt: new Date("2026-07-27T09:00:00"),
    breakMinutes: 600,
  });

  await assert.rejects(
    () => shift.validate(),
    (error) => {
      assert.ok(error.errors.endsAt);
      return true;
    }
  );
});

test("scheduled minutes exclude the unpaid break", () => {
  const result = shiftScheduledMinutes({
    startsAt: new Date("2026-07-27T09:00:00"),
    endsAt: new Date("2026-07-27T17:00:00"),
    breakMinutes: 30,
  });

  assert.equal(result, 450);
});

test("rota metrics identify overtime, absences and appointments outside shifts", () => {
  const staffId = new mongoose.Types.ObjectId();
  const shiftId = new mongoose.Types.ObjectId();
  const appointmentId = new mongoose.Types.ObjectId();
  const weekStart = new Date("2026-07-27T00:00:00");

  const result = calculateRotaMetrics({
    weekStart,
    overtimeThresholdMinutes: 40 * 60,
    minimumStaff: 1,
    staff: [
      {
        _id: staffId,
        firstName: "Alex",
        lastName: "Stylist",
      },
    ],
    shifts: [
      {
        _id: shiftId,
        staff: {
          _id: staffId,
          firstName: "Alex",
          lastName: "Stylist",
        },
        startsAt: new Date("2026-07-27T09:00:00"),
        endsAt: new Date("2026-08-01T02:00:00"),
        breakMinutes: 0,
        status: "published",
      },
    ],
    attendance: [
      {
        shift: shiftId,
        staff: staffId,
        status: "absent",
      },
    ],
    appointments: [
      {
        _id: appointmentId,
        stylist: {
          _id: staffId,
          firstName: "Alex",
          lastName: "Stylist",
        },
        customer: {
          firstName: "Jamie",
          lastName: "Customer",
        },
        startsAt: new Date("2026-08-02T10:00:00"),
        endsAt: new Date("2026-08-02T11:00:00"),
        status: "confirmed",
      },
    ],
    timeOff: [],
  });

  assert.equal(result.summary.absences, 1);
  assert.ok(result.summary.overtimeMinutes > 0);
  assert.ok(result.alerts.some((alert) => alert.type === "overtime"));
  assert.ok(
    result.alerts.some(
      (alert) => alert.type === "appointment_outside_shift"
    )
  );
});

test("creating a shift rejects an overlapping shift", async () => {
  const staffId = new mongoose.Types.ObjectId();

  Stylist.findById = async () => ({
    _id: staffId,
    isActive: true,
  });

  StaffShift.findOne = () =>
    leanQuery({
      _id: new mongoose.Types.ObjectId(),
      startsAt: new Date("2026-07-27T09:00:00"),
      endsAt: new Date("2026-07-27T17:00:00"),
    });

  StaffTimeOff.findOne = () => leanQuery(null);

  await assert.rejects(
    () =>
      createStaffShift(
        {
          staffId,
          startsAt: "2026-07-27T10:00:00",
          endsAt: "2026-07-27T18:00:00",
        },
        {
          _id: new mongoose.Types.ObjectId(),
          role: "manager",
        }
      ),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.details.conflictType, "shift_overlap");
      return true;
    }
  );
});

test("creating a shift rejects approved time off", async () => {
  const staffId = new mongoose.Types.ObjectId();

  Stylist.findById = async () => ({
    _id: staffId,
    isActive: true,
  });

  StaffShift.findOne = () => leanQuery(null);
  StaffTimeOff.findOne = () =>
    leanQuery({
      _id: new mongoose.Types.ObjectId(),
      status: "approved",
    });

  await assert.rejects(
    () =>
      createStaffShift(
        {
          staffId,
          startsAt: "2026-07-27T09:00:00",
          endsAt: "2026-07-27T17:00:00",
        },
        {
          _id: new mongoose.Types.ObjectId(),
          role: "manager",
        }
      ),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.details.conflictType, "approved_time_off");
      return true;
    }
  );
});

test("late clock-in records the attendance status", async () => {
  const shiftId = new mongoose.Types.ObjectId();
  const staffId = new mongoose.Types.ObjectId();
  const attendance = attendanceDocument({
    _id: new mongoose.Types.ObjectId(),
    shift: shiftId,
    staff: staffId,
    clockInAt: null,
    clockOutAt: null,
    status: "scheduled",
    notes: "",
  });

  StaffShift.findById = async () => ({
    _id: shiftId,
    staff: staffId,
    startsAt: new Date("2026-07-27T09:00:00"),
    endsAt: new Date("2026-07-27T17:00:00"),
    status: "published",
  });

  StaffAttendance.findOne = async () => attendance;

  const result = await clockInStaffShift(
    shiftId,
    {
      at: "2026-07-27T09:20:00",
      graceMinutes: 10,
    },
    {
      _id: new mongoose.Types.ObjectId(),
      role: "manager",
    }
  );

  assert.equal(result.status, "late");
  assert.equal(
    new Date(result.clockInAt).toISOString(),
    new Date("2026-07-27T09:20:00").toISOString()
  );
});
