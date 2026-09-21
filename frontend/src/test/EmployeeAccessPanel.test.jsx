import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  MemoryRouter,
} from "react-router-dom";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import adminStaffService from "../Services/adminStaffService.js";
import EmployeeAccessPanel from "../components/employees/EmployeeAccessPanel.jsx";

vi.mock(
  "../Services/adminStaffService.js",
  () => ({
    default: {
      list: vi.fn(),
      updateSettings:
        vi.fn(),
    },
  })
);

vi.mock(
  "../hooks/useAuth.js",
  () => ({
    default: () => ({
      user: {
        id:
          "admin-user",
        role:
          "admin",
        permissions: [],
        rolePermissions: [],
      },
    }),
  })
);

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
  {
    id: "super_admin",
    key: "super_admin",
    name: "Super Admin",
    active: true,
    assignable: false,
  },
];

const employees = [
  {
    id: "user-1",
    accountLinked: true,
    name: "Alice Stylist",
    email:
      "alice@example.com",
    role: "stylist",
    permissions: [],
    rolePermissions: [],
    stylistProfile: {
      id: "profile-1",
    },
  },
  {
    id:
      "profile:profile-2",
    profileId:
      "profile-2",
    accountLinked: false,
    name: "Amara Okafor",
    email:
      "amara.okafor@salonai.invalid",
    role:
      "profile_only",
    permissions: [],
    rolePermissions: [],
    stylistProfile: {
      id: "profile-2",
    },
  },
];

describe(
  "EmployeeAccessPanel",
  () => {
    beforeEach(() => {
      adminStaffService.list.mockResolvedValue({
        users:
          employees,
      });
      adminStaffService.updateSettings.mockResolvedValue({
        message:
          "Employee settings updated.",
        user: {
          ...employees[0],
          permissions: [
            "appointment:read",
          ],
        },
      });
    });

    it(
      "loads the workforce once and lets an Administrator save employee-specific permissions",
      async () => {
        render(
          <MemoryRouter>
            <EmployeeAccessPanel
              roles={roles}
            />
          </MemoryRouter>
        );

        expect(
          await screen.findByRole(
            "option",
            {
              name:
                "Alice Stylist · Stylist",
            }
          )
        ).toBeInTheDocument();

        expect(
          adminStaffService.list
        ).toHaveBeenCalledTimes(
          1
        );

        const appointmentPermission =
          screen.getByLabelText(
            "View appointments"
          );

        expect(
          appointmentPermission
        ).toBeEnabled();

        fireEvent.click(
          appointmentPermission
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Save employee access",
            }
          )
        );

        await waitFor(() => {
          expect(
            adminStaffService
              .updateSettings
          ).toHaveBeenCalledWith(
            "user-1",
            {
              permissions: [
                "appointment:read",
              ],
            }
          );
        });
      }
    );

    it(
      "keeps profile-only staff visible without exposing account permissions",
      async () => {
        render(
          <MemoryRouter>
            <EmployeeAccessPanel
              roles={roles}
            />
          </MemoryRouter>
        );

        const select =
          await screen.findByLabelText(
            "Employee"
          );

        fireEvent.change(
          select,
          {
            target: {
              value:
                "profile:profile-2",
            },
          }
        );

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "No login account",
            }
          )
        ).toBeInTheDocument();

        const link =
          screen.getByRole(
            "link",
            {
              name:
                "Manage employee",
            }
          );

        expect(
          link
        ).toHaveAttribute(
          "href",
          "/admin/employees/profile/profile-2"
        );

        expect(
          screen.queryByRole(
            "button",
            {
              name:
                "Save employee access",
            }
          )
        ).not.toBeInTheDocument();
      }
    );
  }
);
