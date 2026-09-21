import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";
import mongoose from "mongoose";

import StaffTimeOff, {
  STAFF_SCHEDULE_BLOCK_TYPES,
} from "../features/staff/StaffTimeOff.js";

test(
  "legacy staff time off remains a time_off schedule block by default",
  () => {
    const block =
      new StaffTimeOff({
        staff:
          new mongoose.Types.ObjectId(),
        startsAt:
          new Date(
            "2026-09-22T09:00:00.000Z"
          ),
        endsAt:
          new Date(
            "2026-09-22T10:00:00.000Z"
          ),
      });

    assert.equal(
      block.blockType,
      "time_off"
    );
    assert.equal(
      block.status,
      "requested"
    );
    assert.deepEqual(
      STAFF_SCHEDULE_BLOCK_TYPES,
      [
        "time_off",
        "meeting",
        "training",
        "personal",
        "other",
      ]
    );
  }
);

test(
  "calendar blocks use governed read and schedule-update permissions",
  async () => {
    const routes =
      await readFile(
        new URL(
          "../features/staff/staffRoutes.js",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      routes,
      /const readCalendar =[\s\S]*?"appointment:read"/
    );
    assert.match(
      routes,
      /const updateEmployeeSchedule =[\s\S]*?"employee:schedule:update"/
    );
    assert.match(
      routes,
      /"\/calendar-blocks"[\s\S]*?readCalendar[\s\S]*?controller\.listCalendarBlocks/
    );
    assert.match(
      routes,
      /"\/calendar-blocks\/:id\/cancel"[\s\S]*?updateEmployeeSchedule[\s\S]*?controller\.cancelCalendarBlock/
    );
    assert.match(
      routes,
      /"\/:staffId\/calendar-blocks"[\s\S]*?updateEmployeeSchedule[\s\S]*?controller\.createCalendarBlock/
    );
  }
);

test(
  "schedule blocks extend staff availability rather than creating appointments",
  async () => {
    const service =
      await readFile(
        new URL(
          "../features/staff/staffService.js",
          import.meta.url
        ),
        "utf8"
      );

    const start =
      service.indexOf(
        "export async function createScheduleBlock"
      );
    const end =
      service.indexOf(
        "export async function calendarScheduleBlocks",
        start
      );
    const handler =
      service.slice(
        start,
        end
      );

    assert.match(
      handler,
      /Appointment\.findOne\(/
    );
    assert.match(
      handler,
      /StaffTimeOff\.findOne\(/
    );
    assert.match(
      handler,
      /StaffTimeOff\.create\(/
    );
    assert.doesNotMatch(
      handler,
      /Appointment\.create\(/
    );
    assert.match(
      handler,
      /status:\s*"approved"/
    );
  }
);

test(
  "calendar block projection masks personal and leave details",
  async () => {
    const service =
      await readFile(
        new URL(
          "../features/staff/staffService.js",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      service,
      /\[\s*"time_off",[\s\S]*?"personal"[\s\S]*?\]\.includes[\s\S]*?return "Unavailable"/
    );

    const start =
      service.indexOf(
        "export async function calendarScheduleBlocks"
      );
    const end =
      service.indexOf(
        "export async function getTimeOff",
        start
      );
    const projection =
      service.slice(
        start,
        end
      );

    assert.match(
      projection,
      /title:[\s\S]*?scheduleBlockLabel/
    );
    assert.doesNotMatch(
      projection,
      /reason:/
    );
  }
);

test(
  "self-service leave remains requested time off",
  async () => {
    const service =
      await readFile(
        new URL(
          "../features/staff/staffService.js",
          import.meta.url
        ),
        "utf8"
      );

    const start =
      service.indexOf(
        "export async function requestTimeOff"
      );
    const end =
      service.indexOf(
        "export async function createScheduleBlock",
        start
      );
    const handler =
      service.slice(
        start,
        end
      );

    assert.match(
      handler,
      /blockType:[\s\S]*?"time_off"/
    );
    assert.match(
      handler,
      /status:\s*"requested"/
    );
  }
);
