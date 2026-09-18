import {
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  RefreshCw,
  Scissors,
  ShieldCheck,
  UsersRound,
  X,
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

import ProfilePhotoUploader from "../components/profile/ProfilePhotoUploader.jsx";
import adminStaffService from "../Services/adminStaffService.js";
import useAuth from "../hooks/useAuth.js";
import {
  employeeScheduleForDate,
  employeeServiceNames,
} from "../utils/employees.js";
import {
  hasPermission,
} from "../utils/permissions.js";
import {
  isAdminRole,
} from "../utils/roles.js";

const STAFF_ROLES = [
  {
    value: "stylist",
    label: "Stylist",
  },
  {
    value: "receptionist",
    label: "Receptionist",
  },
  {
    value: "manager",
    label: "Manager",
  },
  {
    value: "admin",
    label: "Administrator",
  },
];

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  role: "stylist",
  password: "",
  profilePhoto: "",
  profilePublished: false,
  acceptsAppointments: false,
};

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
    isAdminRole(
      currentUser?.role
    );

  const [
    users,
    setUsers,
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
    submitting,
    setSubmitting,
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
    form,
    setForm,
  ] = useState(emptyForm);

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
          const response =
            await adminStaffService.list({
              limit: 500,
            });

          setUsers(
            response?.users || []
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
      []
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

  function updateForm(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  function openCreateForm() {
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function closeCreateForm() {
    if (submitting) {
      return;
    }

    setShowForm(false);
    setForm(emptyForm);
  }

  async function createStaff(
    event
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.password
    ) {
      setError(
        "Name, email and temporary password are required."
      );
      return;
    }

    if (
      form.password.length <
      8
    ) {
      setError(
        "Temporary password must contain at least 8 characters."
      );
      return;
    }

    setSubmitting(true);

    try {
      const response =
        await adminStaffService.create({
          name:
            form.name.trim(),
          email:
            form.email
              .trim()
              .toLowerCase(),
          phone:
            form.phone.trim(),
          role:
            form.role,
          password:
            form.password,
          profilePhoto:
            form.profilePhoto,
          profilePublished:
            form.profilePublished,
          acceptsAppointments:
            form.acceptsAppointments,
        });

      setSuccess(
        response?.message ||
          "Staff account created."
      );

      setShowForm(false);
      setForm(emptyForm);

      await loadUsers({
        quiet: true,
      });
    } catch (
      requestError
    ) {
      setError(
        errorMessage(
          requestError
        )
      );
    } finally {
      setSubmitting(false);
    }
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

            {STAFF_ROLES.map(
              (role) => (
                <option
                  key={
                    role.value
                  }
                  value={
                    role.value
                  }
                >
                  {role.label}
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

                      {canManageRoles && user.accountLinked !== false ? (
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
                          {STAFF_ROLES.map(
                            (role) => (
                              <option
                                key={role.value}
                                value={role.value}
                              >
                                {role.label}
                              </option>
                            )
                          )}
                        </select>
                      ) : (
                        <span className="mt-1 block text-sm font-semibold normal-case tracking-normal text-black">
                          {STAFF_ROLES.find(
                            (role) =>
                              role.value ===
                              user.role
                          )?.label || user.role}
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

                  {user.accountLinked !== false ? (
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
                  ) : (
                    <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-black">
                      Legacy employee profile: no SalonAI login account is linked yet. Profile details remain fully editable by an administrator.
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {user.accountLinked !== false ? (
                      <Link
                        to={`/admin/employees/${user.id}`}
                        className="rounded-lg border border-black px-3 py-2 text-xs font-bold text-black hover:bg-amber-50"
                      >
                        Manage employee
                      </Link>
                    ) : (
                      <Link
                        to={`/admin/stylists?edit=${user.stylistProfile?.id}`}
                        className="rounded-lg border border-black bg-amber-400 px-3 py-2 text-xs font-bold text-black hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                      >
                        Edit employee profile
                      </Link>
                    )}

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

      {showForm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-staff-title"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
                event.currentTarget
            ) {
              closeCreateForm();
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <form
              onSubmit={
                createStaff
              }
            >
              <header className="flex items-center justify-between border-b border-slate-200 p-5">
                <div>
                  <h2
                    id="add-staff-title"
                    className="text-xl font-bold text-slate-900"
                  >
                    Add employee
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Create a SalonAI account and employee profile.
                  </p>
                </div>

                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  disabled={
                    submitting
                  }
                  onClick={
                    closeCreateForm
                  }
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </header>

              <div className="space-y-5 p-5">
                <ProfilePhotoUploader
                  value={
                    form.profilePhoto
                  }
                  onChange={(
                    value
                  ) =>
                    updateForm(
                      "profilePhoto",
                      value
                    )
                  }
                  name={
                    form.name
                  }
                  label="Staff profile photograph"
                  disabled={
                    submitting
                  }
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Full name

                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={
                        form.name
                      }
                      onChange={(
                        event
                      ) =>
                        updateForm(
                          "name",
                          event.target
                            .value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal"
                    />
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    Role

                    <select
                      required
                      value={
                        form.role
                      }
                      onChange={(
                        event
                      ) =>
                        updateForm(
                          "role",
                          event.target
                            .value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal"
                    >
                      {STAFF_ROLES.filter(
                        (role) =>
                          canManageRoles ||
                          [
                            "stylist",
                            "receptionist",
                          ].includes(
                            role.value
                          )
                      ).map(
                        (role) => (
                          <option
                            key={
                              role.value
                            }
                            value={
                              role.value
                            }
                          >
                            {
                              role.label
                            }
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    Email

                    <input
                      type="email"
                      required
                      maxLength={254}
                      value={
                        form.email
                      }
                      onChange={(
                        event
                      ) =>
                        updateForm(
                          "email",
                          event.target
                            .value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal"
                    />
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    Phone

                    <input
                      type="tel"
                      maxLength={30}
                      value={
                        form.phone
                      }
                      onChange={(
                        event
                      ) =>
                        updateForm(
                          "phone",
                          event.target
                            .value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal"
                    />
                  </label>
                </div>

                <label className="block text-sm font-semibold text-slate-700">
                  Temporary password

                  <div className="relative mt-2">
                    <KeyRound
                      size={17}
                      className="absolute left-3 top-3 text-slate-400"
                    />

                    <input
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={
                        form.password
                      }
                      onChange={(
                        event
                      ) =>
                        updateForm(
                          "password",
                          event.target
                            .value
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 font-normal"
                    />
                  </div>

                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    At least 8 characters. Share it securely with the staff member.
                  </span>
                </label>

                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                  <label className="flex items-start gap-3 text-sm text-black">
                    <input
                      type="checkbox"
                      checked={form.profilePublished}
                      onChange={(event) =>
                        updateForm(
                          "profilePublished",
                          event.target.checked
                        )
                      }
                      className="mt-1 h-4 w-4 accent-amber-400"
                    />

                    <span>
                      <strong className="block">Publish profile</strong>
                      Show this employee on public team pages.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 text-sm text-black">
                    <input
                      type="checkbox"
                      checked={form.acceptsAppointments}
                      onChange={(event) =>
                        updateForm(
                          "acceptsAppointments",
                          event.target.checked
                        )
                      }
                      className="mt-1 h-4 w-4 accent-amber-400"
                    />

                    <span>
                      <strong className="block">Bookable online</strong>
                      Allow customers to select this employee for bookings.
                    </span>
                  </label>
                </div>

                {form.role ===
                "stylist" ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">
                    A professional employee profile will automatically be created or linked using this email address.
                  </div>
                ) : null}

                {form.role ===
                "admin" ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Administrator accounts have elevated access. Create them only for trusted administrators.
                  </div>
                ) : null}
              </div>

              <footer className="flex justify-end gap-2 border-t border-slate-200 p-5">
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
                  disabled={
                    submitting
                  }
                  onClick={
                    closeCreateForm
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 disabled:opacity-50"
                  disabled={
                    submitting
                  }
                >
                  <Plus size={17} />

                  {submitting
                    ? "Creating..."
                    : "Create employee"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
