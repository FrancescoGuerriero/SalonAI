import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import ManagementNavigation from "../components/navigation/ManagementNavigation.jsx";
import {
  MANAGEMENT_LINKS,
  MANAGEMENT_PRESENTATION_MODES,
  MANAGEMENT_ROUTE_PATHS,
} from "../components/navigation/managementNavigationConfig.js";

const mockState = vi.hoisted(() => ({
  user: {
    role: "super_admin",
    permissions: [],
    rolePermissions: [],
  },
}));

vi.mock("../hooks/useAuth.js", () => ({
  default: () => ({ user: mockState.user }),
}));

vi.mock("../hooks/useFeatureControls.js", () => ({
  default: () => ({
    isFeatureEnabled: () => true,
  }),
}));

function renderNavigation() {
  return render(
    <MemoryRouter>
      <ManagementNavigation />
    </MemoryRouter>
  );
}

describe("Stage 1B management presentation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockState.user = {
      role: "super_admin",
      permissions: [],
      rolePermissions: [],
    };
  });

  it("preserves one unique canonical route registry", () => {
    expect(MANAGEMENT_LINKS).toHaveLength(69);
    expect(new Set(MANAGEMENT_ROUTE_PATHS).size).toBe(
      MANAGEMENT_ROUTE_PATHS.length
    );

    for (const link of MANAGEMENT_LINKS) {
      expect([
        MANAGEMENT_PRESENTATION_MODES.SIMPLE,
        MANAGEMENT_PRESENTATION_MODES.ADVANCED,
      ]).toContain(link.presentation);
    }
  });

  it("defaults to Simple and keeps routine work prominent", () => {
    renderNavigation();

    expect(
      screen.getByRole("button", { name: "Simple" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Appointments")).toBeInTheDocument();
    expect(screen.queryByText("Haircare AI")).not.toBeInTheDocument();
  });

  it("reveals authorised specialist tools in Advanced and remembers the preference", async () => {
    const user = userEvent.setup();
    renderNavigation();

    await user.click(
      screen.getByRole("button", { name: "Advanced" })
    );

    expect(screen.getByText("Haircare AI")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Advanced" })
    ).toHaveAttribute("aria-pressed", "true");

    await waitFor(() => {
      expect(
        window.localStorage.getItem(
          "salonai.managementNavigation.presentation.v1"
        )
      ).toBe(MANAGEMENT_PRESENTATION_MODES.ADVANCED);
    });
  });

  it("restores an explicitly selected Advanced preference", () => {
    window.localStorage.setItem(
      "salonai.managementNavigation.presentation.v1",
      MANAGEMENT_PRESENTATION_MODES.ADVANCED
    );

    renderNavigation();

    expect(screen.getByText("Haircare AI")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Advanced" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("lets Simple-mode search discover authorised Advanced tools", async () => {
    const user = userEvent.setup();
    renderNavigation();

    await user.type(
      screen.getByRole("searchbox", {
        name: "Search management tasks and tools",
      }),
      "Management copilot"
    );

    expect(screen.getByText("Management copilot")).toBeInTheDocument();
    expect(screen.getAllByText("Advanced").length).toBeGreaterThan(1);
  });

  it("never uses Advanced mode to bypass delegated permissions", async () => {
    mockState.user = {
      role: "receptionist",
      permissions: ["appointment:read"],
      rolePermissions: [],
    };

    const user = userEvent.setup();
    renderNavigation();

    await user.click(
      screen.getByRole("button", { name: "Advanced" })
    );

    const search = screen.getByRole("searchbox", {
      name: "Search management tasks and tools",
    });

    await user.type(search, "Booking demand");
    expect(screen.getByText("Booking demand")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "Haircare AI");
    expect(screen.queryByText("Haircare AI")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin overview")).not.toBeInTheDocument();
  });
});
