import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  KeyRound,
  Plus,
  Save,
  Scissors,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import adminStaffService from "../Services/adminStaffService.js";
import appointmentManagementApi from "../Services/appointmentManagementApi.js";
import {
  staffApi,
} from "../Services/futureFeaturesApi.js";
import serviceService from "../Services/serviceService.js";
import staffRoleService from "../Services/staffRoleService.js";
import stylistService from "../Services/stylistService.js";
import useAuth from "../hooks/useAuth.js";
import {
  employeeDisplayPhoto,
} from "../utils/employees.js";
import {
  ASSIGNABLE_EMPLOYEE_PERMISSIONS,
  EMPLOYEE_PERMISSIONS,
  hasPermission,
} from "../utils/permissions.js";
import {
  DEFAULT_ASSIGNABLE_STAFF_ROLES,
  assignableRolesForUser,
} from "../utils/staffRoles.js";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const EMPTY_SCHEDULE =
  DAYS.map((day) => ({
    day,
    available:
      day !== "Sunday",
    start: "09:00",
    end:
      day === "Saturday"
        ? "15:00"
        : "17:00",
    breaks: [],
  }));

function errorMessage(error) {
  return (
    error?.response?.data
      ?.message ||
    error?.message ||
    "The employee operation failed."
  );
}

