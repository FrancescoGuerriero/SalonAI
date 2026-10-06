import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import {
  BrandingTerminologyPreview,
  InstallationStepper,
  IntegrationPlanningList,
  LocationDomainLifecycle,
  TenantIdentityLocaleSummary,
  TenantInstallationCompositionWorkspace,
  VerticalPackSelection,
} from "../components/platform/tenantInstallationComposition/index.js";

describe("AIIBP tenant installation composition presentation", () => {
  it("announces the current installation step and only requests navigation", () => {
    const requestStep = vi.fn();

    render(
      <InstallationStepper
        currentStepId="identity"
        onRequestStep={requestStep}
        steps={[
          { id: "vertical", label: "Vertical", status: "complete" },
          { id: "identity", label: "Identity", status: "current" },
          { id: "domains", label: "Domains", status: "blocked" },
        ]}
      />
    );

    expect(screen.getByText("Identity").closest("button")).toHaveAttribute(
      "aria-current",
      "step"
    );

    fireEvent.click(screen.getByRole("button", { name: /Vertical/ }));
    expect(requestStep).toHaveBeenCalledWith("vertical");
    expect(screen.queryByRole("button", { name: /Domains/ })).not.toBeInTheDocument();
  });

  it("renders registry-supplied vertical packs and emits a selection request", () => {
    const requestVertical = vi.fn();

    render(
      <VerticalPackSelection
        selectedVerticalId="salon"
        onRequestSelect={requestVertical}
        verticals={[
          {
            id: "salon",
            displayName: "Salon AI",
            description: "Salon vertical pack",
            compatibilityLabel: "Compatible",
            defaultTerminology: ["Client", "Stylist"],
            defaultCapabilities: ["Booking", "CRM"],
          },
          {
            id: "fitness",
            displayName: "Fitness AI",
            compatibilityLabel: "Review required",
            selectable: true,
          },
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "Salon AI" })).toBeInTheDocument();
    expect(screen.getByText("Client · Stylist")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Request vertical selection" })
    );
    expect(requestVertical).toHaveBeenCalledWith("fitness");
  });

  it("keeps tenant identity validation explicitly server-authoritative", () => {
    render(
      <TenantIdentityLocaleSummary
        identity={{
          businessName: "Francesco Picardi",
          slug: "francesco-picardi",
          status: "draft",
          locale: "en-GB",
          timezone: "Europe/London",
          currency: "GBP",
          ownerEmail: "owner@example.test",
          validation: {
            slug: {
              label: "Pending authoritative check",
              detail: "Uniqueness has not been confirmed by the server.",
            },
            owner: {
              label: "Available",
              detail: "Existing account can be reviewed for binding.",
            },
          },
        }}
      />
    );

    expect(screen.getByText("francesco-picardi")).toBeInTheDocument();
    expect(screen.getByText("Europe/London")).toBeInTheDocument();
    expect(screen.getByText("Pending authoritative check")).toBeInTheDocument();
    expect(
      screen.getByText(/Uniqueness has not been confirmed by the server/)
    ).toBeInTheDocument();
  });

  it("shows domain lifecycle and requests recovery without implying DNS mutation", () => {
    const requestAction = vi.fn();

    render(
      <LocationDomainLifecycle
        location={{
          name: "Marylebone",
          city: "London",
          country: "United Kingdom",
        }}
        domains={[
          {
            id: "primary",
            kind: "Primary domain",
            hostname: "salon.example.test",
            state: "collision",
            detail: "The domain is already assigned to another Business.",
            actionLabel: "Review domain assignment",
          },
        ]}
        onRequestAction={requestAction}
      />
    );

    expect(screen.getByText("Blocked / collision")).toBeInTheDocument();
    expect(screen.getByText(/No DNS record is created/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Review domain assignment" })
    );
    expect(requestAction).toHaveBeenCalledTimes(1);
  });

  it("presents branding, terminology and module visibility as configuration", () => {
    render(
      <BrandingTerminologyPreview
        branding={{
          publicBusinessName: "Francesco Picardi",
          themeProfile: "Salon gold",
          contentPack: "Salon AI public",
        }}
        terminology={[
          {
            key: "customer",
            label: "Customer label",
            value: "Client",
            source: "tenant override",
          },
        ]}
        publicModules={[
          { key: "booking", label: "Booking", visible: true },
          { key: "inventory", label: "Inventory", visible: false },
        ]}
      />
    );

    expect(screen.getByText("Salon gold")).toBeInTheDocument();
    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByText("Hidden")).toBeInTheDocument();
  });

  it("keeps integration planning provider-neutral and never renders raw credentials", () => {
    render(
      <IntegrationPlanningList
        integrations={[
          {
            id: "messaging",
            label: "SMS / WhatsApp",
            providerLabel: "Provider supplied by contract",
            state: "planned",
            detail: "Credentials are configured outside this view.",
            secret: "must-not-render",
          },
        ]}
      />
    );

    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(
      screen.getByText(/Credentials are configured outside this view/)
    ).toBeInTheDocument();
    expect(screen.queryByText("must-not-render")).not.toBeInTheDocument();
  });

  it("assembles the installation composition surfaces without provisioning authority", () => {
    render(
      <TenantInstallationCompositionWorkspace
        steps={[{ id: "vertical", label: "Vertical", status: "current" }]}
        currentStepId="vertical"
        verticals={[{ id: "salon", displayName: "Salon AI" }]}
        selectedVerticalId="salon"
        identity={{ businessName: "Francesco Picardi" }}
        location={{ name: "Marylebone" }}
        domains={[]}
        branding={{ publicBusinessName: "Francesco Picardi" }}
        terminology={[]}
        publicModules={[]}
        integrations={[]}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Tenant installation composition" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Select a vertical pack" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Business identity and locale" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Primary location and domain lifecycle",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Branding and terminology preview" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Integration planning" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/without creating tenant-specific code forks/)
    ).toBeInTheDocument();
  });
});
