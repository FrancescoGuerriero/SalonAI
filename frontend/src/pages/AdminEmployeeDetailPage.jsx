import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
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
  useMemo,
  useState,
} from "react";
import {
  Link,
  useParams,
} from "react-router-dom";

import adminStaffService from "../Services/adminStaffService.js";
import appointmentManagementApi from "../Services/appointmentManagementApi.js";
import {
  staffApi,
} from "../Services/futureFeaturesApi.js";
import serviceService from "../Services/serviceService.js";
import useAuth from "../hooks/useAuth.js";
import {
  EMPLOYEE_PERMISSIONS,
  hasPermission,
} from "../utils/permissions.js";
import {
  isSuperAdminRole,
} from "../utils/roles.js";

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

export default function AdminEmployeeDetailPage() {
  const {
    id,
  } = useParams();
  const {
    user: currentUser,
  } = useAuth();
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

  const profile =
    employee?.stylistProfile ||
    null;
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
  const canUpdateServices =
    hasPermission(
      currentUser,
      "employee:services:update"
    );
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
    isSuperAdminRole(
      currentUser?.role
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
          ] =
            await Promise.all([
              adminStaffService.get(
                id
              ),
              serviceService.getServices(),
            ]);
          const nextEmployee =
            employeeResponse.user;
          const nextProfile =
            nextEmployee
              ?.stylistProfile;

          setEmployee(
            nextEmployee
          );
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
        canReadAppointments,
        id,
      ]
    );

  useEffect(() => {
    void load();
  }, [load]);

  const activeServices =
    useMemo(
      () =>
        services.filter(
          (service) =>
            service.active !==
            false
        ),
      [services]
    );

  async function updateSettings(
    settings,
    operation
  ) {
    setSaving(operation);
    setError("");
    setSuccess("");

    try {
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
        await adminStaffService.updateServices(
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
        await adminStaffService.updateSchedule(
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
              {employee.profilePhoto ? (
                <img
                  src={employee.profilePhoto}
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
                {employee.email} · {employee.role}
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
            <div><dt className="text-xs font-bold uppercase text-slate-500">Profile</dt><dd className="mt-1 text-sm text-black">{profile ? "Linked" : "Not linked"}</dd></div>
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
            <button type="button" disabled={!canDeactivate || Boolean(saving)} className={settingButtonClass(employee.isActive !== false)} onClick={updateActiveStatus}>Active</button>
            <button type="button" disabled={!canUpdate || Boolean(saving)} className={settingButtonClass(profile?.profilePublished === true)} onClick={() => updateSettings({ profilePublished: !profile?.profilePublished }, "published")}>Published</button>
            <button type="button" disabled={!canUpdate || Boolean(saving)} className={settingButtonClass(profile?.acceptsAppointments === true)} onClick={() => updateSettings({ acceptsAppointments: profile?.acceptsAppointments !== true }, "bookable")}>Bookable</button>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Active controls system access, Published controls public visibility, and Bookable controls customer appointment selection.
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Scissors size={21} />
            <div><h2 className="text-lg font-bold text-black">Services</h2><p className="text-sm text-slate-600">Choose exactly which services this employee provides.</p></div>
          </div>
          {canUpdateServices ? <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 disabled:opacity-50" disabled={saving === "services"} onClick={saveServices}><Save size={16} />{saving === "services" ? "Saving..." : "Save services"}</button> : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeServices.map((service) => {
            const serviceId = String(service._id);
            return <label key={serviceId} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm text-black"><input type="checkbox" className="mt-1 h-4 w-4 accent-amber-400" checked={selectedServices.includes(serviceId)} disabled={!canUpdateServices} onChange={() => toggleService(serviceId)} /><span><strong className="block">{service.name}</strong><small className="text-slate-500">{service.category || "Salon service"}</small></span></label>;
          })}
        </div>
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
        <div className="flex items-center gap-2"><ShieldCheck size={21} /><div><h2 className="text-lg font-bold text-black">Access & special permissions</h2><p className="text-sm text-slate-600">Role permissions are automatic. Super Admin can add employee-specific capabilities without changing the employee's professional profile.</p></div></div>

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
          {EMPLOYEE_PERMISSIONS.map((permission) => <label key={permission.value} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-black"><input type="checkbox" className="h-4 w-4 accent-amber-400" checked={(employee.permissions || []).includes(permission.value)} disabled={!canManagePermissions || Boolean(saving)} onChange={(event) => { const current = employee.permissions || []; const permissions = event.target.checked ? [...current, permission.value] : current.filter((item) => item !== permission.value); void updateSettings({ permissions }, "permissions"); }} /><span>{permission.label}</span></label>)}
        </div>
        {!canManagePermissions ? <p className="mt-4 text-xs text-slate-500">Only the Super Admin can grant or remove employee-specific special permissions.</p> : null}
      </section>
    </main>
  );
}
