import {
  CheckCircle2,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
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

import EmployeeAccessPanel from "../components/employees/EmployeeAccessPanel.jsx";
import staffRoleService from "../Services/staffRoleService.js";
import useAuth from "../hooks/useAuth.js";
import {
  ASSIGNABLE_EMPLOYEE_PERMISSIONS,
  hasPermission,
} from "../utils/permissions.js";

function errorMessage(error) {
  return (
    error?.response?.data
      ?.message ||
    error?.message ||
    "The staff-role operation failed."
  );
}

function emptyRole() {
  return {
    name: "",
    key: "",
    description: "",
    active: true,
    permissions: [],
  };
}

function groupPermissions() {
  const groups = new Map();

  for (const permission of
    ASSIGNABLE_EMPLOYEE_PERMISSIONS) {
    const group =
      permission.group ||
      "Other";

    if (!groups.has(group)) {
      groups.set(
        group,
        []
      );
    }

    groups
      .get(group)
      .push(
        permission
      );
  }

  return [
    ...groups.entries(),
  ];
}

function PermissionLabel({
  permission,
  permissionScopes,
  required = false,
}) {
  const scope =
    permissionScopes?.[
      permission.value
    ];

  return (
    <span className="min-w-0">
      <span className="flex flex-wrap items-center gap-1.5">
        <span>
          {permission.label}
        </span>
        {required ? (
          <small className="font-semibold text-stone-500">
            Required
          </small>
        ) : null}
        {scope ? (
          <small
            className="rounded-full border border-stone-300 bg-stone-100 px-2 py-0.5 text-[0.68rem] font-bold text-stone-700"
            title={
              scope.description
            }
          >
            {scope.label}
          </small>
        ) : null}
      </span>
    </span>
  );
}

export default function StaffRoleManagementPage() {
  const {
    user,
  } = useAuth();

  const canCreate =
    hasPermission(
      user,
      "staff-role:create"
    );
  const canUpdate =
    hasPermission(
      user,
      "staff-role:update"
    );
  const canActivate =
    hasPermission(
      user,
      "staff-role:activate"
    );
  const canDelete =
    hasPermission(
      user,
      "staff-role:delete"
    );
  const canReadEmployees =
    hasPermission(
      user,
      "employee:read"
    );

  const [
    roles,
    setRoles,
  ] = useState([]);
  const [
    permissionScopes,
    setPermissionScopes,
  ] = useState({});
  const [
    scopeLegend,
    setScopeLegend,
  ] = useState([]);
  const [
    form,
    setForm,
  ] = useState(
    emptyRole
  );
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    saving,
    setSaving,
  ] = useState("");
  const [
    error,
    setError,
  ] = useState("");
  const [
    success,
    setSuccess,
  ] = useState("");

  const permissionGroups =
    useMemo(
      groupPermissions,
      []
    );

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const result =
            await staffRoleService.listWithMetadata();

          setRoles(
            result.roles
          );
          setPermissionScopes(
            result.permissionScopes
          );
          setScopeLegend(
            result.scopeLegend
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
        }
      },
      []
    );

  useEffect(() => {
    void load();
  }, [load]);

  function updateForm(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]:
          value,
      })
    );
  }

  function toggleFormPermission(
    permission
  ) {
    setForm(
      (current) => ({
        ...current,
        permissions:
          current.permissions.includes(
            permission
          )
            ? current.permissions.filter(
                (item) =>
                  item !==
                  permission
              )
            : [
                ...current.permissions,
                permission,
              ],
      })
    );
  }

  function patchRoleState(
    id,
    field,
    value
  ) {
    setRoles(
      (current) =>
        current.map(
          (role) =>
            role.id === id
              ? {
                  ...role,
                  [field]:
                    value,
                }
              : role
        )
    );
  }

  function toggleRolePermission(
    role,
    permission
  ) {
    const permissions =
      role.permissions || [];

    patchRoleState(
      role.id,
      "permissions",
      permissions.includes(
        permission
      )
        ? permissions.filter(
            (item) =>
              item !==
              permission
          )
        : [
            ...permissions,
            permission,
          ]
    );
  }

  async function createRole(
    event
  ) {
    event.preventDefault();

    setSaving("create");
    setError("");
    setSuccess("");

    try {
      const response =
        await staffRoleService.create(
          form
        );

      setRoles(
        (current) => [
          ...current,
          response.role,
        ]
      );
      setForm(
        emptyRole()
      );
      setSuccess(
        response.message
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
      setSaving("");
    }
  }

  async function saveRole(
    role
  ) {
    setSaving(
      role.id
    );
    setError("");
    setSuccess("");

    try {
      const payload =
        role.system
          ? {
              ...(canUpdate
                ? {
                    description:
                      role.description,
                    permissions:
                      role.permissions,
                  }
                : {}),
            }
          : {
              ...(canUpdate
                ? {
                    name:
                      role.name,
                    description:
                      role.description,
                    permissions:
                      role.permissions,
                  }
                : {}),
              ...(canActivate
                ? {
                    active:
                      role.active,
                  }
                : {}),
            };

      const response =
        await staffRoleService.update(
          role.id,
          payload
        );

      setRoles(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              role.id
                ? response.role
                : item
          )
      );
      setSuccess(
        response.assignedEmployeesUpdated
          ? `${response.message} ${response.assignedEmployeesUpdated} assigned employee account(s) were synchronised.`
          : response.message
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
      setSaving("");
    }
  }

  async function deleteRole(
    role
  ) {
    if (
      !window.confirm(
        `Delete custom role "${role.name}"? This is only allowed when no employees are assigned to it.`
      )
    ) {
      return;
    }

    setSaving(
      role.id
    );
    setError("");
    setSuccess("");

    try {
      const response =
        await staffRoleService.remove(
          role.id
        );

      setRoles(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              role.id
          )
      );
      setSuccess(
        response.message
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
      setSaving("");
    }
  }

  const builtIn =
    roles.filter(
      (role) =>
        role.system
    );
  const custom =
    roles.filter(
      (role) =>
        !role.system
    );

  return (
    <main
      className="space-y-6 p-4 sm:p-6 lg:p-8"
      id="main-content"
      tabIndex="-1"
    >
      <header className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-700">
              <ShieldCheck
                size={20}
              />
              <span className="text-xs font-bold uppercase tracking-wider">
                Role management
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-black">
              Staff roles
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-stone-600">
              Manage built-in and custom staff-role permissions. Protected system role keys stay stable while authorised managers can change the capabilities assigned to each role.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canReadEmployees ? (
              <Link
                to="/admin/employees"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-black bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                Employees
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() =>
                void load()
              }
              disabled={
                loading
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div
          className="rounded-xl border border-black bg-white px-4 py-3 text-sm font-semibold text-black shadow-sm"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-black"
          role="status"
        >
          <CheckCircle2
            size={17}
          />
          {success}
        </div>
      ) : null}

      {canReadEmployees ? (
        <EmployeeAccessPanel
          roles={roles}
        />
      ) : null}

      {scopeLegend.length ? (
        <details className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-sm font-bold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
            Permission scope guide
          </summary>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-600">
            Scope describes where a permission may be used once multi-location enforcement is active. It does not grant access by itself; the employee still needs the permission and trusted business/location authority.
          </p>
          <div
            className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            role="list"
          >
            {scopeLegend.map(
              (scope) => (
                <div
                  key={
                    scope.code
                  }
                  role="listitem"
                  className="rounded-xl border border-stone-200 bg-stone-50 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-stone-300 bg-white px-2 py-0.5 text-xs font-black text-stone-700">
                      {scope.code}
                    </span>
                    <strong className="text-sm text-black">
                      {scope.label}
                    </strong>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-stone-600">
                    {scope.description}
                  </p>
                </div>
              )
            )}
          </div>
        </details>
      ) : null}

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-black">
          Built-in roles
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Administrator, Receptionist, Manager and Stylist permissions can be edited here. Required baseline permissions are protected; additional permissions can be added or removed. Super Admin always retains every capability.
        </p>

        <div className="mt-4 space-y-4">
          {builtIn.map(
            (role) => {
              const baseline =
                role.baselinePermissions ||
                [];
              const editable =
                canUpdate &&
                role.editable !==
                  false;

              return (
                <article
                  key={
                    role.key
                  }
                  className="rounded-xl border border-stone-200 bg-stone-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <strong className="text-black">
                        {role.name}
                      </strong>
                      <p className="mt-1 text-xs font-mono text-stone-500">
                        {role.key}
                      </p>
                    </div>
                    <span className="rounded-full border border-stone-300 bg-white px-2 py-1 text-xs font-bold text-stone-600">
                      {role.editable === false
                        ? "Protected"
                        : "System role"}
                    </span>
                  </div>

                  {role.editable !== false ? (
                    <>
                      <label className="mt-4 block text-sm font-semibold text-black">
                        Description
                        <textarea
                          rows="2"
                          disabled={
                            !editable
                          }
                          maxLength={500}
                          value={
                            role.description ||
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            patchRoleState(
                              role.id,
                              "description",
                              event.target
                                .value
                            )
                          }
                          className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-black focus:ring-2 focus:ring-amber-300 disabled:bg-stone-100"
                        />
                      </label>

                      <div className="mt-5 space-y-4">
                        {permissionGroups.map(
                          ([
                            group,
                            permissions,
                          ]) => (
                            <fieldset
                              key={group}
                              className="rounded-xl border border-stone-200 bg-white p-4"
                            >
                              <legend className="px-2 text-sm font-bold text-black">
                                {group}
                              </legend>
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {permissions.map(
                                  (
                                    permission
                                  ) => {
                                    const required =
                                      baseline.includes(
                                        permission.value
                                      );

                                    return (
                                      <label
                                        key={
                                          permission.value
                                        }
                                        className="flex min-h-11 items-start gap-3 rounded-lg border border-stone-200 p-2.5 text-sm text-stone-700 hover:bg-amber-50"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={(
                                            role.permissions ||
                                            []
                                          ).includes(
                                            permission.value
                                          )}
                                          disabled={
                                            !editable ||
                                            required
                                          }
                                          onChange={() =>
                                            toggleRolePermission(
                                              role,
                                              permission.value
                                            )
                                          }
                                          className="mt-0.5 h-5 w-5 shrink-0 accent-amber-500"
                                        />
                                        <PermissionLabel
                                          permission={
                                            permission
                                          }
                                          permissionScopes={
                                            permissionScopes
                                          }
                                          required={
                                            required
                                          }
                                        />
                                      </label>
                                    );
                                  }
                                )}
                              </div>
                            </fieldset>
                          )
                        )}
                      </div>

                      {editable ? (
                        <button
                          type="button"
                          disabled={
                            saving ===
                            role.id
                          }
                          onClick={() =>
                            void saveRole(
                              role
                            )
                          }
                          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-black bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-50"
                        >
                          <Save
                            size={16}
                          />
                          {saving === role.id
                            ? "Saving..."
                            : "Save role permissions"}
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-stone-600">
                      Super Admin has every SalonAI permission and cannot be reduced.
                    </p>
                  )}
                </article>
              );
            }
          )}
        </div>
      </section>

      {canCreate ? (
        <form
        className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
        onSubmit={
        createRole
        }
        >
        <div className="flex items-center gap-2">
        <Plus size={19} />
        <h2 className="text-lg font-bold text-black">
        Create custom role
        </h2>
        </div>
        
        <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-black">
        Role name
        <input
        required
        maxLength={80}
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
        className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-normal outline-none focus:border-black focus:ring-2 focus:ring-amber-300"
        placeholder="Colour Specialist"
        />
        </label>
        
        <label className="text-sm font-semibold text-black">
        Role key
        <input
        maxLength={40}
        value={
        form.key
        }
        onChange={(
        event
        ) =>
        updateForm(
        "key",
        event.target
        .value
        )
        }
        className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-normal outline-none focus:border-black focus:ring-2 focus:ring-amber-300"
        placeholder="colour_specialist"
        />
        <span className="mt-1 block text-xs font-normal text-stone-500">
        Optional. Generated from the role name when left blank.
        </span>
        </label>
        </div>
        
        <label className="mt-4 block text-sm font-semibold text-black">
        Description
        <textarea
        rows="3"
        maxLength={500}
        value={
        form.description
        }
        onChange={(
        event
        ) =>
        updateForm(
        "description",
        event.target
        .value
        )
        }
        className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-normal outline-none focus:border-black focus:ring-2 focus:ring-amber-300"
        />
        </label>
        
        <div className="mt-5 space-y-4">
        {permissionGroups.map(
        ([
        group,
        permissions,
        ]) => (
        <fieldset
        key={group}
        className="rounded-xl border border-stone-200 p-4"
        >
        <legend className="px-2 text-sm font-bold text-black">
        {group}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {permissions.map(
        (
        permission
        ) => (
        <label
        key={
        permission.value
        }
        className="flex min-h-11 items-start gap-3 rounded-lg border border-stone-200 p-2.5 text-sm text-stone-700 hover:bg-amber-50"
        >
        <input
        type="checkbox"
        checked={
        form.permissions.includes(
        permission.value
        )
        }
        onChange={() =>
        toggleFormPermission(
        permission.value
        )
        }
        className="mt-0.5 h-5 w-5 shrink-0 accent-amber-500"
        />
        <PermissionLabel
        permission={
        permission
        }
        permissionScopes={
        permissionScopes
        }
        />
        </label>
        )
        )}
        </div>
        </fieldset>
        )
        )}
        </div>
        
        <button
        type="submit"
        disabled={
        saving ===
        "create"
        }
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-black bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-50"
        >
        <Plus size={16} />
        {saving ===
        "create"
        ? "Creating..."
        : "Create role"}
        </button>
        </form>
      ) : (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600 shadow-sm">
          You can view staff roles, but your account does not have permission to create new roles.
        </section>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-black">
            Custom roles
          </h2>
          <p className="text-sm text-stone-600">
            Permission edits are synchronised to employees assigned to the role.
          </p>
        </div>

        {custom.length ? (
          custom.map(
            (role) => (
              <article
                key={
                  role.id
                }
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold text-black">
                    Name
                    <input
                      value={
                        role.name
                      }
                      disabled={
                        !canUpdate
                      }
                      maxLength={80}
                      onChange={(
                        event
                      ) =>
                        patchRoleState(
                          role.id,
                          "name",
                          event.target
                            .value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-normal outline-none focus:border-black focus:ring-2 focus:ring-amber-300"
                    />
                  </label>

                  <div>
                    <span className="text-sm font-semibold text-black">
                      Role key
                    </span>
                    <div className="mt-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 font-mono text-sm text-stone-700">
                      {role.key}
                    </div>
                  </div>
                </div>

                <label className="mt-4 block text-sm font-semibold text-black">
                  Description
                  <textarea
                    rows="2"
                    disabled={
                      !canUpdate
                    }
                    maxLength={500}
                    value={
                      role.description ||
                      ""
                    }
                    onChange={(
                      event
                    ) =>
                      patchRoleState(
                        role.id,
                        "description",
                        event.target
                          .value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-normal outline-none focus:border-black focus:ring-2 focus:ring-amber-300"
                  />
                </label>

                <label className="mt-4 flex min-h-11 items-center gap-3 rounded-lg border border-stone-200 p-2.5 text-sm font-semibold text-black hover:bg-amber-50">
                  <input
                    type="checkbox"
                    checked={
                      role.active !==
                      false
                    }
                    disabled={
                      !canActivate
                    }
                    onChange={(
                      event
                    ) =>
                      patchRoleState(
                        role.id,
                        "active",
                        event.target
                          .checked
                      )
                    }
                    className="h-5 w-5 shrink-0 accent-amber-500"
                  />
                  Active and assignable
                </label>

                <div className="mt-5 space-y-4">
                  {permissionGroups.map(
                    ([
                      group,
                      permissions,
                    ]) => (
                      <fieldset
                        key={group}
                        className="rounded-xl border border-stone-200 p-4"
                      >
                        <legend className="px-2 text-sm font-bold text-black">
                          {group}
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {permissions.map(
                            (
                              permission
                            ) => (
                              <label
                                key={
                                  permission.value
                                }
                                className="flex min-h-11 items-start gap-3 rounded-lg border border-stone-200 p-2.5 text-sm text-stone-700 hover:bg-amber-50"
                              >
                                <input
                                  type="checkbox"
                                  disabled={
                                    !canUpdate
                                  }
                                  checked={(
                                    role.permissions ||
                                    []
                                  ).includes(
                                    permission.value
                                  )}
                                  onChange={() =>
                                    toggleRolePermission(
                                      role,
                                      permission.value
                                    )
                                  }
                                  className="mt-0.5 h-5 w-5 shrink-0 accent-amber-500"
                                />
                                <PermissionLabel
                                  permission={
                                    permission
                                  }
                                  permissionScopes={
                                    permissionScopes
                                  }
                                />
                              </label>
                            )
                          )}
                        </div>
                      </fieldset>
                    )
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {canUpdate || canActivate ? (
                    <button
                      type="button"
                      disabled={
                        saving ===
                        role.id
                      }
                      onClick={() =>
                        void saveRole(
                          role
                        )
                      }
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-50"
                    >
                      <Save
                        size={16}
                      />
                      Save allowed changes
                    </button>
                  ) : null}

                  {canDelete ? (
                    <button
                      type="button"
                      disabled={
                        saving ===
                        role.id
                      }
                      onClick={() =>
                        void deleteRole(
                          role
                        )
                      }
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-50"
                    >
                      <Trash2
                        size={16}
                      />
                      Delete
                    </button>
                  ) : null}
                </div>
              </article>
            )
          )
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-600">
            No custom staff roles have been created yet.
          </div>
        )}
      </section>
    </main>
  );
}
