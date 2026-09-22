import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

const serviceSource =
  fs.readFileSync(
    path.resolve(
      process.cwd(),
      "src/Services/appointmentManagementApi.js"
    ),
    "utf8"
  );

describe(
  "walk-in front-desk API contract",
  () => {
    it(
      "uses the canonical appointment-management API namespace",
      () => {
        expect(
          serviceSource
        ).toContain(
          '`${BASE_URL}/walk-ins`'
        );
        expect(
          serviceSource
        ).toContain(
          "createWalkInAppointment"
        );
        expect(
          serviceSource
        ).toContain(
          "getWalkInQueue"
        );
      }
    );

    it(
      "continues to use the ordinary appointment status endpoint for lifecycle changes",
      () => {
        expect(
          serviceSource
        ).toContain(
          '`${BASE_URL}/${appointmentId}/status`'
        );
        expect(
          serviceSource
        ).not.toContain(
          "/walk-ins/status"
        );
      }
    );
  }
);
