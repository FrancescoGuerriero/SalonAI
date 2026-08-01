import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  Clock3,
  CreditCard,
  Gauge,
  PoundSterling,
  Scissors,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";

function formatCurrency(value) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    }
  ).format(Number(value || 0));
}

function formatTime(value, fallback = "") {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return fallback;
  }

  return date.toLocaleTimeString(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function statusLabel(status) {
  return String(status || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function statusClasses(status) {
  const classes = {
    pending:
      "bg-amber-100 text-amber-800",
    confirmed:
      "bg-blue-100 text-blue-800",
    checked_in:
      "bg-violet-100 text-violet-800",
    in_progress:
      "bg-indigo-100 text-indigo-800",
    completed:
      "bg-emerald-100 text-emerald-800",
    cancelled:
      "bg-slate-100 text-slate-700",
    no_show:
      "bg-red-100 text-red-800",
  };

  return (
    classes[status] ||
    "bg-slate-100 text-slate-700"
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  description,
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={19} />
        </span>
      </div>
    </article>
  );
}

function LoadingCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6">
      <div className="h-5 w-52 rounded bg-slate-200" />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({
          length: 4,
        }).map((_, index) => (
          <div
            key={index}
            className="h-28 rounded-xl bg-slate-100"
          />
        ))}
      </div>
    </div>
  );
}

export default function TodayOperationsPanel({
  data,
  loading,
  error,
  onRefresh,
}) {
  if (loading && !data) {
    return <LoadingCard />;
  }

  const statusCounts =
    data?.statusCounts || {};

  const nextAppointments =
    Array.isArray(
      data?.nextAppointments
    )
      ? data.nextAppointments
      : [];

  const utilisation =
    Number(
      data?.utilisationPercent
    ) || 0;

  const alerts = [
    {
      show:
        Number(
          data?.pendingApprovals
        ) > 0,

      title: `${data?.pendingApprovals} appointment${
        Number(
          data?.pendingApprovals
        ) === 1
          ? ""
          : "s"
      } awaiting approval`,

      description:
        "Review pending appointments before the service time.",

      link: "/appointments",
    },

    {
      show:
        Number(
          data?.overdueAppointments
        ) > 0,

      title: `${data?.overdueAppointments} overdue appointment${
        Number(
          data?.overdueAppointments
        ) === 1
          ? ""
          : "s"
      }`,

      description:
        "Update appointments that have passed their scheduled end time.",

      link: "/appointments",
    },

    {
      show:
        Number(
          data?.outstandingBalance
        ) > 0,

      title: `${formatCurrency(
        data?.outstandingBalance
      )} outstanding`,

      description:
        "Review unpaid and partially paid appointments.",

      link: "/reports",
    },

    {
      show:
        Number(
          data?.staffOnLeave
        ) > 0,

      title: `${data?.staffOnLeave} staff member${
        Number(
          data?.staffOnLeave
        ) === 1
          ? ""
          : "s"
      } on leave`,

      description:
        "Check today's capacity and staff coverage.",

      link: "/staff-management",
    },
  ].filter((alert) => alert.show);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <header className="flex flex-col gap-4 border-b border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            Live operations
          </p>

          <h2 className="mt-1 text-xl font-bold text-slate-900">
            Today&apos;s salon control
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Appointments, staffing,
            capacity and payment status.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Refreshing…"
              : "Refresh"}
          </button>

          <Link
            to="/appointments"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Manage appointments

            <ChevronRight
              size={16}
            />
          </Link>
        </div>
      </header>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={CalendarCheck}
          label="Appointments"
          value={
            data?.appointmentsToday ||
            0
          }
          description={`${statusCounts.completed || 0} completed today`}
        />

        <Metric
          icon={UsersRound}
          label="Active stylists"
          value={
            data?.activeStylists || 0
          }
          description={`${data?.staffOnLeave || 0} currently on leave`}
        />

        <Metric
          icon={Gauge}
          label="Booked capacity"
          value={`${utilisation}%`}
          description={`${data?.bookedMinutes || 0} of ${data?.scheduledMinutes || 0} available minutes`}
        />

        <Metric
          icon={PoundSterling}
          label="Collected"
          value={formatCurrency(
            data?.revenueCollected
          )}
          description={`${formatCurrency(
            data?.outstandingBalance
          )} still outstanding`}
        />
      </div>

      <div className="grid gap-5 border-t border-slate-200 p-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                Next appointments
              </h3>

              <p className="text-xs text-slate-500">
                The next five active
                bookings today.
              </p>
            </div>

            <CalendarClock
              size={20}
              className="text-slate-400"
            />
          </div>

          {nextAppointments.length ===
          0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
              No remaining appointments
              today.
            </div>
          ) : (
            <div className="space-y-2">
              {nextAppointments.map(
                (appointment) => (
                  <Link
                    key={
                      appointment.id
                    }
                    to="/appointments"
                    className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm sm:grid-cols-[80px_1fr_auto]"
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <Clock3
                        size={16}
                        className="text-indigo-500"
                      />

                      {formatTime(
                        appointment.startsAt,
                        appointment.time
                      )}
                    </div>

                    <div>
                      <p className="font-semibold text-slate-900">
                        {
                          appointment.customer
                        }
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {
                          appointment.service
                        }{" "}
                        with{" "}
                        {
                          appointment.stylist
                        }
                      </p>
                    </div>

                    <span
                      className={`h-fit rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses(
                        appointment.status
                      )}`}
                    >
                      {statusLabel(
                        appointment.status
                      )}
                    </span>
                  </Link>
                )
              )}
            </div>
          )}
        </div>

        <aside>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                Action required
              </h3>

              <p className="text-xs text-slate-500">
                Operational items needing
                attention.
              </p>
            </div>

            <AlertTriangle
              size={20}
              className="text-amber-500"
            />
          </div>

          {alerts.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
              <UserRoundCheck
                size={24}
                className="mx-auto text-emerald-600"
              />

              <p className="mt-2 text-sm font-bold text-emerald-800">
                Operations are clear
              </p>

              <p className="mt-1 text-xs text-emerald-700">
                No immediate management
                action is required.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map(
                (alert) => (
                  <Link
                    key={alert.title}
                    to={alert.link}
                    className="block rounded-xl border border-amber-200 bg-amber-50 p-4 hover:border-amber-300"
                  >
                    <p className="text-sm font-bold text-amber-900">
                      {alert.title}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      {
                        alert.description
                      }
                    </p>
                  </Link>
                )
              )}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              to="/staff-management"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Scissors size={15} />
              Staff
            </Link>

            <Link
              to="/reports"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <CreditCard
                size={15}
              />
              Reports
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}