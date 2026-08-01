import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  PoundSterling,
  RefreshCcw,
  Scissors,
  UsersRound,
} from "lucide-react";

import {
  getBookingDemandAnalytics,
} from "../services/bookingDemandService.js";

function formatCurrency(
  value,
  currency = "GBP"
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }
  ).format(
    Number(value) || 0
  );
}

function formatPercentage(value) {
  return `${(
    Number(value) || 0
  ).toFixed(1)}%`;
}

function formatNumber(value) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      maximumFractionDigits: 1,
    }
  ).format(
    Number(value) || 0
  );
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Unable to load booking demand analytics."
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">
            {title}
          </p>

          {loading ? (
            <div className="mt-3 h-9 w-28 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <p className="mt-2 truncate text-3xl font-bold text-slate-900">
              {value}
            </p>
          )}

          <p className="mt-2 text-xs leading-5 text-slate-400">
            {description}
          </p>
        </div>

        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={21} />
        </span>
      </div>
    </article>
  );
}

function DemandBars({
  data,
  labelKey,
  valueKey = "appointments",
}) {
  const maximum =
    Math.max(
      ...data.map(
        (item) =>
          Number(
            item[valueKey]
          ) || 0
      ),
      1
    );

  if (!data.length) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        No demand data is available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map(
        (item) => {
          const value =
            Number(
              item[valueKey]
            ) || 0;

          const width =
            Math.max(
              2,
              (value / maximum) *
                100
            );

          return (
            <div
              key={
                item[labelKey]
              }
            >
              <div className="mb-1.5 flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-slate-700">
                  {item[labelKey]}
                </span>

                <span className="text-sm font-bold text-slate-900">
                  {value}
                </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  style={{
                    width:
                      `${width}%`,
                  }}
                  className="h-full rounded-full bg-indigo-500 transition-all"
                />
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}

function MonthlyDemandChart({
  months,
}) {
  const maximum =
    Math.max(
      ...months.map(
        (month) =>
          Number(
            month.appointments
          ) || 0
      ),
      1
    );

  if (!months.length) {
    return (
      <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
        No monthly booking data is available.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex h-80 min-w-[650px] items-end gap-4 border-b border-slate-200 px-3">
        {months.map(
          (month) => {
            const appointments =
              Number(
                month.appointments
              ) || 0;

            const height =
              appointments > 0
                ? Math.max(
                    5,
                    (
                      appointments /
                      maximum
                    ) * 90
                  )
                : 2;

            return (
              <div
                key={month.month}
                className="flex min-w-16 flex-1 flex-col items-center justify-end"
              >
                <p className="mb-2 text-center text-xs font-bold text-slate-700">
                  {appointments}
                </p>

                <div
                  title={`${month.label}: ${appointments} appointments`}
                  style={{
                    height:
                      `${height}%`,
                  }}
                  className="w-full max-w-16 rounded-t-xl bg-indigo-500 transition-all"
                />

                <p className="mt-2 h-10 text-center text-xs font-medium text-slate-500">
                  {month.label}
                </p>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

function RankingTable({
  title,
  description,
  rows,
  currency,
  icon: Icon,
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Icon size={19} />
          </span>

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {title}
            </h2>

            <p className="text-sm text-slate-500">
              {description}
            </p>
          </div>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">
          No ranking data is available.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map(
            (row, index) => (
              <div
                key={row.id}
                className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 p-4"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                  {index + 1}
                </span>

                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {row.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {row.completedAppointments} completed
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-slate-900">
                    {row.appointments}
                  </p>

                  <p className="mt-1 text-xs text-emerald-700">
                    {formatCurrency(
                      row.earnedRevenue,
                      currency
                    )}
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </article>
  );
}

export default function BookingDemandPage() {
  const [
    months,
    setMonths,
  ] = useState(6);

  const [
    analytics,
    setAnalytics,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const loadAnalytics =
    useCallback(
      async (
        selectedMonths,
        initial = false
      ) => {
        if (initial) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        try {
          const response =
            await getBookingDemandAnalytics({
              months:
                selectedMonths,
            });

          const result =
            response?.analytics ||
            response?.data?.analytics ||
            response;

          setAnalytics(
            result || null
          );
        } catch (
          requestError
        ) {
          setError(
            getErrorMessage(
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
    loadAnalytics(
      6,
      true
    );
  }, [loadAnalytics]);

  const summary =
    analytics?.summary || {};

  const currency =
    analytics?.currency ||
    "GBP";

  const byMonth =
    Array.isArray(
      analytics?.byMonth
    )
      ? analytics.byMonth
      : [];

  const byWeekday =
    Array.isArray(
      analytics?.byWeekday
    )
      ? analytics.byWeekday
      : [];

  const byHour =
    Array.isArray(
      analytics?.byHour
    )
      ? analytics.byHour
      : [];

  const topServices =
    Array.isArray(
      analytics?.topServices
    )
      ? analytics.topServices
      : [];

  const topStylists =
    Array.isArray(
      analytics?.topStylists
    )
      ? analytics.topStylists
      : [];

  const busiestHours =
    useMemo(
      () =>
        [...byHour]
          .sort(
            (first, second) =>
              second.appointments -
              first.appointments
          )
          .slice(0, 10),
      [byHour]
    );

  function handleSubmit(event) {
    event.preventDefault();

    loadAnalytics(
      months
    );
  }

  return (
    <main className="space-y-7 p-6">
      <header className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <CalendarDays size={28} />
            </span>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Booking Demand
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Analyse appointment demand,
                peak days, busiest hours,
                booked service time and popular
                services.
              </p>

              {analytics?.generatedAt && (
                <p className="mt-2 text-xs text-slate-400">
                  Last generated:{" "}
                  {formatDateTime(
                    analytics.generatedAt
                  )}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              loadAnalytics(
                months
              )
            }
            disabled={
              loading ||
              refreshing
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCcw
              size={16}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh report
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle
            size={20}
            className="mt-0.5 shrink-0 text-red-600"
          />

          <p className="text-sm text-red-700">
            {error}
          </p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label>
            <span className="text-sm font-semibold text-slate-700">
              Reporting period
            </span>

            <select
              value={months}
              onChange={(event) =>
                setMonths(
                  Number(
                    event.target.value
                  )
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              <option value={1}>
                Current month
              </option>

              <option value={3}>
                Last 3 months
              </option>

              <option value={6}>
                Last 6 months
              </option>

              <option value={12}>
                Last 12 months
              </option>

              <option value={24}>
                Last 24 months
              </option>
            </select>
          </label>

          <button
            type="submit"
            disabled={
              loading ||
              refreshing
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {refreshing ? (
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
            ) : (
              <BarChart3 size={17} />
            )}

            Generate report
          </button>
        </div>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Appointments"
          value={
            summary.appointmentCount ||
            0
          }
          description="Total bookings during the selected period"
          icon={CalendarDays}
          loading={loading}
        />

        <SummaryCard
          title="Completed"
          value={
            summary.completedAppointments ||
            0
          }
          description="Appointments completed successfully"
          icon={CheckCircle2}
          loading={loading}
        />

        <SummaryCard
          title="Booked hours"
          value={`${formatNumber(
            summary.bookedHours
          )} hrs`}
          description="Service time reserved by bookings"
          icon={Clock3}
          loading={loading}
        />

        <SummaryCard
          title="Revenue"
          value={formatCurrency(
            summary.earnedRevenue,
            currency
          )}
          description="Revenue earned from completed appointments"
          icon={PoundSterling}
          loading={loading}
        />

        <SummaryCard
          title="Completion rate"
          value={formatPercentage(
            summary.completionRate
          )}
          description="Share of bookings completed successfully"
          icon={BarChart3}
          loading={loading}
        />
      </section>

      {loading ? (
        <div className="flex min-h-96 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <LoaderCircle
            size={38}
            className="animate-spin text-indigo-600"
          />
        </div>
      ) : (
        <>
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">
                Peak day
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {summary.peakWeekday
                  ?.weekday ||
                  "No data"}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                {summary.peakWeekday
                  ?.appointments ||
                  0}{" "}
                appointments
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">
                Peak hour
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {summary.peakHour
                  ?.label ||
                  "No data"}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                {summary.peakHour
                  ?.appointments ||
                  0}{" "}
                appointments
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">
                Cancellation rate
              </p>

              <p className="mt-2 text-2xl font-bold text-red-700">
                {formatPercentage(
                  summary.cancellationRate
                )}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                {summary.cancelledAppointments ||
                  0}{" "}
                cancelled bookings
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">
                No-show rate
              </p>

              <p className="mt-2 text-2xl font-bold text-amber-700">
                {formatPercentage(
                  summary.noShowRate
                )}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                {summary.noShowAppointments ||
                  0}{" "}
                missed appointments
              </p>
            </article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Monthly booking demand
            </h2>

            <p className="mb-6 mt-1 text-sm text-slate-500">
              Appointment volume across the selected reporting period.
            </p>

            <MonthlyDemandChart
              months={byMonth}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">
                Demand by weekday
              </h2>

              <p className="mb-6 mt-1 text-sm text-slate-500">
                Total bookings for each day of the week.
              </p>

              <DemandBars
                data={byWeekday}
                labelKey="weekday"
              />
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">
                Busiest booking hours
              </h2>

              <p className="mb-6 mt-1 text-sm text-slate-500">
                Hours ranked by appointment demand.
              </p>

              <DemandBars
                data={busiestHours}
                labelKey="label"
              />
            </article>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <RankingTable
              title="Popular services"
              description="Services ranked by booking volume"
              rows={topServices}
              currency={currency}
              icon={Scissors}
            />

            <RankingTable
              title="Busiest staff"
              description="Staff ranked by assigned bookings"
              rows={topStylists}
              currency={currency}
              icon={UsersRound}
            />
          </section>
        </>
      )}
    </main>
  );
}