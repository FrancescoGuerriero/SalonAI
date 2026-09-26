import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";

import adminStaffService from "../../Services/adminStaffService.js";
import useAuth from "../../hooks/useAuth.js";
import {
  ASSIGNABLE_EMPLOYEE_PERMISSIONS,
  EMPLOYEE_PERMISSIONS,
  effectivePermissions,
  hasPermission,
} from "../../utils/permissions.js";
import {
  employeeManagementPath,
} from "../../utils/employees.js";

function errorMessage(error) {
  return (
    error?.response?.data
      ?.message ||
    error?.message ||
    "Employee access could not be updated."
  );
}

function labelForPermission(
  value
) {
  return (
    EMPLOYEE_PERMISSIONS.find(
      (permission) =>
        permission.value ===
        value
    )?.label ||
    value
  );
}

function roleLabel(
  roles,
  key
) {
  return (
    roles.find(
      (role) =>
        role.key === key
    )?.name ||
    key ||
    "No role"
  );
}

function samePermissions(
  left = [],
  right = []
) {
  const a =
    [...new Set(left)].sort();
  const b =
    [...new Set(right)].sort();

  return (
    a.length === b.length &&
    a.every(
      (value, index) =>
        value === b[index]
    )
  );
}

export default function EmployeeAccessPanel({
  roles = [],
}) {
  const {
    user: currentUser,
  } = useAuth();

  const canReadEmployees =
    hasPermission(
      currentUser,
      "employee:read"
    );
  const canManagePermissions =
    hasPermission(
      currentUser,
      "employee:permissions:update"
    );
  const canManageRoles =
    hasPermission(
      currentUser,
      "employee:role:update"
    );

  const [
    employees,
    setEmployees,
  ] = useState([]);
  const [
    selectedId,
    setSelectedId,
  ] = useState("");
  const [
    draftRole,
    setDraftRole,
  ] = useState("");
  const [
    draftPermissions,
    setDraftPermissions,
  ] = useState([]);
  const [
    loading,
    setLoading,
  ] = useState(false);
  const [
    saving,
    setSaving,
  ] = useState(false);
  const [
    error,
    setError,
  ] = useState("");
  const [
    success,
    setSuccess,
  ] = useState("");

  const load =
    useCallback(
      async () => {
        if (!canReadEmployees) {
          setEmployees([]);
          setSelectedId("");
          return;
        }

        setLoading(true);
        setError("");

        try {
          const response =
            await adminStaffService.list({
              limit: 500,
              view: "access",
            });
          const rows =
            Array.isArray(
              response?.users
            )
              ? response.users
              : [];

          setEmployees(rows);
          setSelectedId(
            (current) => {
              if (
                rows.some(
                  (employee) =>
                    String(
                      employee.id
                    ) ===
                    String(
                      current
                    )
                )
              ) {
                return current;
              }

              return String(
                rows[0]?.id ||
                  ""
              );
            }
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
      [canReadEmployees]
    );

  useEffect(() => {
    void load();
  }, [load]);

  const selectedEmployee =
    useMemo(
      () =>
        employees.find(
          (employee) =>
            String(
              employee.id
            ) ===
            String(
              selectedId
            )
        ) ||
        null,
      [
        employees,
        selectedId,
      ]
    );

  useLayoutEffect(() => {
    setDraftRole(
      selectedEmployee?.role ||
        ""
    );
    setDraftPermissions(
      Array.isArray(
        selectedEmployee
          ?.permissions
      )
        ? [
            ...selectedEmployee.permissions,
          ]
        : []
    );
  }, [selectedEmployee]);

  const inheritedPermissions =
    useMemo(() => {
      if (!selectedEmployee) {
        return [];
      }

      return effectivePermissions({
        ...selectedEmployee,
        permissions: [],
      });
    }, [selectedEmployee]);

  const signInDisabled =
    selectedEmployee
      ?.signInEnabled ===
    false;
  const isProtectedSuperAdmin =
    selectedEmployee?.role ===
      "super_admin" &&
    !canManageRoles;

  const mayChangePermissions =
    canManagePermissions &&
    !signInDisabled &&
    !isProtectedSuperAdmin;

  const mayChangeRole =
    canManageRoles &&
    !signInDisabled &&
    selectedEmployee?.role !==
      "super_admin";

  const assignableRoles =
    useMemo(
      () =>
        roles.filter(
          (role) =>
            role.active !==
              false &&
            role.assignable !==
              false
        ),
      [roles]
    );

  const hasChanges =
    Boolean(
      selectedEmployee &&
      !signInDisabled &&
      (
        (
          mayChangeRole &&
          draftRole !==
            selectedEmployee.role
        ) ||
        (
          mayChangePermissions &&
          !samePermissions(
            draftPermissions,
            selectedEmployee
              .permissions ||
              []
          )
        )
      )
    );

  function togglePermission(
    permission
  ) {
    if (
      !mayChangePermissions
    ) {
      return;
    }

    setDraftPermissions(
      (current) =>
        current.includes(
          permission
        )
          ? current.filter(
              (item) =>
                item !==
                permission
            )
          : [
              ...current,
              permission,
            ]
    );
  }

  async function saveEmployeeAccess() {
    if (
      !selectedEmployee ||
      signInDisabled
    ) {
      return;
    }

    const payload = {};

    if (
      mayChangeRole &&
      draftRole !==
        selectedEmployee.role
    ) {
      payload.role =
        draftRole;
    }

    if (
      mayChangePermissions &&
      !samePermissions(
        draftPermissions,
        selectedEmployee
          .permissions ||
          []
      )
    ) {
      payload.permissions =
        draftPermissions;
    }

    if (
      Object.keys(
        payload
      ).length === 0
    ) {
      setSuccess(
        "No employee access changes to save."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response =
        await adminStaffService.updateSettings(
          selectedEmployee.id,
          payload
        );
      const updated =
        response?.user;

      if (updated) {
        setEmployees(
          (current) =>
            current.map(
              (employee) =>
                String(
                  employee.id
                ) ===
                String(
                  updated.id
                )
                  ? updated
                  : employee
            )
        );
      }

      setSuccess(
        response?.message ||
          "Employee access updated."
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
      setSaving(false);
    }
  }

  if (!canReadEmployees) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-black">
            Employee access
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-stone-600">
            Select an employee to review their access role, inherited role permissions and employee-specific permissions. Role templates below remain separate and continue to apply to every account assigned to that role.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void load()
          }
          disabled={
            loading ||
            saving
          }
          className="min-h-11 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-50 disabled:opacity-50"
        >
          {loading
            ? "Refreshing..."
            : "Refresh employees"}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"
        >
          {success}
        </div>
      ) : null}

      {loading &&
      employees.length ===
        0 ? (
        <p className="mt-5 text-sm font-semibold text-stone-600">
          Loading employees...
        </p>
      ) : employees.length ===
        0 ? (
        <p className="mt-5 text-sm text-stone-600">
          No staff records are available.
        </p>
      ) : (
        <>
          <label className="mt-5 block max-w-2xl text-sm font-semibold text-black">
            Employee
            <select
              value={
                selectedId
              }
              onChange={(
                event
              ) => {
                setError("");
                setSuccess("");
                setSelectedId(
                  event.target
                    .value
                );
              }}
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-black outline-none focus:border-black focus:ring-2 focus:ring-amber-300"
            >
              {employees.map(
                (employee) => (
                  <option
                    key={
                      employee.id
                    }
                    value={
                      employee.id
                    }
                  >
                    {employee.name}
                    {" · "}
                    {employee.signInEnabled ===
                    false
                      ? "sign-in not enabled"
                      : roleLabel(
                          roles,
                          employee.role
                        )}
                  </option>
                )
              )}
            </select>
          </label>

          {selectedEmployee ? (
            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
              <aside className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
                  Selected employee
                </p>
                <h3 className="mt-2 text-lg font-bold text-black">
                  {
                    selectedEmployee.name
                  }
                </h3>
                <p className="mt-1 break-all text-sm text-stone-600">
                  {selectedEmployee.email ||
                    "No email address"}
                </p>

                <div className="mt-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-stone-500">
                    Current role
                  </span>
                  <p className="mt-1 text-sm font-bold text-black">
                    {signInDisabled
                      ? "Not assigned — sign-in not enabled"
                      : roleLabel(
                          roles,
                          selectedEmployee.role
                        )}
                  </p>
                </div>

                <Link
                  to={employeeManagementPath(
                    selectedEmployee
                  )}
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-black bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-50"
                >
                  Manage employee
                </Link>
              </aside>

              <div className="min-w-0">
                {signInDisabled ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                    <h3 className="font-bold text-black">
                      Sign-in not enabled
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-stone-700">
                      This person is managed as an employee. Application roles and permissions become available only after sign-in access is enabled. Profile details, publication and booking settings remain available from the employee workspace.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-xl border border-stone-200 p-4">
                        <h3 className="font-bold text-black">
                          Access role
                        </h3>

                        {mayChangeRole ? (
                          <select
                            className="mt-3 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-semibold text-black"
                            value={
                              draftRole
                            }
                            onChange={(
                              event
                            ) =>
                              setDraftRole(
                                event.target
                                  .value
                              )
                            }
                          >
                            {assignableRoles.map(
                              (role) => (
                                <option
                                  key={
                                    role.key
                                  }
                                  value={
                                    role.key
                                  }
                                >
                                  {
                                    role.name
                                  }
                                </option>
                              )
                            )}
                          </select>
                        ) : (
                          <p className="mt-2 text-sm text-stone-700">
                            {roleLabel(
                              roles,
                              selectedEmployee.role
                            )}
                          </p>
                        )}

                        {!mayChangeRole ? (
                          <p className="mt-2 text-xs leading-5 text-stone-500">
                            Access-role changes remain Super Admin controlled.
                          </p>
                        ) : null}
                      </div>

                      <div className="rounded-xl border border-stone-200 p-4">
                        <h3 className="font-bold text-black">
                          Inherited role permissions
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {inheritedPermissions.length
                            ? inheritedPermissions
                                .map(
                                  labelForPermission
                                )
                                .join(
                                  ", "
                                )
                            : "No inherited permissions."}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-stone-200 p-4">
                      <h3 className="font-bold text-black">
                        Employee-specific permissions
                      </h3>
                      <p className="mt-1 text-sm text-stone-600">
                        These permissions apply only to this employee and do not modify the selected role template.
                      </p>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {ASSIGNABLE_EMPLOYEE_PERMISSIONS.map(
                          (
                            permission
                          ) => (
                            <label
                              key={
                                permission.value
                              }
                              className="flex min-h-11 items-start gap-3 rounded-lg border border-stone-200 p-2.5 text-sm text-stone-700"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 h-5 w-5 shrink-0 accent-amber-500"
                                checked={draftPermissions.includes(
                                  permission.value
                                )}
                                disabled={
                                  !mayChangePermissions ||
                                  saving
                                }
                                onChange={() =>
                                  togglePermission(
                                    permission.value
                                  )
                                }
                              />
                              <span>
                                {
                                  permission.label
                                }
                              </span>
                            </label>
                          )
                        )}
                      </div>

                      {!mayChangePermissions ? (
                        <p className="mt-3 text-xs leading-5 text-stone-500">
                          You can review this employee's access but do not have authority to change employee-specific permissions.
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={
                          saving ||
                          !hasChanges
                        }
                        onClick={() =>
                          void saveEmployeeAccess()
                        }
                        className="min-h-11 rounded-xl border border-black bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 disabled:opacity-50"
                      >
                        {saving
                          ? "Saving..."
                          : "Save employee access"}
                      </button>

                      {isProtectedSuperAdmin ? (
                        <span className="text-xs font-semibold text-stone-500">
                          Only another Super Admin can modify this account.
                        </span>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
