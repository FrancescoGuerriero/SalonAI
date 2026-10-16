import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InstallationReadinessNotice } from "../components/platform/tenantInstallation/index.js";

describe("AIIBP installation readiness presentation", () => {
  it.each([
    ["ready", "Ready for review"],
    ["stale", "Dry-run result is stale"],
    ["unavailable", "Provisioning runtime unavailable"],
    ["partially-blocked", "Installation partially blocked"],
    ["blocked", "Installation blocked"],
  ])("renders explicit %s state", (state, title) => {
    render(<InstallationReadinessNotice state={state} referenceId="INST-2041" />);

    const heading = screen.getByRole("heading", { name: title });
    const section = heading.closest("section");

    expect(section).toHaveAttribute("data-installation-readiness", state);
    expect(screen.getByText("Reference: INST-2041")).toBeInTheDocument();
  });

  it("exposes recovery only when caller supplies authoritative action permission", () => {
    const refresh = vi.fn();
    const { rerender } = render(
      <InstallationReadinessNotice
        state="stale"
        actionLabel="Request fresh dry run"
        onRequestAction={refresh}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Request fresh dry run" })
    ).not.toBeInTheDocument();

    rerender(
      <InstallationReadinessNotice
        state="stale"
        actionLabel="Request fresh dry run"
        actionAllowed
        onRequestAction={refresh}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Request fresh dry run" })
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
