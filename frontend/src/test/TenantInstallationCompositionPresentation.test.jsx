import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  InstallationStepper,
  TenantIdentityLocaleSummary,
  VerticalPackSelector,
} from "../components/platform/tenantInstallation/index.js";

describe("AIIBP tenant installation composition presentation", () => {
  it("requests a registered vertical selection without creating tenant authority", () => {
    const requestSelect = vi.fn();

    render(
      <VerticalPackSelector
        selectedVerticalId="salon"
        verticals={[
          {
            id: "salon",
            label: "Salon AI",
            description: "Hair and beauty salon operations.",
            classification: "VERTICAL",
            version: "3.0",
          },
          {
            id: "spa",
            label: "Spa AI",
            description: "Spa and wellness operations.",
            classification: "VERTICAL",
            version: "3.0",
          },
          {
            id: "clinical",
            label: "Plastic Surgery AI",
            available: false,
          },
        ]}
        onRequestSelect={requestSelect}
      />
    );

    expect(
      screen.getByRole("radio", { name: /Salon AI/i })
    ).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("radio", { name: /Spa AI/i }));

    expect(requestSelect).toHaveBeenCalledTimes(1);
    expect(requestSelect.mock.calls[0][0].id).toBe("spa");
    expect(
      screen.getByRole("radio", { name: /Plastic Surgery AI/i })
    ).toBeDisabled();
    expect(
      screen.getByText(/does not create or activate a tenant/i)
    ).toBeInTheDocument();
  });

  it("renders keyboard-addressable installation progress from supplied steps", () => {
    const requestStep = vi.fn();

    render(
      <InstallationStepper
        currentStepId="identity"
        steps={[
          {
            id: "vertical",
            label: "Vertical",
            complete: true,
          },
          {
            id: "identity",
            label: "Identity & locale",
            meta: "Business and regional settings",
          },
          {
            id: "review",
            label: "Review",
            disabled: true,
          },
        ]}
        onRequestStep={requestStep}
      />
    );

    expect(
      screen.getByRole("button", { name: /Identity & locale/i })
    ).toHaveAttribute("aria-current", "step");

    fireEvent.click(screen.getByRole("button", { name: /Vertical/i }));

    expect(requestStep).toHaveBeenCalledTimes(1);
    expect(requestStep.mock.calls[0][0].id).toBe("vertical");
    expect(screen.getByRole("button", { name: /^Review$/i })).toBeDisabled();
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
    expect(screen.getByText("Timezone: Europe/London")).toBeInTheDocument();
    expect(screen.getByText("Currency: GBP")).toBeInTheDocument();
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
    expect(
      screen.getByText(/Authority remains server-side/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText("Owner membership is pending server validation.")
    ).toBeInTheDocument();
  });
});
