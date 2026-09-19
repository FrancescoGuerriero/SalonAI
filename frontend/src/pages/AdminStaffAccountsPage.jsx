import {
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Scissors,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";

import AddEmployeeModal from "../components/employees/AddEmployeeModal.jsx";
import adminStaffService from "../Services/adminStaffService.js";
import staffRoleService from "../Services/staffRoleService.js";
import useAuth from "../hooks/useAuth.js";
import {
  employeeScheduleForDate,
  employeeServiceNames,
} from "../utils/employees.js";
import {
  hasPermission,
} from "../utils/permissions.js";
import {
  isSuperAdminRole,
} from "../utils/roles.js";

function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "The staff-account operation failed."
  );
}

function avatarInitials(name) {
  const parts =
    String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

  return parts
    .map((item) =>
      item[0]?.toUpperCase()
    )
    .join("") || "SA";
}

function SettingSwitch({
  checked,
  disabled,
  label,
  onChange,
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() =>
        onChange(!checked)
      }
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 rounded-full transition ${
          checked
            ? "bg-amber-400"
            : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
            checked
              ? "left-[18px]"
              : "left-0.5"
          }`}
        />
      </span>

      {label}
    </button>
  );
}

export default function AdminStaffAccountsPage() {
  const {
    user: currentUser,
  } = useAuth();

  const canCreate =
    hasPermission(
      currentUser,
      "employee:create"
    );

  const canUpdate =
    hasPermission(
      currentUser,
      "employee:update"
    );

  const canDeactivate =
    hasPermission(
      currentUser,
      "employee:deactivate"
    );

  const canManageRoles =
    isSuperAdminRole(
      currentUser?.role
    );

  const canViewStaffRoles =
    hasPermission(
      currentUser,
      "staff-role:read"
    );

  const [
    users,
    setUsers,
  ] = useState([]);

  const [
    roles,
    setRoles,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    updatingId,
    setUpdatingId,
  ] = useState("");

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    roleFilter,
    setRoleFilter,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const loadUsers =
    useCallback(
      async ({
        quiet = false,
      } = {}) => {
        if (quiet) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        try {
          const [
            response,
            roleRows,
          ] =
            await Promise.all([
              adminStaffService.list({
                limit: 500,
              }),
              canViewStaffRoles
                ? staffRoleService.list()
                : Promise.resolve([]),
            ]);

          setUsers(
            response?.users || []
          );
          setRoles(
            Array.isArray(roleRows)
              ? roleRows
              : []
          );
        } catch (
          requestError
        ) {
          setError(
            errorMessage(
              requestError
            )
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        canViewStaffRoles,
      ]
    );

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return users.filter(
        (user) => {
          if (
            roleFilter &&
            user.role !==
              roleFilter
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return [
            user.name,
            user.email,
            user.phone,
            user.role,
          ].some((value) =>
            String(
              value || ""
            )
              .toLowerCase()
              .includes(query)
          );
        }
      );
    }, [
      users,
      search,
      roleFilter,
    ]);

  function openCreateForm() {
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  async function updateEmployeeSetting(
    user,
    field,
    value
  ) {
    if (
      field ===
        "isActive" &&
      value === false &&
      !window.confirm(
        `Deactivate ${user.name}? They will no longer be able to sign in or receive bookings.`
      )
    ) {
      return;
    }

    const operationId =
      `${user.id}:${field}`;

    setUpdatingId(
      operationId
    );

    setError("");
    setSuccess("");

    try {
      const response =
        field === "isActive"
          ? await adminStaffService.setStatus(
              user.id,
              value
            )
          : await adminStaffService.updateSettings(
              user.id,
              {
                [field]: value,
              }
            );

      setSuccess(
        response?.message ||
          "Employee settings updated."
      );

      setUsers(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              user.id
                ? response.user
                : item
          )
      );
    } catch (
      requestError
    ) {
      setError(
        errorMessage(
          requestError
        )
      );
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <main
      className="space-y-6 p-4 sm:p-6 lg:p-8"
      id="main-content"
      tabIndex="-1"
    >
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-amber-700">
            <UsersRound
              size={20}
            />

            <span className="text-xs font-bold uppercase tracking-wider">
              Administration
            </span>
          </div>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Employees
          </h1>

          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Manage employee roles, login access,
            public visibility, online booking and
            today&apos;s schedule from one page.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={refreshing}
            onClick={() =>
              loadUsers({
                quiet: true,
              })
            }
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>

          {canViewStaffRoles ? (
            <Link
              to="/admin/staff-roles"
              className="inline-flex items-center gap-2 rounded-xl border border-black bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-50"
            >
              <ShieldCheck size={17} />
              Manage roles
            </Link>
          ) : null}

          {canCreate ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300"
              onClick={
                openCreateForm
              }
            >
              <Plus size={17} />
              Add employee
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
          role="status"
        >
          <CheckCircle2
            size={17}
          />
          {success}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_14rem]">
          <input
            type="search"
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            placeholder="Search staff name, email or phone..."
            value={search}
            onChange={(
              event
            ) =>
              setSearch(
                event.target
                  .value
              )
            }
          />

          <select
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
            value={
              roleFilter
            }
            onChange={(
              event
            ) =>
              setRoleFilter(
                event.target
                  .value
              )
            }
          >
            <option value="">
              All staff roles
            </option>

            {roles.map(
              (role) => (
                <option
                  key={
                    role.key
                  }
                  value={
                    role.key
                  }
                >
                  {role.name}
                  {role.active === false
                    ? " (inactive)"
                    : ""}
                </option>
              )
            )}
          </select>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-600">
          Loading employees...
        </div>
      ) : filteredUsers.length ===
        0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No employees match the current filters.
        </div>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {filteredUsers.map(
            (user) => (
              <article
                key={user.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                    {user.profilePhoto ? (
                      <img
                        src={
                          user.profilePhoto
                        }
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      avatarInitials(
                        user.name
                      )
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-slate-900">
                        {user.name}
                      </h2>

                      <span
                        className={
                          user.isActive !==
                          false
                            ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                            : "rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700"
                        }
                      >
                        {user.isActive !==
                        false
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </div>

                    <p className="mt-1 break-all text-sm text-slate-600">
                      {user.email}
                    </p>

                    {user.phone ? (
                      <p className="mt-1 text-sm text-slate-500">
                        {user.phone}
                      </p>
                    ) : null}

                    <label className="mt-3 block max-w-52 text-xs font-bold uppercase tracking-wide text-slate-600">
                      Access role

                      {canManageRoles ? (
                        <select
                          value={user.role}
                          disabled={Boolean(updatingId)}
                          onChange={(event) =>
                            updateEmployeeSetting(
                              user,
                              "role",
                              event.target.value
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-semibold normal-case tracking-normal text-black"
                          aria-label={`Role for ${user.name}`}
                        >
                          {roles.map(
                            (role) => (
                              <option
                                key={role.key}
                                value={role.key}
                                disabled={
                                  (
                                    role.assignable === false ||
                                    role.active === false
                                  ) &&
                                  user.role !== role.key
                                }
                              >
                                {role.name}
                                {role.active === false
                                  ? " (inactive)"
                                  : ""}
                              </option>
                            )
                          )}
                        </select>
                      ) : (
                        <span className="mt-1 block text-sm font-semibold normal-case tracking-normal text-black">
                          {roles.find(
                            (role) =>
                              role.key ===
                              user.role
                          )?.name || user.role}
                        </span>
                      )}
                    </label>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-black">
                      <CalendarClock size={16} />
                      Today&apos;s schedule
                    </div>

                    <p className="mt-1 text-sm text-slate-700">
                      {employeeScheduleForDate(user)}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-black">
                      <Scissors size={16} />
                      Services
                    </div>

                    <p className="mt-1 text-sm text-slate-700">
                      {employeeServiceNames(user).length
                        ? employeeServiceNames(user).join(", ")
                        : "No services assigned"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                    <ShieldCheck size={15} />
                    Employee controls
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <SettingSwitch
                      checked={user.isActive !== false}
                      disabled={Boolean(updatingId) || !canDeactivate}
                      label="Active"
                      onChange={(value) =>
                        updateEmployeeSetting(
                          user,
                          "isActive",
                          value
                        )
                      }
                    />

                    <SettingSwitch
                      checked={user.stylistProfile?.profilePublished === true}
                      disabled={Boolean(updatingId) || !canUpdate}
                      label="Published"
                      onChange={(value) =>
                        updateEmployeeSetting(
                          user,
                          "profilePublished",
                          value
                        )
                      }
                    />

                    <SettingSwitch
                      checked={user.stylistProfile?.acceptsAppointments === true}
                      disabled={Boolean(updatingId) || !canUpdate}
                      label="Bookable"
                      onChange={(value) =>
                        updateEmployeeSetting(
                          user,
                          "acceptsAppointments",
                          value
                        )
                      }
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      to={`/admin/employees/${user.id}`}
                      className="rounded-lg border border-black px-3 py-2 text-xs font-bold text-black hover:bg-amber-50"
                    >
                      Manage employee
                    </Link>

                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      {user.stylistProfile?.profilePublished ? (
                        <Eye size={14} />
                      ) : (
                        <EyeOff size={14} />
                      )}
                      {user.stylistProfile?.profilePublished
                        ? "Public profile visible"
                        : "Public profile hidden"}
                    </span>
                  </div>
                </div>
              </article>
            )
          )}
        </section>
      )}

      <AddEmployeeModal
        open={showForm}
        onClose={() =>
          setShowForm(false)
        }
        onCreated={async (
          response
        ) => {
          setError("");
          setSuccess(
            response?.message ||
              "Employee account and profile created successfully."
          );

          await loadUsers({
            quiet: true,
          });
        }}
      />

    </main>
  );
}
