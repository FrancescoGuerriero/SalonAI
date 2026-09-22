import {
  readFileSync,
} from "node:fs";
import {
  fileURLToPath,
} from "node:url";
import {
  describe,
  expect,
  it,
} from "vitest";

const servicePath =
  fileURLToPath(
    new URL(
      "../Services/appointmentManagementApi.js",
      import.meta.url
    )
  );

const serviceSource =
  readFileSync(
    servicePath,
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
