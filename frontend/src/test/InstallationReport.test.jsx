import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InstallationReport } from "../components/platform/tenantInstallation/index.js";

describe("AIIBP installation report presentation", () => {
  it("renders machine-readable provisioning evidence without exposing secrets or performing writes", () => {
    render(
      <InstallationReport
        report={{
          created: [{ id: "business", label: "Business", detail: "Francesco Picardi" }],
          reused: [{ id: "vertical", label: "Vertical", detail: "Salon AI" }],
          skipped: ["Optional demo data"],
          blocked: [{ id: "domain", label: "Primary domain", reason: "Domain collision" }],
          warnings: [{ id: "payments", label: "Payments", detail: "Provider not configured" }],
          unresolvedDependencies: [{ id: "calendar", label: "Calendar connector", detail: "Provider connection required" }],
          activationReady: false,
          referenceId: "INST-2041",
          secret: "must-not-render",
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "Installation report" })).toBeInTheDocument();
    expect(screen.getByText("Business")).toBeInTheDocument();
    expect(screen.getByText("Domain collision")).toBeInTheDocument();
    expect(screen.getByText("Calendar connector")).toBeInTheDocument();
    expect(screen.getByText("Reference: INST-2041")).toBeInTheDocument();
    expect(screen.queryByText("must-not-render")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Installation report" }).closest("section")).toHaveAttribute(
      "data-installation-report-readiness",
      "not-ready"
    );
  });

  it("provides a screen-reader readable composition summary", () => {
    render(
      <InstallationReport
        report={{
          created: ["Business", "Location"],
          reused: ["Vertical"],
          skipped: [],
          blocked: [],
          warnings: [],
          unresolvedDependencies: [],
          activationReady: true,
          auditReferenceId: "AUD-88",
        }}
      />
    );

    expect(
      screen.getByText(/Installation report: 3 reported items\. 2 created\. 1 reused\./i)
    ).toHaveClass("sr-only");
    expect(screen.getAllByText("Activation-ready").length).toBeGreaterThan(0);
    expect(screen.getByText("Reference: AUD-88")).toBeInTheDocument();
  });

  it("renders an explicit empty report state", () => {
    render(<InstallationReport report={{ activationReady: false }} />);

    expect(screen.getByText("No installation report items were supplied.")).toBeInTheDocument();
    expect(screen.getAllByText("Not activation-ready").length).toBeGreaterThan(0);
  });
});
