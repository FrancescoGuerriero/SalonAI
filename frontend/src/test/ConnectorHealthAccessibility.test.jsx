import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConnectorHealth } from "../components/platform/index.js";

describe("connector health accessibility", () => {
  it("announces connector state and impact summary without relying on colour", () => {
    render(
      <ConnectorHealth
        label="Microsoft Outlook"
        state="attention"
        summary="2 staff calendars need reconnect"
      />
    );

    const announcement = screen.getByText(
      "Microsoft Outlook: Attention needed. 2 staff calendars need reconnect"
    );

    expect(announcement).toHaveClass("sr-only");
    expect(announcement).toHaveAttribute("aria-live", "polite");
    expect(announcement).toHaveAttribute("aria-atomic", "true");
    expect(screen.getByText("Attention needed")).toBeInTheDocument();
  });

  it("marks reconnecting connector state as busy", () => {
    render(
      <ConnectorHealth
        label="Google Calendar"
        state="reconnecting"
        canReconnect
        onRequestReconnect={() => {}}
      />
    );

    const article = screen.getByText("Google Calendar").closest("article");
    expect(article).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Reconnecting…" })).toBeDisabled();
  });
});
