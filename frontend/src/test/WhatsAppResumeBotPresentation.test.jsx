import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConversationOwnershipStatus } from "../components/platform/index.js";

describe("WhatsApp resume-bot presentation", () => {
  it("only exposes Return to AI for human-owned conversations when caller authorises the action", () => {
    const resume = vi.fn();
    const { rerender } = render(
      <ConversationOwnershipStatus
        mode="human"
        assignedToLabel="Reception"
        onRequestResumeBot={resume}
      />
    );

    expect(screen.queryByRole("button", { name: "Return to AI" })).not.toBeInTheDocument();

    rerender(
      <ConversationOwnershipStatus
        mode="human"
        assignedToLabel="Reception"
        canResumeBot
        onRequestResumeBot={resume}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Return to AI" }));
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("announces busy state and prevents duplicate resume requests", () => {
    render(
      <ConversationOwnershipStatus
        mode="human"
        canResumeBot
        resumePending
        onRequestResumeBot={() => {}}
      />
    );

    const section = screen.getByText("Human handling").closest("section");
    expect(section).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Returning to AI…" })).toBeDisabled();
  });
});
