import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Ban,
  BarChart3,
  CalendarDays,
  Clock3,
  LoaderCircle,
  PoundSterling,
  RefreshCcw,
  Scissors,
  UserRound,
  UsersRound,
} from "lucide-react";

import {
  getBookingLossAnalytics,
} from "../services/bookingLossService.js";

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
    "Unable to load cancellation analytics."
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

        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <Icon size={21} />
        </span>
      </div>
    </article>
  );
}

function MonthlyLossChart({
  data,
  currency,
}) {
  const maximum =
    Math.max(
      ...data.map(
        (month) =>
          Number(
            month.lostAppointments
          ) || 0
      ),
      1
    );

  if (!data.length) {
    return (
      <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
        No monthly cancellation data is available.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex h-80 min-w-[680px] items-end gap-4 border-b border-slate-200 px-3">
        {data.map(
          (month) => {
            const lostAppointments =
              Number(
                month.lostAppointments
              ) || 0;

            const height =
              lostAppointments > 0
                ? Math.max(
                    5,
                    (
                      lostAppointments /
                      maximum
                    ) * 90
                  )
                : 2;

            return (
              <div
                key={month.month}
                className="flex min-w-16 flex-1 flex-col items-center justify-end"
              >
                <p className="mb-1 text-xs font-bold text-slate-700">
                  {lostAppointments}
                </p>

                <p className="mb-2 text-[10px] font-medium text-red-600">
                  {formatCurrency(
                    month.estimatedLostRevenue,
                    currency
                  )}
                </p>

                <div
                  title={`${month.label}: ${lostAppointments} lost bookings`}
                  style={{
                    height:
                      `${height}%`,
                  }}
                  className="w-full max-w-16 rounded-t-xl bg-red-500 transition-all"
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

function RiskBars({
  data,
  labelKey,
}) {
  const maximum =
    Math.max(
      ...data.map(
        (item) =>
          Number(
            item.lostAppointments
          ) || 0
      ),
      1
    );

  if (!data.length) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        No loss data is available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map(
        (item) => {
          const value =
            Number(
              item.lostAppointments
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
                  className="h-full rounded-full bg-red-500 transition-all"
                />
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}

function AffectedRanking({
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
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
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
          No affected records are available.
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
                    {row.cancelledAppointments} cancelled ·{" "}
                    {row.noShowAppointments} no-show
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-red-700">
                    {row.lostAppointments}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {formatCurrency(
                      row.estimatedLostRevenue,
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

export default function BookingLossPage() {
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
            await getBookingLossAnalytics({
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

  const affectedServices =
    Array.isArray(
      analytics?.affectedServices
    )
      ? analytics.affectedServices
      : [];

  const affectedStylists =
    Array.isArray(
      analytics?.affectedStylists
    )
      ? analytics.affectedStylists
      : [];

  const repeatCustomers =
    Array.isArray(
      analytics?.repeatCustomers
    )
      ? analytics.repeatCustomers
      : [];

  const busiestRiskHours =
    useMemo(
      () =>
        [...byHour]
          .sort(
            (first, second) =>
              second.lostAppointments -
              first.lostAppointments
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
      <header className="rounded-2xl border border-red-100 bg-gradient-to-r from-red-50 via-white to-amber-50 p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-sm">
              <Ban size={28} />
            </span>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Booking Loss Analytics
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Analyse cancellations, no-shows,
                estimated lost revenue and recurring
                customer booking risks.
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
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-500"
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
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
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
          title="Lost bookings"
          value={
            summary.lostAppointments ||
            0
          }
          description="Cancelled and missed appointments"
          icon={Ban}
          loading={loading}
        />

        <SummaryCard
          title="Cancellations"
          value={
            summary.cancelledAppointments ||
            0
          }
          description="Bookings cancelled during this period"
          icon={CalendarDays}
          loading={loading}
        />

        <SummaryCard
          title="No-shows"
          value={
            summary.noShowAppointments ||
            0
          }
          description="Customers who missed their appointment"
          icon={UserRound}
          loading={loading}
        />

        <SummaryCard
          title="Estimated loss"
          value={formatCurrency(
            summary.estimatedLostRevenue,
            currency
          )}
          description="Potential revenue not recovered"
          icon={PoundSterling}
          loading={loading}
        />

        <SummaryCard
          title="Total loss rate"
          value={formatPercentage(
            summary.totalLossRate
          )}
          description="Lost bookings as a share of all appointments"
          icon={BarChart3}
          loading={loading}
        />
      </section>

      {loading ? (
        <div className="flex min-h-96 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <LoaderCircle
            size={38}
            className="animate-spin text-red-600"
          />
        </div>
      ) : (
        <>
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
                Share of all appointments cancelled
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
                Share of all appointments missed
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">
                Peak risk day
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {summary.peakRiskDay
                  ?.label ||
                  "No data"}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                {summary.peakRiskDay
                  ?.lostAppointments ||
                  0}{" "}
                lost bookings
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">
                Peak risk hour
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {summary.peakRiskHour
                  ?.label ||
                  "No data"}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                {summary.peakRiskHour
                  ?.lostAppointments ||
                  0}{" "}
                lost bookings
              </p>
            </article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Monthly booking losses
            </h2>

            <p className="mb-6 mt-1 text-sm text-slate-500">
              Cancelled and missed appointments across the reporting period.
            </p>

            <MonthlyLossChart
              data={byMonth}
              currency={currency}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">
                Risk by weekday
              </h2>

              <p className="mb-6 mt-1 text-sm text-slate-500">
                Weekdays ranked by lost bookings.
              </p>

              <RiskBars
                data={byWeekday}
                labelKey="weekday"
              />
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">
                High-risk booking hours
              </h2>

              <p className="mb-6 mt-1 text-sm text-slate-500">
                Appointment times with the highest losses.
              </p>

              <RiskBars
                data={busiestRiskHours}
                labelKey="label"
              />
            </article>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <AffectedRanking
              title="Affected services"
              description="Services losing the most bookings"
              rows={affectedServices}
              currency={currency}
              icon={Scissors}
            />

            <AffectedRanking
              title="Affected staff"
              description="Staff schedules most affected by booking loss"
              rows={affectedStylists}
              currency={currency}
              icon={UsersRound}
            />
          </section>

          <AffectedRanking
            title="Repeat booking risks"
            description="Customers with repeated cancellations or no-shows"
            rows={repeatCustomers}
            currency={currency}
            icon={UserRound}
          />
        </>
      )}
    </main>
  );
}