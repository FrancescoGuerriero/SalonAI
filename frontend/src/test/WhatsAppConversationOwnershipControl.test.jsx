import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WhatsAppConversationOwnershipControl from "../components/WhatsAppConversationOwnershipControl.jsx";

describe("WhatsApp conversation ownership control", () => {
  it("presents human ownership and requests bot resume only when caller allows it", () => {
    const resume = vi.fn();

    const { rerender } = render(
      <WhatsAppConversationOwnershipControl
        conversation={{
          automation: {
            mode: "human",
            handoffReason: "Customer requested a person.",
          },
        }}
        onRequestResumeBot={resume}
      />
    );

    expect(screen.getByText("Human handling")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Return to AI" })).not.toBeInTheDocument();

    rerender(
      <WhatsAppConversationOwnershipControl
        conversation={{
          automation: {
            mode: "human",
            handoffReason: "Customer requested a person.",
          },
        }}
        canResumeBot
        onRequestResumeBot={resume}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Return to AI" }));
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("keeps bot and handoff-requested states text explicit", () => {
    const { rerender } = render(
      <WhatsAppConversationOwnershipControl
        conversation={{ automation: { mode: "bot" } }}
      />
    );

    expect(screen.getByText("AI handling")).toBeInTheDocument();
    expect(screen.getByText("AI handling").closest("section")).toHaveAttribute(
      "data-conversation-owner",
      "bot"
    );

    rerender(
      <WhatsAppConversationOwnershipControl
        conversation={{
          automation: {
            mode: "bot",
            handoffRequested: true,
            handoffReason: "Booking needs staff review.",
          },
        }}
      />
    );

    expect(screen.getByText("Human handoff requested")).toBeInTheDocument();
    expect(screen.getByText("Booking needs staff review.")).toBeInTheDocument();
  });

  it("announces and disables the control while a resume request is pending", () => {
    render(
      <WhatsAppConversationOwnershipControl
        conversation={{ automation: { mode: "human" } }}
        canResumeBot
        resumePending
        onRequestResumeBot={() => {}}
      />
    );

    const section = screen.getByText("Human handling").closest("section");
    expect(section).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Returning to AI…" })).toBeDisabled();
    expect(
      screen.getByText("Returning this WhatsApp conversation to AI handling.")
    ).toHaveClass("sr-only");
  });
});
