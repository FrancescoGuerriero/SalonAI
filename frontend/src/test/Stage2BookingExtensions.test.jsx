import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

function source(relativePath) {
  return fs.readFileSync(
    path.resolve(process.cwd(), relativePath),
    "utf8"
  );
}

describe("Stage 2 booking extensions", () => {
  it("keeps group bookings and service trials inside the existing appointment operations workflow", () => {
    const page = source("src/pages/AppointmentsOperationsPage.jsx");

    expect(page).toContain("GroupBookingPanel");
    expect(page).toContain("ServiceTrialPanel");
    expect(page).toContain("appointments={appointments}");
    expect(page).toContain("onChanged={loadPage}");
    expect(page).toContain('isFeatureEnabled("group-bookings")');
    expect(page).toContain('isFeatureEnabled("service-trials")');
    expect(page).toContain('specialWorkflow === "group"');
    expect(page).toContain('specialWorkflow === "trial"');
    expect(page).toContain('aria-label="Special booking workflows"');
    expect(page).toContain("aria-pressed");
    expect(page).not.toContain('path="/group-bookings"');
    expect(page).not.toContain('path="/service-trials"');
  });

  it("uses canonical appointment contracts for group booking operations", () => {
    const api = source("src/Services/groupBookingService.js");
    const panel = source("src/components/appointments/GroupBookingPanel.jsx");

    expect(api).toContain('"/future/group-bookings"');
    expect(panel).toContain("appointmentManagementApi.searchCustomers");
    expect(panel).toContain("groupBookingService.create");
    expect(panel).toContain("groupBookingService.rescheduleParticipant");
    expect(panel).toContain("groupBookingService.updateParticipantStatus");
    expect(panel).toContain("groupBookingService.updateGroupStatus");
    expect(panel).not.toContain("Appointment.create");
    expect(panel).not.toContain("createPayment");
  });

  it("keeps trial pricing and eligibility server-authoritative without rewriting Service", () => {
    const api = source("src/Services/serviceTrialService.js");
    const panel = source("src/components/appointments/ServiceTrialPanel.jsx");

    expect(api).toContain('"/future/service-trials"');
    expect(panel).toContain("serviceTrialService.createDefinition");
    expect(panel).toContain("serviceTrialService.updateDefinition");
    expect(panel).toContain("serviceTrialService.book");
    expect(panel).toContain("serviceTrialService.recordConversion");
    expect(panel).toContain("appointments = []");
    expect(panel).not.toContain("serviceService.update");
    expect(panel).not.toContain("Service.findByIdAndUpdate");
    expect(panel).not.toContain("createPayment");
  });

  it("keeps both workflows permission-aware using existing service and appointment vocabulary", () => {
    const group = source("src/components/appointments/GroupBookingPanel.jsx");
    const trials = source("src/components/appointments/ServiceTrialPanel.jsx");

    for (const permission of [
      "appointment:read",
      "appointment:create",
      "appointment:update",
    ]) {
      expect(group).toContain(permission);
      expect(trials).toContain(permission);
    }

    expect(group).toContain("appointment:cancel");
    expect(group).toContain("availableStatusOptions");
    expect(group).toContain('item === "cancelled" ? canCancel : canUpdate');
    expect(trials).toContain("service:update");
    expect(group).not.toMatch(/group-booking:[a-z]+/);
    expect(trials).not.toMatch(/trial:[a-z]+/);
  });

  it("keeps Stage 2 specialist UI aligned with the gold-neutral theme and 44px action targets", () => {
    const page = source("src/pages/AppointmentsOperationsPage.jsx");
    const group = source("src/components/appointments/GroupBookingPanel.jsx");
    const trials = source("src/components/appointments/ServiceTrialPanel.jsx");

    expect(page).toContain("Special booking workflows");
    expect(page).toContain("bg-amber-400");
    expect(page).not.toContain('specialWorkflow === "group"\n                      ? "min-h-11 rounded-xl bg-indigo');
    expect(page).not.toContain('specialWorkflow === "trial"\n                      ? "min-h-11 rounded-xl bg-violet');
    expect(group).not.toMatch(/(?:indigo|violet)-/);
    expect(trials).not.toMatch(/(?:indigo|violet)-/);
    expect(group).not.toContain("min-h-10");
    expect(trials).not.toContain("min-h-10");
    expect(group).toContain("min-h-11");
    expect(trials).toContain("min-h-11");
  });
});
