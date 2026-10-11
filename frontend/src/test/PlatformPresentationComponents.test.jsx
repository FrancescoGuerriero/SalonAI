import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  AIProposalDecision,
  CapabilityStatus,
  ConfigurationChangePreviewDialog,
  ConnectorHealth,
  ConversationOwnershipStatus,
  ContextSwitchWarningDialog,
  EffectiveConfigurationRow,
  LocationContext,
  PlatformSurfaceState,
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





  it.each([
    ["bot", false, "AI handling", "bot"],
    ["bot", true, "Human handoff requested", "handoff-requested"],
    ["human", false, "Human handling", "human"],
  ])(
    "renders WhatsApp ownership mode %s with handoff %s",
    (mode, handoffRequested, title, ownerState) => {
      render(
        <ConversationOwnershipStatus
          mode={mode}
          handoffRequested={handoffRequested}
          handoffReason="Customer requested a person."
          assignedToLabel="Reception"
        />
      );

      expect(screen.getByText(title)).toBeInTheDocument();

      expect(
        screen.getByText(title).closest("section")
      ).toHaveAttribute("data-conversation-owner", ownerState);
    }
  );

  it("requests bot resume only when authoritative UI state permits it", () => {
    const resume = vi.fn();

    render(
      <ConversationOwnershipStatus
        mode="human"
        assignedToLabel="Reception"
        canResumeBot
        onRequestResumeBot={resume}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Return to AI",
      })
    );

    expect(resume).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["permission-denied", "You do not have access"],
    ["locked", "This setting is locked"],
    ["plan-unavailable", "Not included in this capability pack"],
    ["error", "This information could not be loaded"],
    ["empty", "Nothing here yet"],
  ])("renders explicit platform surface state %s", (state, title) => {
    render(
      <PlatformSurfaceState
        state={state}
      />
    );

    expect(screen.getByText(title)).toBeInTheDocument();

    expect(
      screen.getByText(title).closest("section")
    ).toHaveAttribute("data-platform-surface-state", state);
  });

  it("keeps retry as a request action rather than silently mutating state", () => {
    const retry = vi.fn();

    render(
      <PlatformSurfaceState
        state="error"
        actionLabel="Try again"
        onRequestAction={retry}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Try again",
      })
    );

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("previews an override without applying configuration in the frontend", () => {
    const cancel = vi.fn();
    const confirm = vi.fn();

    render(
      <ConfigurationChangePreviewDialog
        open
        mode="override"
        settingLabel="Deposit required"
        currentValue="20%"
        proposedValue="25%"
        currentSourceLabel="Business"
        proposedSourceLabel="Marylebone"
        onRequestCancel={cancel}
        onRequestConfirm={confirm}
      />
    );

    expect(
      screen.getByRole("dialog", {
        name: "Apply this configuration override?",
      })
    ).toBeInTheDocument();

    expect(screen.getByText("20%")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Request override",
      })
    );

    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("previews revert-to-inherited configuration before requesting it", () => {
    const confirm = vi.fn();

    render(
      <ConfigurationChangePreviewDialog
        open
        mode="revert"
        settingLabel="Deposit required"
        currentValue="25%"
        proposedValue="20%"
        currentSourceLabel="Marylebone"
        proposedSourceLabel="Business"
        onRequestCancel={() => {}}
        onRequestConfirm={confirm}
      />
    );

    expect(
      screen.getByRole("dialog", {
        name: "Revert to inherited configuration?",
      })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Revert to inherited",
      })
    );

    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("protects unsaved work before a requested context switch", () => {
    const stay = vi.fn();
    const discardAndSwitch = vi.fn();

    render(
      <ContextSwitchWarningDialog
        open
        currentContextLabel="Marylebone"
        nextContextLabel="Soho"
        unsavedWorkLabel="booking settings"
        onRequestStay={stay}
        onRequestDiscardAndSwitch={discardAndSwitch}
      />
    );

    expect(
      screen.getByRole("dialog", {
        name: "Switch location without saving?",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /You have unsaved changes in booking settings/
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Discard changes and switch",
      })
    );
    expect(discardAndSwitch).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Stay here",
      })
    );
    expect(stay).toHaveBeenCalledTimes(1);
  });

  it("treats Escape as staying on the current context", () => {
    const stay = vi.fn();

    render(
      <ContextSwitchWarningDialog
        open
        currentContextLabel="Marylebone"
        nextContextLabel="Soho"
        onRequestStay={stay}
        onRequestDiscardAndSwitch={() => {}}
      />
    );

    fireEvent.keyDown(document, {
      key: "Escape",
    });

    expect(stay).toHaveBeenCalledTimes(1);
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
