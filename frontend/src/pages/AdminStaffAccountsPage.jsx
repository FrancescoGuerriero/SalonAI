import {
  CheckCircle2,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import ProfilePhotoUploader from "../components/profile/ProfilePhotoUploader.jsx";
import adminStaffService from "../Services/adminStaffService.js";

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
};

function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "The staff-account operation failed."
  );
}

function roleLabel(role) {
  return (
    STAFF_ROLES.find(
      (item) =>
        item.value === role
    )?.label ||
    role ||
    "Unknown"
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

export default function AdminStaffAccountsPage() {
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
              limit: 100,
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

  async function toggleStatus(
    user
  ) {
    const nextStatus =
      user.isActive === false;

    const action =
      nextStatus
        ? "activate"
        : "deactivate";

    const confirmed =
      window.confirm(
        `${action[0].toUpperCase()}${action.slice(
          1
        )} ${user.name}?`
      );

    if (!confirmed) {
      return;
    }

    setUpdatingId(
      user.id
    );

    setError("");
    setSuccess("");

    try {
      const response =
        await adminStaffService.setStatus(
          user.id,
          nextStatus
        );

      setSuccess(
        response?.message ||
          `Staff account ${action}d.`
      );

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
          <div className="flex items-center gap-2 text-indigo-600">
            <UsersRound
              size={20}
            />

            <span className="text-xs font-bold uppercase tracking-wider">
              Administration
            </span>
          </div>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Staff accounts
          </h1>

          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Create and control salon login accounts.
            Stylist accounts are automatically linked
            to their professional stylist profile.
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

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            onClick={
              openCreateForm
            }
          >
            <Plus size={17} />
            Add staff
          </button>
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
          Loading staff accounts...
        </div>
      ) : filteredUsers.length ===
        0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No staff accounts match the current filters.
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

                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        {roleLabel(
                          user.role
                        )}
                      </span>

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
                  </div>
                </div>

                {user.role ===
                "stylist" ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <UserRound
                        size={16}
                      />

                      Stylist profile
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      {user.stylistProfile
                        ? `Linked — ${
                            user
                              .stylistProfile
                              .jobTitle ||
                            "Hair professional"
                          }`
                        : "No linked stylist profile found."}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <ShieldCheck
                      size={15}
                    />

                    Login account
                  </div>

                  <button
                    type="button"
                    className={
                      user.isActive !==
                      false
                        ? "rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        : "rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                    }
                    disabled={
                      updatingId ===
                      user.id
                    }
                    onClick={() =>
                      toggleStatus(
                        user
                      )
                    }
                  >
                    {updatingId ===
                    user.id
                      ? "Updating..."
                      : user.isActive !==
                          false
                        ? "Deactivate"
                        : "Activate"}
                  </button>
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
                    Add staff account
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Create a secure SalonAI sign-in account.
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

                {form.role ===
                "stylist" ? (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
                    A stylist profile will automatically be created or linked using this email address.
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
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  disabled={
                    submitting
                  }
                >
                  <Plus size={17} />

                  {submitting
                    ? "Creating..."
                    : "Create staff account"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
