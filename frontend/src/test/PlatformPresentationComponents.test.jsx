import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  AIProposalDecision,
  CapabilityStatus,
  ConnectorHealth,
  EffectiveConfigurationRow,
  LocationContext,
} from "../components/platform/index.js";

describe("Roadmap v3 platform presentation components", () => {
  it("renders trusted location context without deciding permitted locations", () => {
    const onRequestOpen = vi.fn();

    render(
      <LocationContext
        businessName="AI Business Platform"
        locationName="Marylebone"
        locationSubtitle="London"
        onRequestOpen={onRequestOpen}
      />
    );

    expect(screen.getByText("Marylebone")).toBeInTheDocument();

    const trigger = screen.getByRole("button", {
      name: "Change active location",
    });

    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(onRequestOpen).toHaveBeenCalledTimes(1);
  });

  it("fails closed visually when location context is unavailable", () => {
    render(
      <LocationContext
        businessName="AI Business Platform"
        state="error"
      />
    );

    expect(screen.getByText("Location unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("Choose a safe permitted location.")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Choose a permitted location",
      })
    ).toBeDisabled();
  });

  it.each([
    ["enabled", "Enabled"],
    ["off", "Available — off"],
    ["not-included", "Not included"],
    ["no-access", "No access"],
  ])("renders capability state %s distinctly", (state, visibleLabel) => {
    render(
      <CapabilityStatus
        label="Advanced analytics"
        state={state}
        reason="Authoritative state"
      />
    );

    expect(screen.getByText(visibleLabel)).toBeInTheDocument();

    expect(
      screen.getByText("Advanced analytics").closest("article")
    ).toHaveAttribute("data-capability-state", state);
  });

  it("exposes configuration actions only when authoritative state permits them", () => {
    const override = vi.fn();
    const revert = vi.fn();

    const { rerender } = render(
      <EffectiveConfigurationRow
        label="Deposit required"
        displayValue="25%"
        sourceLabel="Marylebone"
        canOverride
        canRevert
        onRequestOverride={override}
        onRequestRevert={revert}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Override here" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Revert to inherited" })
    );

    expect(override).toHaveBeenCalledTimes(1);
    expect(revert).toHaveBeenCalledTimes(1);

    rerender(
      <EffectiveConfigurationRow
        label="Deposit required"
        displayValue="25%"
        sourceLabel="Business"
        locked
        canOverride
        canRevert
        onRequestOverride={override}
        onRequestRevert={revert}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Override here" })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Revert to inherited" })
    ).not.toBeInTheDocument();
  });

  it("keeps AI decisions human-request driven", () => {
    const approve = vi.fn();
    const reject = vi.fn();

    render(
      <AIProposalDecision
        state="review"
        title="Open two additional colour appointments"
        reason="Forecast capacity shortfall"
        scopeLabel="Marylebone"
        expectedEffect="+2 appointment slots"
        uncertainty="Moderate"
        evidence={[
          {
            id: "demand",
            label: "Booking demand",
            period: "8 weeks",
          },
        ]}
        canApprove
        canReject
        onRequestApprove={approve}
        onRequestReject={reject}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Approve proposal" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(approve).toHaveBeenCalledTimes(1);
    expect(reject).toHaveBeenCalledTimes(1);

    expect(
      screen
        .getByText("Open two additional colour appointments")
        .closest("article")
    ).toHaveAttribute("data-proposal-state", "review");
  });

  it("presents connector impact and requests reconnect without inferring health", () => {
    const reconnect = vi.fn();
    const diagnostics = vi.fn();

    render(
      <ConnectorHealth
        label="Microsoft Outlook"
        state="attention"
        summary="2 staff calendars need reconnect"
        impact="Appointments still work."
        lastSuccessfulSyncAt="08:41"
        affectedCount={2}
        referenceId="CAL-2091"
        canReconnect
        canViewDiagnostics
        onRequestReconnect={reconnect}
        onRequestDiagnostics={diagnostics}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    fireEvent.click(
      screen.getByRole("button", { name: "View diagnostics" })
    );

    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(diagnostics).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Appointments still work.")).toBeInTheDocument();
  });

  it("uses the existing 44px minimum target and visible focus treatment", () => {
    render(
      <CapabilityStatus
        label="Advanced analytics"
        state="off"
        canChangeState
        onRequestEnable={() => {}}
      />
    );

    const button = screen.getByRole("button", { name: "Turn on" });

    expect(button.className).toContain("min-h-11");
    expect(button.className).toContain("focus-visible:ring-2");
  });
});
