import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TenantInstallationWorkspaceShell } from "../components/platform/tenantInstallation/index.js";

describe("AIIBP tenant installation workspace shell", () => {
  it("presents server-supplied installation identity and review state", () => {
    render(
      <TenantInstallationWorkspaceShell
        platformRelease="v3.0.0"
        referenceId="INST-2041"
        mode="dry-run"
        status="blocked"
        verticalLabel="Salon AI"
        businessName="Francesco Picardi"
        blockerCount={2}
        warningCount={1}
      >
        <p>Server-generated review content</p>
      </TenantInstallationWorkspaceShell>
    );

    expect(
      screen.getByRole("heading", { name: "Tenant installation workspace" })
    ).toBeInTheDocument();
    expect(screen.getByText("v3.0.0")).toBeInTheDocument();
    expect(screen.getByText("INST-2041")).toBeInTheDocument();
    expect(screen.getByText("Salon AI")).toBeInTheDocument();
    expect(screen.getByText("Francesco Picardi")).toBeInTheDocument();
    expect(screen.getByText("Dry run")).toBeInTheDocument();
    expect(screen.getByText("blocked")).toBeInTheDocument();
    expect(screen.getByText("2 blockers")).toBeInTheDocument();
    expect(screen.getByText("1 warning")).toBeInTheDocument();
    expect(screen.getByText("Server-generated review content")).toBeInTheDocument();
    expect(
      screen.getByText(/does not create tenant authority or execute provisioning writes/i)
    ).toBeInTheDocument();
  });

  it("distinguishes write-request presentation without performing a write", () => {
    render(
      <TenantInstallationWorkspaceShell
        mode="write-request"
        status="review"
      />
    );

    expect(screen.getByText("Write request")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
