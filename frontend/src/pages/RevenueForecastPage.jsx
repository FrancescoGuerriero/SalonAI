
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
  Gauge,
  LoaderCircle,
  PoundSterling,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  getRevenueForecast,
} from "../services/revenueForecastService.js";

import RevenueForecastSnapshotsPanel from "../components/revenue/RevenueForecastSnapshotsPanel.jsx";

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
    "Unable to load the revenue forecast."
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
        <div>
          <p className="text-sm font-semibold text-slate-500">
            {title}
          </p>

          {loading ? (
            <div className="mt-3 h-9 w-28 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-slate-900">
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

function RevenueChart({
  historicalRevenue,
  forecastRevenue,
  currency,
}) {
  const chartData =
    useMemo(
      () => [
        ...historicalRevenue.map(
          (item) => ({
            label:
              item.label,

            value:
              Number(
                item.earnedRevenue
              ) || 0,

            type:
              "historical",
          })
        ),

        ...forecastRevenue.map(
          (item) => ({
            label:
              item.label,

            value:
              Number(
                item.expectedRevenue
              ) || 0,

            type:
              "forecast",
          })
        ),
      ],
      [
        historicalRevenue,
        forecastRevenue,
      ]
    );

  const maximum =
    Math.max(
      ...chartData.map(
        (item) =>
          item.value
      ),
      1
    );

  if (!chartData.length) {
    return (
      <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
        No revenue data is available.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-5 text-xs font-semibold text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-indigo-500" />
          Historical revenue
        </span>

        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-emerald-500" />
          Forecast revenue
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex h-80 min-w-[800px] items-end gap-3 border-b border-slate-200 px-2">
          {chartData.map(
            (
              item,
              index
            ) => {
              const height =
                item.value > 0
                  ? Math.max(
                      5,
                      (item.value /
                        maximum) *
                        92
                    )
                  : 2;

              return (
                <div
                  key={`${item.type}-${item.label}-${index}`}
                  className="flex min-w-14 flex-1 flex-col items-center justify-end"
                >
                  <p className="mb-2 text-center text-[11px] font-semibold text-slate-600">
                    {formatCurrency(
                      item.value,
                      currency
                    )}
                  </p>

                  <div
                    title={`${item.label}: ${formatCurrency(
                      item.value,
                      currency
                    )}`}
                    style={{
                      height:
                        `${height}%`,
                    }}
                    className={[
                      "w-full max-w-14 rounded-t-lg transition-all",
                      item.type ===
                      "historical"
                        ? "bg-indigo-500"
                        : "bg-emerald-500",
                    ].join(" ")}
                  />

                  <p className="mt-2 h-10 text-center text-[11px] font-medium text-slate-500">
                    {item.label}
                  </p>
                </div>
              );
            }
          )}
        </div>
      </div>
    </div>
  );
}

export default function RevenueForecastPage() {
  const [
    historyMonths,
    setHistoryMonths,
  ] = useState(12);

  const [
    forecastMonths,
    setForecastMonths,
  ] = useState(6);

  const [
    forecast,
    setForecast,
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

  const loadForecast =
    useCallback(
      async ({
        initial = false,
      } = {}) => {
        if (initial) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        try {
          const response =
            await getRevenueForecast({
              months:
                historyMonths,

              forecastMonths,
            });

          const result =
            response?.forecast ||
            response?.data?.forecast ||
            response;

          setForecast(
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
      [
        historyMonths,
        forecastMonths,
      ]
    );

  useEffect(() => {
    loadForecast({
      initial: true,
    });
  }, [loadForecast]);

  const summary =
    forecast?.summary || {};

  const methodology =
    forecast?.methodology || {};

  const insights =
    forecast?.insights || {};

  const historicalRevenue =
    forecast?.historicalRevenue || [];

  const forecastRevenue =
    forecast?.forecastRevenue || [];

  const currency =
    forecast?.currency || "GBP";

  const growthRate =
    Number(
      summary.growthRate
    ) || 0;

  const projectedDirection =
    insights.projectedDirection ||
    "stable";

  function handleSubmit(event) {
    event.preventDefault();

    loadForecast();
  }

  function handleLoadSnapshot(snapshot) {
    setForecast(snapshot);

    const snapshotHistoryMonths =
      Number(
        snapshot?.parameters
          ?.historyMonths
      );

    const snapshotForecastMonths =
      Number(
        snapshot?.parameters
          ?.forecastMonths
      );

    if (
      Number.isFinite(
        snapshotHistoryMonths
      )
    ) {
      setHistoryMonths(
        snapshotHistoryMonths
      );
    }

    if (
      Number.isFinite(
        snapshotForecastMonths
      )
    ) {
      setForecastMonths(
        snapshotForecastMonths
      );
    }
  }

  return (
    <main className="space-y-7 p-6">
      <header className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <BarChart3 size={28} />
            </span>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Revenue Forecasting
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Analyse completed appointment revenue,
                current bookings and historical salon
                performance to estimate future monthly
                revenue.
              </p>

              {forecast?.generatedAt && (
                <p className="mt-2 text-xs text-slate-400">
                  Last generated:{" "}
                  {formatDateTime(
                    forecast.generatedAt
                  )}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              loadForecast()
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

            Refresh forecast
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
        onSubmit={
          handleSubmit
        }
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-3 md:items-end">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Historical period
            </span>

            <select
              value={
                historyMonths
              }
              onChange={(event) =>
                setHistoryMonths(
                  Number(
                    event.target.value
                  )
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              <option value={3}>
                Last 3 months
              </option>

              <option value={6}>
                Last 6 months
              </option>

              <option value={12}>
                Last 12 months
              </option>

              <option value={18}>
                Last 18 months
              </option>

              <option value={24}>
                Last 24 months
              </option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Forecast period
            </span>

            <select
              value={
                forecastMonths
              }
              onChange={(event) =>
                setForecastMonths(
                  Number(
                    event.target.value
                  )
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              <option value={1}>
                Next month
              </option>

              <option value={3}>
                Next 3 months
              </option>

              <option value={6}>
                Next 6 months
              </option>

              <option value={9}>
                Next 9 months
              </option>

              <option value={12}>
                Next 12 months
              </option>
            </select>
          </label>

          <button
            type="submit"
            disabled={
              loading ||
              refreshing
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {refreshing ? (
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
            ) : (
              <BarChart3
                size={17}
              />
            )}

            Generate forecast
          </button>
        </div>
      </form>

      <RevenueForecastSnapshotsPanel
        forecast={forecast}
        historyMonths={historyMonths}
        forecastMonths={forecastMonths}
        onLoadSnapshot={handleLoadSnapshot}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Historical revenue"
          value={formatCurrency(
            summary.historicalTotal,
            currency
          )}
          description="Completed appointments in the selected historical period"
          icon={PoundSterling}
          loading={loading}
        />

        <SummaryCard
          title="Monthly average"
          value={formatCurrency(
            summary.historicalAverage,
            currency
          )}
          description="Average historical earned revenue per month"
          icon={CalendarDays}
          loading={loading}
        />

        <SummaryCard
          title="Future bookings"
          value={formatCurrency(
            summary.bookedTotal,
            currency
          )}
          description="Value currently booked in the forecast period"
          icon={CheckCircle2}
          loading={loading}
        />

        <SummaryCard
          title="Expected revenue"
          value={formatCurrency(
            summary.forecastTotal,
            currency
          )}
          description="Total expected revenue across the forecast period"
          icon={TrendingUp}
          loading={loading}
        />

        <SummaryCard
          title="Forecast confidence"
          value={formatPercentage(
            summary.confidence
          )}
          description="Confidence based on data coverage and volatility"
          icon={Gauge}
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
      ) : forecast ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Monthly revenue trend
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Historical earned revenue compared
                  with expected future revenue.
                </p>
              </div>

              <div
                className={[
                  "inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-sm font-semibold",
                  projectedDirection ===
                  "growing"
                    ? "bg-emerald-50 text-emerald-700"
                    : projectedDirection ===
                        "declining"
                      ? "bg-red-50 text-red-700"
                      : "bg-slate-100 text-slate-700",
                ].join(" ")}
              >
                {projectedDirection ===
                "declining" ? (
                  <TrendingDown
                    size={16}
                  />
                ) : (
                  <TrendingUp
                    size={16}
                  />
                )}

                {projectedDirection
                  .charAt(0)
                  .toUpperCase() +
                  projectedDirection.slice(
                    1
                  )}

                {growthRate !== 0 && (
                  <span>
                    {growthRate > 0
                      ? "+"
                      : ""}
                    {formatPercentage(
                      growthRate
                    )}
                  </span>
                )}
              </div>
            </div>

            <RevenueChart
              historicalRevenue={
                historicalRevenue
              }
              forecastRevenue={
                forecastRevenue
              }
              currency={
                currency
              }
            />
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-xl font-bold text-slate-900">
                Forecast breakdown
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Booked, modelled and expected revenue
                for each forecast month.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Month",
                      "Bookings",
                      "Booked value",
                      "Model forecast",
                      "Expected revenue",
                      "Potential revenue",
                    ].map(
                      (heading) => (
                        <th
                          key={heading}
                          className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500"
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {forecastRevenue.map(
                    (month) => (
                      <tr
                        key={
                          month.month
                        }
                        className="hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {month.label}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {month.bookedAppointments ||
                            0}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatCurrency(
                            month.bookedRevenue,
                            currency
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatCurrency(
                            month.modelForecast,
                            currency
                          )}
                        </td>

                        <td className="px-5 py-4 font-semibold text-emerald-700">
                          {formatCurrency(
                            month.expectedRevenue,
                            currency
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatCurrency(
                            month.potentialRevenue,
                            currency
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Forecast insights
              </h2>

              <dl className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">
                    Completion rate
                  </dt>

                  <dd className="font-semibold text-slate-900">
                    {formatPercentage(
                      summary.completionRate
                    )}
                  </dd>
                </div>

                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">
                    Current month expected
                  </dt>

                  <dd className="font-semibold text-slate-900">
                    {formatCurrency(
                      summary.currentMonthExpected,
                      currency
                    )}
                  </dd>
                </div>

                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">
                    Outstanding historical revenue
                  </dt>

                  <dd className="font-semibold text-amber-700">
                    {formatCurrency(
                      summary.outstandingTotal,
                      currency
                    )}
                  </dd>
                </div>

                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">
                    Best historical month
                  </dt>

                  <dd className="text-right font-semibold text-slate-900">
                    {insights.bestHistoricalMonth
                      ? `${insights.bestHistoricalMonth.label} â€” ${formatCurrency(
                          insights.bestHistoricalMonth.revenue,
                          currency
                        )}`
                      : "No completed revenue"}
                  </dd>
                </div>

                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">
                    Monthly trend
                  </dt>

                  <dd className="font-semibold text-slate-900">
                    {formatCurrency(
                      insights.monthlyTrend,
                      currency
                    )}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Forecast methodology
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                {methodology.description ||
                  "Revenue is forecast from historical performance and current bookings."}
              </p>

              <p className="mt-3 text-sm font-semibold text-indigo-700">
                {methodology.name ||
                  "Revenue forecasting model"}
              </p>

              <ul className="mt-5 space-y-3">
                {(
                  methodology.assumptions ||
                  []
                ).map(
                  (assumption) => (
                    <li
                      key={
                        assumption
                      }
                      className="flex items-start gap-2 text-sm leading-6 text-slate-600"
                    >
                      <CheckCircle2
                        size={16}
                        className="mt-1 shrink-0 text-emerald-600"
                      />

                      {assumption}
                    </li>
                  )
                )}
              </ul>
            </article>
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <BarChart3
            size={46}
            className="mx-auto text-slate-300"
          />

          <h2 className="mt-4 text-lg font-semibold text-slate-800">
            No forecast available
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Generate a forecast to analyse expected
            salon revenue.
          </p>
        </div>
      )}
    </main>
  );
}


