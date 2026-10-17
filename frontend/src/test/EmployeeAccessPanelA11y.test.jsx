import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("../Services/adminStaffService.js", () => ({
  default: {
    list: mocks.list,
    updateSettings: mocks.updateSettings,
  },
}));

vi.mock("../hooks/useAuth.js", () => ({
  default: () => ({
    user: {
      id: "super-admin-user",
      role: "super_admin",
      permissions: [],
      rolePermissions: [],
    },
  }),
}));

import EmployeeAccessPanel from "../components/employees/EmployeeAccessPanel.jsx";

const roles = [
  {
    id: "stylist",
    key: "stylist",
    name: "Stylist",
    active: true,
    assignable: true,
  },
  {
    id: "admin",
    key: "admin",
    name: "Administrator",
    active: true,
    assignable: true,
  },
];

const employee = {
  id: "user-1",
  signInEnabled: true,
  name: "Alice Stylist",
  email: "alice@example.com",
  role: "stylist",
  permissions: [],
  rolePermissions: [],
  stylistProfile: { id: "profile-1" },
};

function renderPanel() {
  return render(
    <MemoryRouter>
      <EmployeeAccessPanel roles={roles} />
    </MemoryRouter>
  );
}

describe("EmployeeAccessPanel accessibility hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({ users: [employee] });
    mocks.updateSettings.mockResolvedValue({
      message: "Employee settings updated.",
      user: employee,
    });
  });

  it("gives employee, role and permission controls explicit accessible groups", async () => {
    renderPanel();

    expect(
      await screen.findByRole("combobox", { name: "Employee" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Access role" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Employee-specific permissions" })
    ).toBeInTheDocument();
  });

  it("locks employee and role selection while an access mutation is pending", async () => {
    let resolveUpdate;
    mocks.updateSettings.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
    );

    const user = userEvent.setup();
    renderPanel();

    const employeeSelect = await screen.findByRole("combobox", {
      name: "Employee",
    });
    const roleSelect = screen.getByRole("combobox", { name: "Access role" });

    await user.click(screen.getByLabelText("View appointments"));
    await user.click(
      screen.getByRole("button", { name: "Save employee access" })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Employee access" })
      ).toHaveAttribute("aria-busy", "true");
    });
    expect(employeeSelect).toBeDisabled();
    expect(roleSelect).toBeDisabled();

    resolveUpdate({
      message: "Employee settings updated.",
      user: {
        ...employee,
        permissions: ["appointment:read"],
      },
    });

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Employee access" })
      ).toHaveAttribute("aria-busy", "false");
    });
  });
});
