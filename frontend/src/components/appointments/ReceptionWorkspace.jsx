import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Scissors,
  UserPlus,
  UsersRound,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import appointmentManagementApi from "../../Services/appointmentManagementApi.js";
import {
  AuthContext,
} from "../../context/AuthContext.jsx";
import {
  hasPermission,
} from "../../utils/permissions.js";

const WalkInDialog = lazy(
  () =>
    import(
      "./WalkInDialog.jsx"
    )
);

const TERMINAL_STATUSES = new Set([
  "completed",
  "cancelled",
  "no_show",
]);

function isoDate(date = new Date()) {
  const copy = new Date(date);
  const offset =
    copy.getTimezoneOffset();
  copy.setMinutes(
    copy.getMinutes() - offset
  );
  return copy
    .toISOString()
    .slice(0, 10);
}

function normaliseStatus(value) {
  return String(value || "pending")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_");
}

function statusLabel(value) {
  return normaliseStatus(value)
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function entityName(entity, fallback) {
  if (!entity || typeof entity !== "object") {
    return fallback;
  }

  return (
    entity.fullName ||
    entity.name ||
    [
      entity.firstName,
      entity.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    fallback
  );
}

function appointmentStart(appointment) {
  if (appointment?.startsAt) {
    return new Date(
      appointment.startsAt
    );
  }

  if (!appointment?.appointmentDate) {
    return null;
  }

  const date = new Date(
    appointment.appointmentDate
  );
  const [
    hours = 0,
    minutes = 0,
  ] = String(
    appointment.appointmentTime ||
      "00:00"
  )
    .split(":")
    .map(Number);

  date.setHours(
    hours,
    minutes,
    0,
    0
  );

  return date;
}

function timeLabel(appointment) {
  const value =
    appointmentStart(
      appointment
    );

  if (
    !value ||
    Number.isNaN(
      value.getTime()
    )
  ) {
    return "Time not set";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(value);
}

function queuedFor(appointment) {
  const raw =
    appointment?.queuedAt ||
    appointment?.createdAt;
  const queuedAt =
    raw
      ? new Date(raw)
      : null;

  if (
    !queuedAt ||
    Number.isNaN(
      queuedAt.getTime()
    )
  ) {
    return "Queued now";
  }

  const minutes = Math.max(
    0,
    Math.floor(
      (Date.now() -
        queuedAt.getTime()) /
        60_000
    )
  );

  if (minutes < 1) {
    return "Queued now";
  }

  if (minutes < 60) {
    return `${minutes} min waiting`;
  }

  const hours =
    Math.floor(minutes / 60);
  const remaining =
    minutes % 60;

  return `${hours}h ${remaining}m waiting`;
}

function errorText(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Reception data could not be loaded."
  );
}

function nextLifecycleAction(status) {
  switch (
    normaliseStatus(status)
  ) {
    case "pending":
    case "confirmed":
      return {
        status: "checked_in",
        label: "Check in",
      };

    case "checked_in":
      return {
        status: "in_progress",
        label: "Start service",
      };

    case "in_progress":
      return {
        status: "completed",
        label: "Complete",
      };

    default:
      return null;
  }
}

function QueueCard({
  appointment,
  canUpdate,
  canCancel,
  busyId,
  onStatus,
}) {
  const lifecycle =
    nextLifecycleAction(
      appointment.status
    );
  const busy =
    busyId === appointment._id;

  return (
    <article className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {appointment.queuePosition ? (
              <span className="rounded-full bg-black px-2.5 py-1 text-xs font-black text-white">
                #{appointment.queuePosition}
              </span>
            ) : null}
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-stone-800">
              {statusLabel(
                appointment.frontDeskState ||
                  appointment.status
              )}
            </span>
          </div>

          <h3 className="mt-3 truncate text-base font-bold text-black">
            {entityName(
              appointment.customer,
              "Unknown customer"
            )}
          </h3>
          <p className="mt-1 text-sm text-stone-700">
            {entityName(
              appointment.service,
              "Service"
            )}
            {" · "}
            {entityName(
              appointment.stylist,
              "Unassigned stylist"
            )}
          </p>
          <p className="mt-1 text-xs font-semibold text-stone-600">
            {appointment.bookingSource ===
            "walk_in"
              ? queuedFor(
                  appointment
                )
              : timeLabel(
                  appointment
                )}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {lifecycle &&
          canUpdate ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onStatus(
                  appointment,
                  lifecycle.status
                )
              }
              className="min-h-11 rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-black hover:bg-amber-300 disabled:opacity-50"
            >
              {busy
                ? "Updating…"
                : lifecycle.label}
            </button>
          ) : null}

          {!TERMINAL_STATUSES.has(
            normaliseStatus(
              appointment.status
            )
          ) && canCancel ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onStatus(
                  appointment,
                  "cancelled"
                )
              }
              className="min-h-11 rounded-xl border border-stone-300 px-4 py-2 text-sm font-bold text-stone-800 hover:border-stone-500 disabled:opacity-50"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}) {
  return (
    <article className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-black">
          <Icon size={18} />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-stone-600">
            {label}
          </p>
          <p className="mt-1 text-2xl font-black text-black">
            {value}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function ReceptionWorkspace({
  onOpenAllAppointments,
}) {
  const { user } =
    useContext(AuthContext) || {};
  const canRead =
    hasPermission(
      user,
      "appointment:read"
    );
  const canCreate =
    hasPermission(
      user,
      "appointment:create"
    );
  const canUpdate =
    hasPermission(
      user,
      "appointment:update"
    );
  const canCancel =
    hasPermission(
      user,
      "appointment:cancel"
    );

  const [
    scheduled,
    setScheduled,
  ] = useState([]);
  const [
    walkIns,
    setWalkIns,
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
    busyId,
    setBusyId,
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
    walkInOpen,
    setWalkInOpen,
  ] = useState(false);

  const today =
    useMemo(
      () => isoDate(),
      []
    );

  const loadReception =
    useCallback(
      async ({ silent = false } = {}) => {
        if (!canRead) {
          setScheduled([]);
          setWalkIns([]);
          setLoading(false);
          return;
        }

        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError("");

        try {
          const [
            calendarResult,
            queueResult,
          ] = await Promise.all([
            appointmentManagementApi.getCalendar(
              {
                startDate: today,
                endDate: today,
                limit: 2000,
              }
            ),
            appointmentManagementApi.getWalkInQueue(
              {
                date: today,
              }
            ),
          ]);

          const allToday =
            Array.isArray(
              calendarResult?.items
            )
              ? calendarResult.items
              : [];

          setScheduled(
            allToday
              .filter(
                (appointment) =>
                  appointment.bookingSource !==
                    "walk_in" &&
                  !TERMINAL_STATUSES.has(
                    normaliseStatus(
                      appointment.status
                    )
                  )
              )
              .sort(
                (left, right) =>
                  (appointmentStart(
                    left
                  )?.getTime() || 0) -
                  (appointmentStart(
                    right
                  )?.getTime() || 0)
              )
          );

          const queue =
            Array.isArray(
              queueResult?.items
            )
              ? queueResult.items
              : Array.isArray(
                    queueResult?.walkIns
                  )
                ? queueResult.walkIns
                : Array.isArray(
                      queueResult
                    )
                  ? queueResult
                  : [];

          setWalkIns(queue);
        } catch (requestError) {
          setError(
            errorText(requestError)
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [canRead, today]
    );

  useEffect(() => {
    void loadReception();
  }, [loadReception]);

  async function updateStatus(
    appointment,
    nextStatus
  ) {
    let reason =
      "Reception workflow update";

    if (
      nextStatus ===
      "cancelled"
    ) {
      reason =
        window.prompt(
          "Enter the cancellation reason:"
        ) || "";

      if (!reason.trim()) {
        return;
      }
    }

    setBusyId(
      appointment._id
    );
    setError("");
    setSuccess("");

    try {
      await appointmentManagementApi.updateStatus(
        appointment._id,
        {
          status:
            nextStatus,
          reason,
          requireReason:
            nextStatus ===
            "cancelled",
        }
      );

      setSuccess(
        `${entityName(
          appointment.customer,
          "Appointment"
        )}: ${statusLabel(
          nextStatus
        )}.`
      );

      await loadReception({
        silent: true,
      });
    } catch (requestError) {
      setError(
        errorText(requestError)
      );
    } finally {
      setBusyId("");
    }
  }

  const checkedIn = [
    ...scheduled,
    ...walkIns,
  ].filter(
    (appointment) =>
      normaliseStatus(
        appointment.status
      ) === "checked_in"
  ).length;

  const inService = [
    ...scheduled,
    ...walkIns,
  ].filter(
    (appointment) =>
      normaliseStatus(
        appointment.status
      ) === "in_progress"
  ).length;

  if (!canRead) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-bold text-black">
          Reception workspace
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          Appointment visibility requires the appointment:read permission.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Today · {today}
            </p>
            <h1 className="mt-2 text-2xl font-black text-black">
              Reception
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">
              Scheduled arrivals and walk-ins share one appointment lifecycle. Check customers in, start services and complete visits without switching applications.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canCreate ? (
              <button
                type="button"
                onClick={() =>
                  setWalkInOpen(true)
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-black hover:bg-amber-300"
              >
                <UserPlus size={17} />
                Add walk-in
              </button>
            ) : null}

            <button
              type="button"
              onClick={() =>
                void loadReception({
                  silent: true,
                })
              }
              disabled={
                loading || refreshing
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-bold text-stone-800 hover:border-stone-500 disabled:opacity-50"
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
              onClick={
                onOpenAllAppointments
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-bold text-stone-800 hover:border-amber-400"
            >
              <CalendarDays size={17} />
              All appointments
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-stone-800"
        >
          {success}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={CalendarDays}
          label="Scheduled arrivals"
          value={scheduled.length}
        />
        <Metric
          icon={UsersRound}
          label="Walk-in queue"
          value={walkIns.length}
        />
        <Metric
          icon={CheckCircle2}
          label="Checked in"
          value={checkedIn}
        />
        <Metric
          icon={Scissors}
          label="In service"
          value={inService}
        />
      </section>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white p-12 text-sm font-bold text-stone-600">
          <LoaderCircle
            size={20}
            className="animate-spin"
          />
          Loading reception…
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-stone-600">
                  First arrived first
                </p>
                <h2 className="mt-1 text-lg font-black text-black">
                  Walk-in queue
                </h2>
              </div>
              <Clock3
                size={20}
                className="text-stone-600"
              />
            </div>

            <div className="mt-4 space-y-3">
              {walkIns.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-600">
                  No active walk-ins are waiting today.
                </div>
              ) : (
                walkIns.map(
                  (appointment) => (
                    <QueueCard
                      key={
                        appointment._id
                      }
                      appointment={
                        appointment
                      }
                      canUpdate={
                        canUpdate
                      }
                      canCancel={
                        canCancel
                      }
                      busyId={
                        busyId
                      }
                      onStatus={
                        updateStatus
                      }
                    />
                  )
                )
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-stone-600">
                  Today
                </p>
                <h2 className="mt-1 text-lg font-black text-black">
                  Scheduled arrivals
                </h2>
              </div>
              <CalendarDays
                size={20}
                className="text-stone-600"
              />
            </div>

            <div className="mt-4 space-y-3">
              {scheduled.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-600">
                  No active scheduled arrivals remain today.
                </div>
              ) : (
                scheduled.map(
                  (appointment) => (
                    <QueueCard
                      key={
                        appointment._id
                      }
                      appointment={
                        appointment
                      }
                      canUpdate={
                        canUpdate
                      }
                      canCancel={
                        canCancel
                      }
                      busyId={
                        busyId
                      }
                      onStatus={
                        updateStatus
                      }
                    />
                  )
                )
              )}
            </div>
          </section>
        </div>
      )}

      {walkInOpen ? (
        <Suspense fallback={null}>
          <WalkInDialog
            open
            onClose={() =>
              setWalkInOpen(false)
            }
            onCreated={async () => {
              setSuccess(
                "Walk-in added to today’s reception queue."
              );
              await loadReception({
                silent: true,
              });
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
