import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  InstallationBlockerList,
  InstallationPlanSummary,
  InstallationWriteConfirmationDialog,
  TenantInstallationReviewWorkspace,
} from "../components/platform/tenantInstallation/index.js";

describe("AIIBP tenant installation review presentation", () => {
  it("renders dry-run evidence without implying writes", () => {
    render(
      <InstallationPlanSummary
        plan={{
          mode: "dry-run",
          status: "blocked",
          created: [{ id: "business", label: "Business · Francesco Picardi" }, { id: "location", label: "Location · Marylebone" }],
          reused: [{ id: "vertical", label: "Vertical · Salon AI" }],
          skipped: [],
          blocked: [{ id: "clinical", label: "Clinical Records", reason: "Incompatible with the selected vertical." }],
          warnings: [{ id: "payments", label: "Payments", detail: "Not configured." }],
          activationReady: false,
          referenceId: "INST-TEST",
        }}
      />
    );

    expect(screen.getByText("Dry-run review")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Clinical Records")).toBeInTheDocument();
    expect(screen.getByText("Not activation-ready")).toBeInTheDocument();
    expect(screen.getByText("Reference: INST-TEST")).toBeInTheDocument();
  });

  it("shows explicit blocker recovery without solving authority in the frontend", () => {
    const action = vi.fn();
    render(
      <InstallationBlockerList
        blockers={[{ code: "DOMAIN_COLLISION", title: "Domain collision", detail: "The domain belongs to another Business.", actionLabel: "Review domain assignment" }]}
        onRequestAction={action}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Review domain assignment" }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByText("DOMAIN_COLLISION")).toBeInTheDocument();
  });

  it("keeps installation write confirmation hidden without authoritative write permission", () => {
    render(
      <InstallationWriteConfirmationDialog
        open
        businessLabel="Francesco Picardi"
        verticalLabel="Salon AI"
        deploymentLabel="Shared SaaS"
        pendingDomainCount={2}
        requestedCapabilityCount={7}
        onRequestCancel={() => {}}
        onRequestConfirm={() => {}}
      />
    );
    expect(screen.getByRole("dialog", { name: "Request tenant installation writes?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request installation writes" })).not.toBeInTheDocument();
  });

  it("treats Escape as cancelling the installation write request", () => {
    const cancel = vi.fn();
    render(
      <InstallationWriteConfirmationDialog
        open
        businessLabel="Francesco Picardi"
        verticalLabel="Salon AI"
        deploymentLabel="Shared SaaS"
        pendingDomainCount={2}
        requestedCapabilityCount={7}
        canRequestWrite
        onRequestCancel={cancel}
        onRequestConfirm={() => {}}
      />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("exposes the write request only when authoritative permission is supplied", () => {
    const confirm = vi.fn();
    render(
      <InstallationWriteConfirmationDialog
        open
        businessLabel="Francesco Picardi"
        verticalLabel="Salon AI"
        deploymentLabel="Shared SaaS"
        pendingDomainCount={2}
        requestedCapabilityCount={7}
        canRequestWrite
        onRequestCancel={() => {}}
        onRequestConfirm={confirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Request installation writes" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/does not activate DNS/)).toBeInTheDocument();
  });

  it("assembles server-supplied plan and recovery evidence into one workspace", () => {
    render(
      <TenantInstallationReviewWorkspace
        plan={{ mode: "dry-run", status: "review", created: [], reused: [], skipped: [], blocked: [], warnings: [], activationReady: true }}
      />
    );
    expect(screen.getByRole("heading", { name: "Tenant installation review" })).toBeInTheDocument();
    expect(screen.getByText("Activation-ready")).toBeInTheDocument();
    expect(screen.getByText("No installation blockers were supplied.")).toBeInTheDocument();
  });
});
