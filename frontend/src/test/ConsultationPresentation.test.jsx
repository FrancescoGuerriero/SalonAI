import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ConsultationProgress,
  ConsultationQuestionCard,
  ConsultationReviewWorkspace,
  ConsultationSurfaceState,
} from "../components/consultation/index.js";

describe("consultation presentation components", () => {
  it("expresses consultation progress structurally and marks the current step", () => {
    render(
      <ConsultationProgress
        steps={["Your goal", "Current colour", "Hair history", "Review"]}
        currentStep={3}
      />
    );

    expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
    expect(screen.getByText("Hair history").closest("li")).toHaveAttribute(
      "aria-current",
      "step"
    );
    expect(screen.getByText("Current colour").closest("li")).toHaveAttribute(
      "data-consultation-step-state",
      "complete"
    );
    expect(screen.getByText("Review").closest("li")).toHaveAttribute(
      "data-consultation-step-state",
      "upcoming"
    );
  });

  it("presents errors as alerts and keeps retry request-driven", () => {
    const retry = vi.fn();

    render(
      <ConsultationSurfaceState
        state="error"
        actionLabel="Retry"
        onRequestAction={retry}
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-consultation-state", "error");
    expect(
      screen.getByText("Your latest change was not saved")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("announces loading without replacing state with an unexplained spinner", () => {
    render(<ConsultationSurfaceState state="loading" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading consultation")).toBeInTheDocument();
    expect(
      screen.getByText("Retrieving the latest consultation state.")
    ).toBeInTheDocument();
  });

  it("renders a semantic customer question and requests selection without owning state", () => {
    const select = vi.fn();
    const continueAction = vi.fn();
    const handoff = vi.fn();

    render(
      <ConsultationQuestionCard
        question="Have you used bleach or permanent colour in the last 12 months?"
        description="Choose the closest answer."
        options={[
          { value: "none", label: "No bleach or permanent colour" },
          { value: "bleach", label: "Bleach / lightener" },
        ]}
        selectedValue="bleach"
        hintTitle="Why we ask"
        hint="Chemical history can affect the safest next step."
        onRequestSelect={select}
        onRequestContinue={continueAction}
        onRequestHandoff={handoff}
      />
    );

    expect(
      screen.getByRole("group", {
        name: "Have you used bleach or permanent colour in the last 12 months?",
      })
    ).toBeInTheDocument();

    expect(screen.getByRole("radio", { name: "Bleach / lightener" })).toBeChecked();

    fireEvent.click(
      screen.getByRole("radio", { name: "No bleach or permanent colour" })
    );
    expect(select).toHaveBeenCalledWith("none");

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Talk to a stylist" }));
    expect(continueAction).toHaveBeenCalledTimes(1);
    expect(handoff).toHaveBeenCalledTimes(1);
  });

  it("keeps the AI recommendation advisory and renders supplied authoritative actions only", () => {
    const approve = vi.fn();

    render(
      <ConsultationReviewWorkspace
        customerLabel="Maya R."
        channelLabel="WhatsApp"
        summaryItems={[{ id: "completion", label: "Completion", value: "83%" }]}
        answers={[{ id: "history", label: "Bleach/lightener", value: "Yes — within 8 months" }]}
        recommendation={{
          title: "Recommend an in-person colour consultation before booking",
          rationale: "Recent lightener history and unresolved patch-test status.",
          confidenceLabel: "62% confidence",
        }}
        flags={["Recent bleach history", "Patch-test status unknown"]}
        actions={[
          {
            id: "approve",
            label: "Approve recommendation",
            variant: "primary",
            onRequest: approve,
          },
          {
            id: "hidden",
            label: "Server did not authorise this action",
          },
        ]}
      />
    );

    expect(screen.getByText("62% confidence")).toBeInTheDocument();
    expect(
      screen.getByText(/Advisory only\. Deterministic safety and business rules/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Server did not authorise this action",
      })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Approve recommendation" })
    );
    expect(approve).toHaveBeenCalledTimes(1);
  });

  it("disables concurrent staff actions while an authoritative action is pending", () => {
    render(
      <ConsultationReviewWorkspace
        busyAction="approve"
        actions={[
          { id: "approve", label: "Approve recommendation", onRequest: () => {} },
          { id: "assign", label: "Assign", onRequest: () => {} },
        ]}
      />
    );

    expect(
      screen.getByRole("button", { name: "Approve recommendation" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Consultation action in progress"
    );
  });
});
