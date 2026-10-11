import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  BrandingTerminologyPreview,
  InstallationStepper,
  IntegrationPlanningList,
  LocationDomainLifecycle,
  TenantIdentityLocaleSummary,
  TenantInstallationCompositionWorkspace,
  VerticalPackSelector,
} from "../components/platform/tenantInstallation/index.js";

describe("AIIBP tenant installation composition presentation", () => {
  it("requests a registered vertical selection without creating tenant authority", () => {
    const requestSelect = vi.fn();
    render(
      <VerticalPackSelector
        selectedVerticalId="salon"
        verticals={[
          { id: "salon", label: "Salon AI", description: "Hair and beauty salon operations.", classification: "VERTICAL", version: "3.0" },
          { id: "spa", label: "Spa AI", description: "Spa and wellness operations.", classification: "VERTICAL", version: "3.0" },
          { id: "clinical", label: "Plastic Surgery AI", available: false },
        ]}
        onRequestSelect={requestSelect}
      />
    );

    expect(screen.getByRole("radio", { name: /Salon AI/i })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: /Spa AI/i }));
    expect(requestSelect).toHaveBeenCalledTimes(1);
    expect(requestSelect.mock.calls[0][0].id).toBe("spa");
    expect(screen.getByRole("radio", { name: /Plastic Surgery AI/i })).toBeDisabled();
  });

  it("renders stable accessible step names while retaining supplied metadata", () => {
    const requestStep = vi.fn();
    render(
      <InstallationStepper
        currentStepId="identity"
        steps={[
          { id: "vertical", label: "Vertical", complete: true },
          { id: "identity", label: "Identity & locale", meta: "Business and regional settings" },
          { id: "review", label: "Review", disabled: true },
        ]}
        onRequestStep={requestStep}
      />
    );

    expect(screen.getByRole("button", { name: "Identity & locale" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Business and regional settings")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Vertical" }));
    expect(requestStep.mock.calls[0][0].id).toBe("vertical");
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
  });

  it("presents tenant identity and locale evidence without claiming membership authority", () => {
    render(
      <TenantIdentityLocaleSummary
        tenant={{
          businessName: "Francesco Picardi",
          slug: "francesco-picardi",
          locale: "en-GB",
          timezone: "Europe/London",
          currency: "GBP",
          ownerEmail: "owner@example.com",
          status: "review",
          warning: "Owner membership is pending server validation.",
        }}
      />
    );

    expect(screen.getByText("Francesco Picardi")).toBeInTheDocument();
    expect(screen.getByText("Slug: francesco-picardi")).toBeInTheDocument();
    expect(screen.getByText(/Authority remains server-side/i)).toBeInTheDocument();
  });

  it("shows domain lifecycle and requests recovery without implying DNS mutation", () => {
    const requestAction = vi.fn();
    render(
      <LocationDomainLifecycle
        location={{ name: "Marylebone", city: "London", country: "United Kingdom" }}
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
    fireEvent.click(screen.getByRole("button", { name: "Review domain assignment" }));
    expect(requestAction).toHaveBeenCalledTimes(1);
  });

  it("renders branding and integration evidence without leaking credentials", () => {
    render(
      <>
        <BrandingTerminologyPreview
          branding={{ publicBusinessName: "Francesco Picardi", themeProfile: "Salon gold" }}
          terminology={[{ key: "customer", label: "Customer label", value: "Client", source: "tenant override" }]}
          publicModules={[{ key: "inventory", label: "Inventory", visible: false }]}
        />
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
      </>
    );

    expect(screen.getByText("Salon gold")).toBeInTheDocument();
    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.queryByText("must-not-render")).not.toBeInTheDocument();
  });

  it("assembles one consolidated composition workspace without browser provisioning authority", () => {
    render(
      <TenantInstallationCompositionWorkspace
        steps={[{ id: "vertical", label: "Vertical" }]}
        currentStepId="vertical"
        verticals={[{ id: "salon", label: "Salon AI" }]}
        selectedVerticalId="salon"
        tenant={{ businessName: "Francesco Picardi" }}
        location={{ name: "Marylebone" }}
        domains={[]}
        branding={{ publicBusinessName: "Francesco Picardi" }}
        terminology={[]}
        publicModules={[]}
        integrations={[]}
      />
    );

    expect(screen.getByRole("heading", { name: "Tenant installation composition" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vertical pack" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Identity and locale" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Primary location and domain lifecycle" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Branding and terminology preview" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Integration planning" })).toBeInTheDocument();
    expect(screen.getByText(/without creating tenant-specific code forks/)).toBeInTheDocument();
  });
});