function dateInput(date) {
  return date
    .toISOString()
    .slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "—";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

function buildSchedule(
  workingHours = []
) {
  return EMPTY_SCHEDULE.map(
    (fallback) => {
      const row =
        workingHours.find(
          (item) =>
            item.day ===
            fallback.day
        );
      return {
        ...fallback,
        ...(row || {}),
        available:
          row
            ? row.available !==
              false
            : fallback.available,
        breaks:
          Array.isArray(
            row?.breaks
          )
            ? row.breaks.map(
                (pause) => ({
                  start:
                    pause?.start ||
                    "",
                  end:
                    pause?.end ||
                    "",
                })
              )
            : [],
      };
    }
  );
}

function settingButtonClass(
  enabled
) {
  return `rounded-xl border px-4 py-2.5 text-sm font-bold text-black transition ${
    enabled
      ? "border-amber-500 bg-amber-300"
      : "border-slate-300 bg-white hover:border-amber-400"
  }`;
}

function usableSignInEmail(
  value
) {
  const email =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  if (
    !email ||
    email.endsWith(
      ".invalid"
    )
  ) {
    return "";
  }

  return email;
}

export default function AdminEmployeeDetailPage() {
  const {
    id,
    recordId,
  } = useParams();
  const {
    user: currentUser,
  } = useAuth();
  const navigate =
    useNavigate();
  const [
    employee,
    setEmployee,
  ] = useState(null);
  const [
    services,
    setServices,
  ] = useState([]);
  const [
    selectedServices,
    setSelectedServices,
  ] = useState([]);
  const [
    schedule,
    setSchedule,
  ] = useState(
    EMPTY_SCHEDULE
  );
  const [
    appointments,
    setAppointments,
  ] = useState([]);
  const [
    timeOff,
    setTimeOff,
  ] = useState([]);
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
  const [
    signInRoles,
    setSignInRoles,
  ] = useState(
    DEFAULT_ASSIGNABLE_STAFF_ROLES
  );
  const [
    signInForm,
    setSignInForm,
  ] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    role: "stylist",
  });

  const signInDisabled =
    Boolean(recordId);
  const profile =
    employee?.stylistProfile ||
    null;
  const canUpdate =
    hasPermission(
      currentUser,
      "employee:update"
    );
  const canUpdateProfiles =
    hasPermission(
      currentUser,
      "profile:all:update"
    );
  const canDeactivate =
    !signInDisabled &&
    hasPermission(
      currentUser,
      "employee:deactivate"
    );
  const canReadServices =
    hasPermission(
      currentUser,
      "service:read"
    );
  const canUpdateServices =
    hasPermission(
      currentUser,
      "employee:services:update"
    );
  const canManageServices =
    canReadServices &&
    canUpdateServices;
  const canUpdateSchedule =
    hasPermission(
      currentUser,
      "employee:schedule:update"
    );
  const canReadAppointments =
    hasPermission(
      currentUser,
      "appointment:read"
    );
  const canManagePermissions =
    !signInDisabled &&
    hasPermission(
      currentUser,
      "employee:permissions:update"
    );
  const canManageRoles =
    hasPermission(
      currentUser,
      "employee:role:update"
    );
  const canEnableSignIn =
    signInDisabled &&
    hasPermission(
      currentUser,
      "employee:create"
    );
  const visibleSignInRoles =
    assignableRolesForUser(
      signInRoles,
      {
        isSuperAdmin:
          canManageRoles,
      }
    );

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const [
            employeeResponse,
            serviceRows,
            roleRows,
          ] =
            await Promise.all([
              signInDisabled
                ? adminStaffService.getEmployeeRecord(
                    recordId
                  )
                : adminStaffService.get(
                    id
                  ),
              canReadServices
                ? serviceService.getManagementServices()
                : Promise.resolve([]),
              canEnableSignIn
                ? staffRoleService
                    .list()
                    .catch(
                      () =>
                        DEFAULT_ASSIGNABLE_STAFF_ROLES
                    )
                : Promise.resolve(
                    DEFAULT_ASSIGNABLE_STAFF_ROLES
                  ),
            ]);
          const nextEmployee =
            employeeResponse.user;
          const nextProfile =
            nextEmployee
              ?.stylistProfile;

          setEmployee(
            nextEmployee
          );

          const nextRoles =
            Array.isArray(
              roleRows
            ) &&
            roleRows.length
              ? roleRows
              : DEFAULT_ASSIGNABLE_STAFF_ROLES;
          const availableRoles =
            assignableRolesForUser(
              nextRoles,
              {
                isSuperAdmin:
                  canManageRoles,
              }
            );
          const initialRole =
            availableRoles.find(
              (role) =>
                role.key ===
                "stylist"
            )?.key ||
            availableRoles[0]?.key ||
            "stylist";

          setSignInRoles(
            nextRoles
          );
          setSignInForm({
            email:
              usableSignInEmail(
                nextEmployee
                  ?.email
              ),
            password: "",
            confirmPassword: "",
            role:
              initialRole,
          });

          setServices(
            serviceRows
          );
          setSelectedServices(
            (nextProfile
              ?.services || [])
              .map((service) =>
                String(
                  service?._id ||
                    service
                )
              )
          );
          setSchedule(
            buildSchedule(
              nextProfile
                ?.workingHours
            )
          );

          if (!nextProfile?.id) {
            setAppointments([]);
            setTimeOff([]);
            return;
          }

          const now =
            new Date();
          const end =
            new Date(now);
          end.setDate(
            end.getDate() +
              120
          );

          const tasks = [
            staffApi.listTimeOff({
              staff:
                nextProfile.id,
            }),
          ];

          if (
            canReadAppointments
          ) {
            tasks.push(
              appointmentManagementApi.getCalendar({
                stylist:
                  nextProfile.id,
                startDate:
                  dateInput(now),
                endDate:
                  dateInput(end),
                limit: 50,
              })
            );
          }

          const results =
            await Promise.all(
              tasks
            );

          setTimeOff(
            results[0]?.items ||
              []
          );
          setAppointments(
            canReadAppointments
              ? results[1]?.items ||
                  []
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
        }
      },
      [
        canEnableSignIn,
        canReadAppointments,
        canReadServices,
        currentUser?.role,
        id,
        recordId,
        signInDisabled,
      ]
    );

  useEffect(() => {
    void load();
  }, [load]);

  async function updateSettings(
    settings,
    operation
  ) {
    setSaving(operation);
    setError("");
    setSuccess("");

    try {
      if (signInDisabled) {
        const stylist =
          await stylistService.updateStylist(
            profile.id,
            settings
          );

        setEmployee(
          (current) => ({
            ...current,
            profilePhoto:
              stylist.profileImage ||
              current?.profilePhoto ||
              "",
            isActive:
              stylist.isActive ===
              true,
            phone:
              stylist.phone ||
              current?.phone ||
              "",
            stylistProfile: {
              ...current
                ?.stylistProfile,
              ...stylist,
              id:
                stylist._id ||
                profile.id,
            },
          })
        );
        setSuccess(
          `${employee.name} staff profile updated.`
        );
        return;
      }

      const response =
        await adminStaffService.updateSettings(
          id,
          settings
        );
      setEmployee(
        response.user
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

  async function updateActiveStatus() {
    const nextActive =
      employee.isActive ===
      false;

    if (
      !nextActive &&
      !window.confirm(
        `Deactivate ${employee.name}? They will no longer be able to sign in or receive bookings.`
      )
    ) {
      return;
    }

    if (signInDisabled) {
      await updateSettings(
        {
          isActive:
            nextActive,
        },
        "active"
      );
      return;
    }

    setSaving("active");
    setError("");
    setSuccess("");

    try {
      const response =
        await adminStaffService.setStatus(
          id,
          nextActive
        );
      setEmployee(
        response.user
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

  async function saveServices() {
    setSaving("services");
    setError("");
    setSuccess("");

    try {
      const response =
        signInDisabled
          ? await adminStaffService.updateRecordServices(
              recordId,
              selectedServices
            )
          : await adminStaffService.updateServices(
              id,
              selectedServices
            );
      setEmployee(
        response.user
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

  function updateScheduleRow(
    index,
    field,
    value
  ) {
    setSchedule(
      (current) =>
        current.map(
          (row, rowIndex) =>
            rowIndex === index
              ? {
                  ...row,
                  [field]: value,
                }
              : row
        )
    );
  }

  function addBreak(
    dayIndex
  ) {
    setSchedule(
      (current) =>
        current.map(
          (row, rowIndex) =>
            rowIndex === dayIndex
              ? {
                  ...row,
                  breaks: [
                    ...(row.breaks || []),
                    {
                      start: "",
                      end: "",
                    },
                  ],
                }
              : row
        )
    );
  }

  function updateBreak(
    dayIndex,
    breakIndex,
    field,
    value
  ) {
    setSchedule(
      (current) =>
        current.map(
          (row, rowIndex) =>
            rowIndex === dayIndex
              ? {
                  ...row,
                  breaks: (
                    row.breaks || []
                  ).map(
                    (
                      pause,
                      pauseIndex
                    ) =>
                      pauseIndex ===
                      breakIndex
                        ? {
                            ...pause,
                            [field]:
                              value,
                          }
                        : pause
                  ),
                }
              : row
        )
    );
  }

  function removeBreak(
    dayIndex,
    breakIndex
  ) {
    setSchedule(
      (current) =>
        current.map(
          (row, rowIndex) =>
            rowIndex === dayIndex
              ? {
                  ...row,
                  breaks: (
                    row.breaks || []
                  ).filter(
                    (
                      _pause,
                      pauseIndex
                    ) =>
                      pauseIndex !==
                      breakIndex
                  ),
                }
              : row
        )
    );
  }

  async function saveSchedule() {
    setSaving("schedule");
    setError("");
    setSuccess("");

    try {
      const workingHours =
        schedule.map(
          (row) => ({
            day: row.day,
            available:
              Boolean(
                row.available
              ),
            start: row.start,
            end: row.end,
            breaks:
              (
                row.breaks || []
              )
                .filter(
                  (pause) =>
                    pause.start &&
                    pause.end
                )
                .map(
                  (pause) => ({
                    start:
                      pause.start,
                    end:
                      pause.end,
                  })
                ),
          })
        );
      const response =
        signInDisabled
          ? await adminStaffService.updateRecordSchedule(
              recordId,
              workingHours
            )
          : await adminStaffService.updateSchedule(
              id,
              workingHours
            );
      setEmployee(
        response.user
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

  function updateSignInField(
    field,
    value
  ) {
    setSignInForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  async function enableSignIn(
    event
  ) {
    event.preventDefault();

    if (
      !canEnableSignIn
    ) {
      return;
    }

    const email =
      signInForm.email
        .trim()
        .toLowerCase();

    if (!email) {
      setError(
        "Enter the employee email address."
      );
      return;
    }

    if (
      signInForm.password
        .length < 8
    ) {
      setError(
        "Temporary password must contain at least 8 characters."
      );
      return;
    }

    if (
      signInForm.password !==
      signInForm.confirmPassword
    ) {
      setError(
        "Temporary password and confirmation do not match."
      );
      return;
    }

    setSaving(
      "sign-in"
    );
    setError("");
    setSuccess("");

    try {
      const response =
        await adminStaffService.enableSignIn(
          recordId,
          {
            email,
            password:
              signInForm.password,
            role:
              signInForm.role,
          }
        );

      const accountId =
        response?.user?.id;

      if (!accountId) {
        throw new Error(
          "Sign-in was enabled but the employee account identifier was not returned."
        );
      }

      navigate(
        `/admin/employees/${accountId}`,
        {
          replace: true,
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
      setSaving("");
    }
  }

  function toggleService(
    serviceId
  ) {
    setSelectedServices(
      (current) =>
        current.includes(
          serviceId
        )
          ? current.filter(
              (item) =>
                item !==
                serviceId
            )
          : [
              ...current,
              serviceId,
            ]
    );
  }

  if (loading) {
    return (
      <main className="p-8 text-center text-sm font-semibold text-slate-700">
        Loading employee workspace...
      </main>
    );
  }

  if (!employee) {
    return (
      <main className="space-y-4 p-8">
        <Link
          to="/admin/employees"
          className="inline-flex items-center gap-2 font-bold text-black"
        >
          <ArrowLeft size={17} />
          Employees
        </Link>

        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          {error ||
            "Employee not found."}
        </div>
      </main>
    );
  }

  return (
    <main
      className="space-y-6 p-4 sm:p-6 lg:p-8"
      id="main-content"
      tabIndex="-1"
    >
      <Link
        to="/admin/employees"
        className="inline-flex items-center gap-2 text-sm font-bold text-black"
      >
        <ArrowLeft size={17} />
        Back to employees
      </Link>

      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-amber-100 font-bold text-black">
              {employeeDisplayPhoto(
                employee
              ) ? (
                <img
                  src={employeeDisplayPhoto(
                    employee
                  )}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound size={28} />
              )}
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-amber-700">
                Employee workspace
              </span>
              <h1 className="mt-1 text-2xl font-bold text-black">
                {employee.name}
              </h1>
              <p className="text-sm text-slate-600">
                {usableSignInEmail(
                  employee.email
                ) ||
                  "Email not configured"}{" "}
                ·{" "}
                {signInDisabled
                  ? "Sign-in not enabled"
                  : employee.role}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className={settingButtonClass(employee.isActive !== false)}>
              {employee.isActive !== false ? "Active" : "Inactive"}
            </span>
            <span className={settingButtonClass(profile?.profilePublished === true)}>
              {profile?.profilePublished ? "Published" : "Unpublished"}
            </span>
            <span className={settingButtonClass(profile?.acceptsAppointments === true)}>
              {profile?.acceptsAppointments === true ? "Bookable" : "Not bookable"}
            </span>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800" role="status">
          <CheckCircle2 size={17} />
          {success}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-black">Profile</h2>
              <p className="text-sm text-slate-600">Professional identity and public presentation.</p>
            </div>
            <UserRound size={21} />
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs font-bold uppercase text-slate-500">Job title</dt><dd className="mt-1 text-sm text-black">{profile?.jobTitle || "Hair professional"}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-slate-500">Phone</dt><dd className="mt-1 text-sm text-black">{employee.phone || "Not provided"}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-slate-500">Professional profile</dt><dd className="mt-1 text-sm text-black">{profile ? "Available" : "Not configured"}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-slate-500">Services</dt><dd className="mt-1 text-sm text-black">{profile?.services?.length || 0} assigned</dd></div>
          </dl>

          <Link
            to={profile?.id ? `/staff/profile?edit=${profile.id}` : "/staff/profile"}
            className="mt-5 inline-flex rounded-xl border border-black px-4 py-2 text-sm font-bold text-black hover:bg-amber-50"
          >
            Edit profile details
          </Link>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck size={21} />
            <div>
              <h2 className="text-lg font-bold text-black">Online booking</h2>
              <p className="text-sm text-slate-600">Independent operational controls.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" disabled={(signInDisabled ? !canUpdateProfiles : !canDeactivate) || Boolean(saving)} className={settingButtonClass(employee.isActive !== false)} onClick={updateActiveStatus}>Active</button>
            <button type="button" disabled={(signInDisabled ? !canUpdateProfiles : !canUpdate) || Boolean(saving)} className={settingButtonClass(profile?.profilePublished === true)} onClick={() => updateSettings({ profilePublished: !profile?.profilePublished }, "published")}>Published</button>
            <button type="button" disabled={(signInDisabled ? !canUpdateProfiles : !canUpdate) || Boolean(saving)} className={settingButtonClass(profile?.acceptsAppointments === true)} onClick={() => updateSettings({ acceptsAppointments: profile?.acceptsAppointments !== true }, "bookable")}>Bookable</button>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            {signInDisabled
              ? "Active controls whether this profile participates in salon operations. Published controls public visibility, and Bookable controls appointment selection across every booking channel."
              : "Active controls system access, Published controls public visibility, and Bookable controls appointment selection across every booking channel."}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <KeyRound
            size={21}
            className="mt-0.5 shrink-0"
          />
          <div>
            <h2 className="text-lg font-bold text-black">
              Sign-in access
            </h2>
            <p className="text-sm text-slate-600">
              Manage this employee&apos;s SalonAI login without creating a second employee record.
            </p>
          </div>
        </div>

        {!signInDisabled ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                Status
              </span>
              <p className="mt-1 font-bold text-emerald-900">
                Sign-in enabled
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Email
              </span>
              <p className="mt-1 break-all text-sm font-semibold text-black">
                {employee.email}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Access role
              </span>
              <p className="mt-1 text-sm font-semibold capitalize text-black">
                {employee.role}
              </p>
            </div>
          </div>
        ) : canEnableSignIn ? (
          <form
            className="mt-5"
            onSubmit={
              enableSignIn
            }
          >
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-slate-700">
              This employee already exists. Enabling sign-in creates only the authentication account and links it to this employee. Profile, services, schedule, publication and booking settings are preserved.
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-black">
                Email address
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={
                    signInForm.email
                  }
                  onChange={(
                    event
                  ) =>
                    updateSignInField(
                      "email",
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-black"
                />
              </label>

              <label className="text-sm font-semibold text-black">
                Access role
                <select
                  required
                  value={
                    signInForm.role
                  }
                  onChange={(
                    event
                  ) =>
                    updateSignInField(
                      "role",
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-black"
                >
                  {visibleSignInRoles.map(
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
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="text-sm font-semibold text-black">
                Temporary password
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={
                    signInForm.password
                  }
                  onChange={(
                    event
                  ) =>
                    updateSignInField(
                      "password",
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-black"
                />
              </label>

              <label className="text-sm font-semibold text-black">
                Confirm temporary password
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={
                    signInForm.confirmPassword
                  }
                  onChange={(
                    event
                  ) =>
                    updateSignInField(
                      "confirmPassword",
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-black"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={
                  saving ===
                  "sign-in"
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 disabled:opacity-50"
              >
                <KeyRound
                  size={17}
                />
                {saving ===
                "sign-in"
                  ? "Enabling sign-in..."
                  : "Enable sign-in"}
              </button>

              <span className="text-xs leading-5 text-slate-500">
                The email must be unique. Existing employee information is not duplicated.
              </span>
            </div>
          </form>
        ) : (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Sign-in is not enabled for this employee. You need the Add employees permission to create and link login credentials.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Scissors size={21} />
            <div><h2 className="text-lg font-bold text-black">Services</h2><p className="text-sm text-slate-600">Choose exactly which services this employee provides.</p></div>
          </div>
          {canManageServices ? <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 disabled:opacity-50" disabled={saving === "services"} onClick={saveServices}><Save size={16} />{saving === "services" ? "Saving..." : "Save services"}</button> : null}
        </div>

        {!canReadServices ? (
          <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Service catalogue access is not permitted for this account.
          </p>
        ) : null}

        {canReadServices && services.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            No services are configured yet.
          </p>
        ) : null}

        {canReadServices ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => {
              const serviceId = String(service._id);
              return <label key={serviceId} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm text-black"><input type="checkbox" className="mt-1 h-4 w-4 accent-amber-400" checked={selectedServices.includes(serviceId)} disabled={!canManageServices} onChange={() => toggleService(serviceId)} /><span><strong className="block">{service.name}</strong><small className="text-slate-500">{service.category || "Salon service"} · {service.active === false ? "Unpublished" : "Published"}</small></span></label>;
            })}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Clock3 size={21} />
            <div>
              <h2 className="text-lg font-bold text-black">
                Weekly schedule and breaks
              </h2>
              <p className="text-sm text-slate-600">
                Configure normal working hours and every break that applies during each working day.
              </p>
            </div>
          </div>

          {canUpdateSchedule ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 disabled:opacity-50"
              disabled={
                saving ===
                "schedule"
              }
              onClick={
                saveSchedule
              }
            >
              <Save size={16} />
              {saving ===
              "schedule"
                ? "Saving..."
                : "Save schedule"}
            </button>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          {schedule.map(
            (
              row,
              dayIndex
            ) => (
              <article
                key={row.day}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="grid gap-3 lg:grid-cols-[10rem_7rem_1fr_1fr_auto] lg:items-end">
                  <div>
                    <span className="text-sm font-bold text-black">
                      {row.day}
                    </span>
                    <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={
                          row.available
                        }
                        disabled={
                          !canUpdateSchedule
                        }
                        onChange={(
                          event
                        ) =>
                          updateScheduleRow(
                            dayIndex,
                            "available",
                            event.target
                              .checked
                          )
                        }
                        className="h-4 w-4 accent-amber-400"
                      />
                      Working
                    </label>
                  </div>

                  <label className="text-xs font-bold uppercase text-slate-500">
                    Start
                    <input
                      type="time"
                      value={
                        row.start
                      }
                      disabled={
                        !canUpdateSchedule ||
                        !row.available
                      }
                      onChange={(
                        event
                      ) =>
                        updateScheduleRow(
                          dayIndex,
                          "start",
                          event.target
                            .value
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-black disabled:bg-slate-100"
                    />
                  </label>

                  <label className="text-xs font-bold uppercase text-slate-500">
                    End
                    <input
                      type="time"
                      value={
                        row.end
                      }
                      disabled={
                        !canUpdateSchedule ||
                        !row.available
                      }
                      onChange={(
                        event
                      ) =>
                        updateScheduleRow(
                          dayIndex,
                          "end",
                          event.target
                            .value
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-black disabled:bg-slate-100"
                    />
                  </label>

                  <div className="lg:col-span-2 lg:text-right">
                    {canUpdateSchedule &&
                    row.available ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-black bg-white px-3 py-2 text-xs font-bold text-black hover:bg-amber-50"
                        onClick={() =>
                          addBreak(
                            dayIndex
                          )
                        }
                      >
                        <Plus
                          size={14}
                        />
                        Add break
                      </button>
                    ) : null}
                  </div>
                </div>

                {row.available ? (
                  <div className="mt-4 space-y-2">
                    {(row.breaks || [])
                      .length ? (
                      (row.breaks || []).map(
                        (
                          pause,
                          breakIndex
                        ) => (
                          <div
                            key={`${row.day}-break-${breakIndex}`}
                            className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                          >
                            <label className="text-xs font-bold uppercase text-slate-500">
                              Break start
                              <input
                                type="time"
                                value={
                                  pause.start
                                }
                                disabled={
                                  !canUpdateSchedule
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateBreak(
                                    dayIndex,
                                    breakIndex,
                                    "start",
                                    event.target
                                      .value
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-black"
                              />
                            </label>

                            <label className="text-xs font-bold uppercase text-slate-500">
                              Break end
                              <input
                                type="time"
                                value={
                                  pause.end
                                }
                                disabled={
                                  !canUpdateSchedule
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateBreak(
                                    dayIndex,
                                    breakIndex,
                                    "end",
                                    event.target
                                      .value
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-black"
                              />
                            </label>

                            {canUpdateSchedule ? (
                              <button
                                type="button"
                                className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-black hover:bg-red-50"
                                onClick={() =>
                                  removeBreak(
                                    dayIndex,
                                    breakIndex
                                  )
                                }
                                aria-label={`Remove break ${breakIndex + 1} from ${row.day}`}
                              >
                                <Trash2
                                  size={14}
                                />
                                Remove
                              </button>
                            ) : null}
                          </div>
                        )
                      )
                    ) : (
                      <p className="text-xs text-slate-500">
                        No breaks configured for this day.
                      </p>
                    )}
                  </div>
                ) : null}
              </article>
            )
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><CalendarDays size={21} /><h2 className="text-lg font-bold text-black">Upcoming appointments</h2></div>{canReadAppointments ? <Link to="/appointments" className="text-sm font-bold text-black">Open calendar</Link> : null}</div>
          <div className="mt-4 space-y-3">
            {!canReadAppointments ? <p className="text-sm text-slate-500">Appointment access is not permitted.</p> : appointments.length ? appointments.slice(0, 8).map((appointment) => <div key={appointment._id} className="rounded-xl border border-slate-200 p-3"><strong className="text-sm text-black">{appointment.service?.name || "Appointment"}</strong><p className="mt-1 text-xs text-slate-500">{formatDateTime(appointment.startsAt || appointment.appointmentDate)} · {appointment.customer?.fullName || appointment.customer?.firstName || "Customer"} · {appointment.status}</p></div>) : <p className="text-sm text-slate-500">No upcoming appointments.</p>}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><CalendarDays size={21} /><h2 className="text-lg font-bold text-black">Leave and time off</h2></div><Link to="/staff-management" className="text-sm font-bold text-black">Manage leave</Link></div>
          <div className="mt-4 space-y-3">
            {timeOff.length ? timeOff.slice(0, 8).map((request) => <div key={request._id} className="rounded-xl border border-slate-200 p-3"><strong className="text-sm capitalize text-black">{request.status}</strong><p className="mt-1 text-xs text-slate-500">{formatDateTime(request.startsAt)} – {formatDateTime(request.endsAt)}</p>{request.reason ? <p className="mt-1 text-xs text-slate-600">{request.reason}</p> : null}</div>) : <p className="text-sm text-slate-500">No leave requests recorded.</p>}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><ShieldCheck size={21} /><div><h2 className="text-lg font-bold text-black">Access & special permissions</h2><p className="text-sm text-slate-600">Role permissions are automatic. Accounts with employee permission-management authority can add employee-specific capabilities without changing the employee's professional profile.</p></div></div>

        {(employee.rolePermissions || []).length ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <strong className="text-sm text-black">Included by custom role</strong>
            <p className="mt-2 text-xs text-slate-600">
              {(employee.rolePermissions || [])
                .map((value) => EMPLOYEE_PERMISSIONS.find((permission) => permission.value === value)?.label || value)
                .join(", ")}
            </p>
          </div>
        ) : null}

        <h3 className="mt-5 text-sm font-bold text-black">Special permissions for this employee</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ASSIGNABLE_EMPLOYEE_PERMISSIONS.map((permission) => <label key={permission.value} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-black"><input type="checkbox" className="h-4 w-4 accent-amber-400" checked={(employee.permissions || []).includes(permission.value)} disabled={!canManagePermissions || Boolean(saving)} onChange={(event) => { const current = employee.permissions || []; const permissions = event.target.checked ? [...current, permission.value] : current.filter((item) => item !== permission.value); void updateSettings({ permissions }, "permissions"); }} /><span>{permission.label}</span></label>)}
        </div>
        {!canManagePermissions ? <p className="mt-4 text-xs text-slate-500">Employee permission-management authority is required to grant or remove employee-specific special permissions.</p> : null}
      </section>
    </main>
  );
}
