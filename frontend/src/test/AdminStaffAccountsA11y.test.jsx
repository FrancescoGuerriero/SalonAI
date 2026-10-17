import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  setStatus: vi.fn(),
  updateSettings: vi.fn(),
  updateStylist: vi.fn(),
  listRoles: vi.fn(),
}));

vi.mock("../Services/adminStaffService.js", () => ({
  default: {
    list: mocks.list,
    setStatus: mocks.setStatus,
    updateSettings: mocks.updateSettings,
  },
}));

vi.mock("../Services/stylistService.js", () => ({
  default: {
    updateStylist: mocks.updateStylist,
  },
}));

vi.mock("../Services/staffRoleService.js", () => ({
  default: {
    list: mocks.listRoles,
  },
}));

vi.mock("../hooks/useAuth.js", () => ({
  default: () => ({
    user: {
      id: "super-admin",
      role: "super_admin",
      permissions: [],
      rolePermissions: [],
    },
  }),
}));

vi.mock("../components/employees/AddEmployeeModal.jsx", () => ({
  default: () => null,
}));

import AdminStaffAccountsPage from "../pages/AdminStaffAccountsPage.jsx";

const employees = [
  {
    id: "employee-1",
    name: "Alice Stylist",
    email: "alice@example.com",
    phone: "+441111111111",
    role: "stylist",
    signInEnabled: true,
    isActive: true,
    stylistProfile: {
      id: "profile-1",
      profilePublished: true,
      acceptsAppointments: true,
      services: [],
      workingHours: [],
    },
  },
  {
    id: "employee-2",
    name: "Bob Reception",
    email: "",
    phone: "+442222222222",
    role: "receptionist",
    signInEnabled: false,
    isActive: true,
    stylistProfile: {
      id: "profile-2",
      profilePublished: false,
      acceptsAppointments: false,
      services: [],
      workingHours: [],
    },
  },
];

const roles = [
  { key: "stylist", name: "Stylist", active: true, assignable: true },
  { key: "receptionist", name: "Receptionist", active: true, assignable: true },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminStaffAccountsPage />
    </MemoryRouter>
  );
}

describe("AdminStaffAccountsPage accessibility hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({ users: employees });
    mocks.listRoles.mockResolvedValue(roles);
  });

  it("exposes labelled workforce filters and a polite result count", async () => {
    renderPage();

    expect(
      await screen.findByRole("searchbox", { name: "Search employees" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Staff role filter" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Sign-in access filter" })
    ).toBeInTheDocument();
    expect(screen.getByText("2 of 2 employees shown.")).toHaveAttribute(
      "aria-live",
      "polite"
    );
  });

  it("announces filtered results and keeps the management target at least 44px high", async () => {
    const user = userEvent.setup();
    renderPage();

    const search = await screen.findByRole("searchbox", {
      name: "Search employees",
    });
    await user.type(search, "Bob");

    expect(await screen.findByText("1 of 2 employees shown.")).toBeInTheDocument();
    expect(screen.queryByText("Alice Stylist")).not.toBeInTheDocument();
    expect(screen.getByText("Bob Reception")).toBeInTheDocument();

    const manageLink = screen.getByRole("link", { name: "Manage employee" });
    expect(manageLink.className).toContain("min-h-11");
  });
});
