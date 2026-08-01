import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgePoundSterling,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  Package,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import {
  getAiSalesForecast,
} from "../Services/aiSalesForecastingService.js";


const DEFAULT_FILTERS = {
  lookbackDays: 365,
  horizonDays: 90,
  minimumHistoryDays: 90,
  recentWindowDays: 30,
  baselineWindowDays: 180,
  confidenceLevel: 0.9,
  weekdaySeasonalityWeight: 0.55,
  recentTrendWeight: 0.45,
  scenarioAdjustment: 0,

  businessDays: [
    0,
    1,
    2,
    3,
    4,
    5,
  ],

  includeProfitForecast: true,
  includeCategoryForecast: true,
};


const DAY_OPTIONS = [
  {
    value: 0,
    label: "Monday",
  },
  {
    value: 1,
    label: "Tuesday",
  },
  {
    value: 2,
    label: "Wednesday",
  },
  {
    value: 3,
    label: "Thursday",
  },
  {
    value: 4,
    label: "Friday",
  },
  {
    value: 5,
    label: "Saturday",
  },
  {
    value: 6,
    label: "Sunday",
  },
];


const CHANNEL_LABELS = {
  services: "Services",
  retail: "Retail",
  memberships: "Memberships",
  gift_cards: "Gift cards",
  other: "Other",
};


const CHANNEL_ICONS = {
  services: Sparkles,
  retail: ShoppingBag,
  memberships: WalletCards,
  gift_cards: BadgePoundSterling,
  other: CircleDollarSign,
};


function currency(
  value,
  {
    maximumFractionDigits = 0,
  } = {}
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits,
    }
  ).format(
    Number(value) || 0
  );
}


function number(
  value,
  maximumFractionDigits = 0
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      maximumFractionDigits,
    }
  ).format(
    Number(value) || 0
  );
}


function percentage(
  value,
  maximumFractionDigits = 1
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "percent",
      maximumFractionDigits,
    }
  ).format(
    Number(value) || 0
  );
}


function formatDate(value) {
  if (!value) {
    return "—";
  }

  const parsed =
    new Date(
      `${value}T12:00:00`
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(parsed);
}


function trendLabel(value) {
  if (value === "rising") {
    return "Rising";
  }

  if (value === "falling") {
    return "Falling";
  }

  return "Stable";
}


function riskLabel(value) {
  if (value === "high") {
    return "High risk";
  }

  if (value === "medium") {
    return "Medium risk";
  }

  if (value === "low") {
    return "Low sales";
  }

  if (value === "balanced") {
    return "Balanced";
  }

  return "Unknown";
}


function normaliseResponse(
  response
) {
  return {
    forecast:
      response?.forecast ||
      null,

    source:
      response?.source ||
      null,

    message:
      response?.message ||
      "",
  };
}


function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  trend,
}) {
  const rising =
    Number(trend) > 0;

  const falling =
    Number(trend) < 0;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>

        <div className="rounded-xl bg-violet-50 p-3 text-violet-700">
          <Icon
            aria-hidden="true"
            size={21}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
        {trend !== undefined &&
        trend !== null ? (
          <>
            {rising ? (
              <ArrowUpRight
                className="text-emerald-600"
                size={17}
              />
            ) : falling ? (
              <ArrowDownRight
                className="text-rose-600"
                size={17}
              />
            ) : (
              <BarChart3
                className="text-slate-500"
                size={17}
              />
            )}

            <span
              className={
                rising
                  ? "font-semibold text-emerald-700"
                  : falling
                    ? "font-semibold text-rose-700"
                    : "font-semibold text-slate-600"
              }
            >
              {percentage(trend)}
            </span>
          </>
        ) : null}

        <span>
          {helper}
        </span>
      </div>
    </article>
  );
}


function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <BarChart3
        className="mx-auto text-slate-400"
        size={42}
      />

      <h2 className="mt-4 text-lg font-semibold text-slate-900">
        No sales forecast available
      </h2>

      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
        Generate a forecast to analyse expected service revenue,
        retail sales, memberships, gift cards, refunds and gross
        profit.
      </p>
    </div>
  );
}


function LoadingState() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <Loader2
        className="mx-auto animate-spin text-violet-700"
        size={42}
      />

      <h2 className="mt-4 text-lg font-semibold text-slate-900">
        Generating AI sales forecast
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        Analysing historical sales, weekday patterns, channel mix and
        recent trends.
      </p>
    </div>
  );
}


export default function AiSalesForecastingPage() {
  const [
    filters,
    setFilters,
  ] = useState(
    DEFAULT_FILTERS
  );

  const [
    result,
    setResult,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    showFilters,
    setShowFilters,
  ] = useState(false);


  const loadForecast =
    useCallback(
      async (
        selectedFilters =
          filters
      ) => {
        setLoading(true);
        setError("");

        try {
          const response =
            await getAiSalesForecast(
              selectedFilters
            );

          setResult(
            normaliseResponse(
              response
            )
          );
        } catch (requestError) {
          setError(
            requestError?.message ||
              "Unable to generate the AI sales forecast."
          );
        } finally {
          setLoading(false);
        }
      },
      [filters]
    );


  useEffect(
    () => {
      loadForecast(
        DEFAULT_FILTERS
      );
    },
    []
  );


  const forecast =
    result?.forecast ||
    null;

  const summary =
    forecast?.summary ||
    null;

  const dailyForecasts =
    forecast?.forecasts ||
    [];

  const monthlyForecasts =
    forecast?.monthly_forecasts ||
    [];

  const source =
    result?.source ||
    null;


  const channelTotals =
    useMemo(
      () => [
        {
          channel: "services",

          value:
            summary
              ?.total_predicted_service_sales ||
            0,
        },

        {
          channel: "retail",

          value:
            summary
              ?.total_predicted_retail_sales ||
            0,
        },

        {
          channel: "memberships",

          value:
            summary
              ?.total_predicted_membership_sales ||
            0,
        },

        {
          channel: "gift_cards",

          value:
            summary
              ?.total_predicted_gift_card_sales ||
            0,
        },

        {
          channel: "other",

          value:
            summary
              ?.total_predicted_other_sales ||
            0,
        },
      ].filter(
        (item) =>
          item.value > 0
      ),
      [summary]
    );


  const strongestDays =
    useMemo(
      () =>
        [
          ...dailyForecasts,
        ]
          .filter(
            (item) =>
              item.is_business_day
          )
          .sort(
            (
              left,
              right
            ) =>
              right
                .predicted_net_sales -
              left
                .predicted_net_sales
          )
          .slice(
            0,
            8
          ),
      [dailyForecasts]
    );


  function updateFilter(
    field,
    value
  ) {
    setFilters(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }


  function toggleBusinessDay(
    day
  ) {
    setFilters(
      (current) => {
        const selected =
          current
            .businessDays
            .includes(day);

        const nextDays =
          selected
            ? current
                .businessDays
                .filter(
                  (item) =>
                    item !== day
                )
            : [
                ...current
                  .businessDays,

                day,
              ].sort(
                (
                  left,
                  right
                ) =>
                  left - right
              );

        return {
          ...current,

          businessDays:
            nextDays.length > 0
              ? nextDays
              : current
                  .businessDays,
        };
      }
    );
  }


  function resetFilters() {
    setFilters(
      DEFAULT_FILTERS
    );

    loadForecast(
      DEFAULT_FILTERS
    );
  }


  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
                <Sparkles
                  size={18}
                />

                <span>
                  SalonAI Intelligence
                </span>
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                AI Sales Forecasting
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Forecast service revenue, retail sales, memberships,
                gift cards, refunds, transactions and gross profit
                using historical SalonAI data.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowFilters(
                    (current) =>
                      !current
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <CalendarDays
                  size={18}
                />

                Forecast settings
              </button>

              <button
                type="button"
                onClick={() =>
                  loadForecast()
                }
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                  size={18}
                />

                Refresh forecast
              </button>
            </div>
          </div>

          {source ? (
            <div className="mt-6 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  History
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {number(
                    source.historyDays
                  )} days
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Appointments
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {number(
                    source.appointmentRecords
                  )} records
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Orders
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {number(
                    source.orderRecords
                  )} records
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Privacy
                </p>

                <p className="mt-1 flex items-center gap-2 font-semibold text-slate-900">
                  <CheckCircle2
                    className="text-emerald-600"
                    size={17}
                  />

                  Aggregate data only
                </p>
              </div>
            </div>
          ) : null}
        </section>


        {showFilters ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Forecast settings
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Adjust the historical window, forecast horizon and
                  scenario assumptions.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  resetFilters
                }
                className="text-sm font-semibold text-violet-700 hover:text-violet-900"
              >
                Reset defaults
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Lookback days
                </span>

                <input
                  type="number"
                  min="90"
                  max="730"
                  value={
                    filters
                      .lookbackDays
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "lookbackDays",
                      Number(
                        event
                          .target
                          .value
                      )
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Forecast horizon
                </span>

                <input
                  type="number"
                  min="7"
                  max="365"
                  value={
                    filters
                      .horizonDays
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "horizonDays",
                      Number(
                        event
                          .target
                          .value
                      )
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Recent window
                </span>

                <input
                  type="number"
                  min="7"
                  max="180"
                  value={
                    filters
                      .recentWindowDays
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "recentWindowDays",
                      Number(
                        event
                          .target
                          .value
                      )
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Baseline window
                </span>

                <input
                  type="number"
                  min="28"
                  max="730"
                  value={
                    filters
                      .baselineWindowDays
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "baselineWindowDays",
                      Number(
                        event
                          .target
                          .value
                      )
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Scenario adjustment
                </span>

                <select
                  value={
                    filters
                      .scenarioAdjustment
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "scenarioAdjustment",
                      Number(
                        event
                          .target
                          .value
                      )
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                >
                  <option value="-0.2">
                    Downside −20%
                  </option>

                  <option value="-0.1">
                    Downside −10%
                  </option>

                  <option value="0">
                    Baseline
                  </option>

                  <option value="0.1">
                    Upside +10%
                  </option>

                  <option value="0.2">
                    Upside +20%
                  </option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Confidence level
                </span>

                <select
                  value={
                    filters
                      .confidenceLevel
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "confidenceLevel",
                      Number(
                        event
                          .target
                          .value
                      )
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                >
                  <option value="0.8">
                    80%
                  </option>

                  <option value="0.9">
                    90%
                  </option>

                  <option value="0.95">
                    95%
                  </option>
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={
                    filters
                      .includeProfitForecast
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "includeProfitForecast",
                      event
                        .target
                        .checked
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 text-violet-700 focus:ring-violet-500"
                />

                <span className="text-sm font-medium text-slate-700">
                  Include profit forecast
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={
                    filters
                      .includeCategoryForecast
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "includeCategoryForecast",
                      event
                        .target
                        .checked
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 text-violet-700 focus:ring-violet-500"
                />

                <span className="text-sm font-medium text-slate-700">
                  Include category forecast
                </span>
              </label>
            </div>

            <div className="mt-5">
              <p className="text-sm font-medium text-slate-700">
                Salon business days
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {DAY_OPTIONS.map(
                  (day) => {
                    const selected =
                      filters
                        .businessDays
                        .includes(
                          day.value
                        );

                    return (
                      <button
                        key={
                          day.value
                        }
                        type="button"
                        onClick={() =>
                          toggleBusinessDay(
                            day.value
                          )
                        }
                        className={
                          selected
                            ? "rounded-full bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white"
                            : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        }
                      >
                        {day.label}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  loadForecast()
                }
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2
                    className="animate-spin"
                    size={18}
                  />
                ) : (
                  <Sparkles
                    size={18}
                  />
                )}

                Generate forecast
              </button>
            </div>
          </section>
        ) : null}


        {error ? (
          <section className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 shrink-0 text-rose-700"
                size={21}
              />

              <div>
                <h2 className="font-semibold text-rose-900">
                  Forecast unavailable
                </h2>

                <p className="mt-1 text-sm text-rose-700">
                  {error}
                </p>
              </div>
            </div>
          </section>
        ) : null}


        <div className="mt-6">
          {loading ? (
            <LoadingState />
          ) : !forecast ||
            !summary ? (
            <EmptyState />
          ) : (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Forecast net sales"
                  value={currency(
                    summary
                      .total_predicted_net_sales
                  )}
                  helper="for the selected horizon"
                  icon={
                    CircleDollarSign
                  }
                  trend={
                    summary
                      .expected_growth_rate
                  }
                />

                <MetricCard
                  title="Gross profit"
                  value={currency(
                    summary
                      .total_predicted_gross_profit
                  )}
                  helper={`${percentage(
                    summary
                      .predicted_gross_margin
                  )} margin`}
                  icon={
                    TrendingUp
                  }
                />

                <MetricCard
                  title="Transactions"
                  value={number(
                    summary
                      .total_predicted_transactions
                  )}
                  helper={`${currency(
                    summary
                      .average_transaction_value
                  )} average value`}
                  icon={
                    ShoppingBag
                  }
                />

                <MetricCard
                  title="Collected sales"
                  value={currency(
                    summary
                      .total_predicted_collected_sales
                  )}
                  helper="expected cash collection"
                  icon={
                    WalletCards
                  }
                />
              </section>


              <section className="mt-6 grid gap-6 lg:grid-cols-3">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        Strongest forecast days
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Highest expected net sales across the forecast
                        period.
                      </p>
                    </div>

                    <TrendingUp className="text-emerald-600" />
                  </div>

                  <div className="mt-5 space-y-4">
                    {strongestDays.map(
                      (item) => {
                        const maximum =
                          strongestDays[0]
                            ?.predicted_net_sales ||
                          1;

                        const width =
                          Math.max(
                            4,

                            (
                              item
                                .predicted_net_sales /
                              maximum
                            ) *
                              100
                          );

                        return (
                          <div
                            key={
                              item
                                .forecast_date
                            }
                          >
                            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                              <div>
                                <span className="font-semibold text-slate-800">
                                  {
                                    item.day_name
                                  }
                                </span>

                                <span className="ml-2 text-slate-500">
                                  {formatDate(
                                    item
                                      .forecast_date
                                  )}
                                </span>
                              </div>

                              <span className="font-semibold text-slate-900">
                                {currency(
                                  item
                                    .predicted_net_sales
                                )}
                              </span>
                            </div>

                            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-violet-600"
                                style={{
                                  width:
                                    `${width}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </article>


                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        Sales channel mix
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Forecast contribution by channel.
                      </p>
                    </div>

                    <Package className="text-violet-700" />
                  </div>

                  <div className="mt-5 space-y-4">
                    {channelTotals.map(
                      (item) => {
                        const Icon =
                          CHANNEL_ICONS[
                            item.channel
                          ] ||
                          CircleDollarSign;

                        const share =
                          summary
                            .total_predicted_net_sales >
                          0
                            ? item.value /
                              summary
                                .total_predicted_net_sales
                            : 0;

                        return (
                          <div
                            key={
                              item.channel
                            }
                            className="rounded-xl border border-slate-100 p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-violet-50 p-2 text-violet-700">
                                  <Icon
                                    size={17}
                                  />
                                </div>

                                <div>
                                  <p className="text-sm font-semibold text-slate-800">
                                    {
                                      CHANNEL_LABELS[
                                        item
                                          .channel
                                      ]
                                    }
                                  </p>

                                  <p className="text-xs text-slate-500">
                                    {percentage(
                                      share
                                    )}{" "}
                                    of sales
                                  </p>
                                </div>
                              </div>

                              <p className="text-sm font-bold text-slate-900">
                                {currency(
                                  item.value
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </article>
              </section>


              <section className="mt-6 grid gap-6 lg:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">
                    AI insights
                  </h2>

                  <div className="mt-4 space-y-3">
                    {[
                      ...(
                        summary
                          .channel_insights ||
                        []
                      ),

                      ...(
                        summary
                          .category_insights ||
                        []
                      ),
                    ].length > 0 ? (
                      [
                        ...(
                          summary
                            .channel_insights ||
                          []
                        ),

                        ...(
                          summary
                            .category_insights ||
                          []
                        ),
                      ].map(
                        (
                          insight,
                          index
                        ) => (
                          <div
                            key={`${insight}-${index}`}
                            className="flex gap-3 rounded-xl bg-violet-50 p-4"
                          >
                            <Sparkles
                              className="mt-0.5 shrink-0 text-violet-700"
                              size={18}
                            />

                            <p className="text-sm leading-6 text-violet-950">
                              {insight}
                            </p>
                          </div>
                        )
                      )
                    ) : (
                      <p className="text-sm text-slate-500">
                        No channel or category insights were generated.
                      </p>
                    )}
                  </div>
                </article>


                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Risks and data quality
                  </h2>

                  <div className="mt-4 space-y-3">
                    {(
                      summary
                        .risk_alerts ||
                      []
                    ).map(
                      (
                        alert,
                        index
                      ) => (
                        <div
                          key={`${alert}-${index}`}
                          className="flex gap-3 rounded-xl bg-amber-50 p-4"
                        >
                          <AlertTriangle
                            className="mt-0.5 shrink-0 text-amber-700"
                            size={18}
                          />

                          <p className="text-sm leading-6 text-amber-950">
                            {alert}
                          </p>
                        </div>
                      )
                    )}

                    {(
                      summary
                        .data_quality_warnings ||
                      []
                    ).map(
                      (
                        warning,
                        index
                      ) => (
                        <div
                          key={`${warning}-${index}`}
                          className="flex gap-3 rounded-xl bg-slate-50 p-4"
                        >
                          <CheckCircle2
                            className="mt-0.5 shrink-0 text-slate-600"
                            size={18}
                          />

                          <p className="text-sm leading-6 text-slate-700">
                            {warning}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </article>
              </section>


              <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Monthly forecast
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Aggregated forecast totals by calendar month.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-5 py-3 text-left font-semibold text-slate-600">
                          Month
                        </th>

                        <th className="px-5 py-3 text-right font-semibold text-slate-600">
                          Net sales
                        </th>

                        <th className="px-5 py-3 text-right font-semibold text-slate-600">
                          Services
                        </th>

                        <th className="px-5 py-3 text-right font-semibold text-slate-600">
                          Retail
                        </th>

                        <th className="px-5 py-3 text-right font-semibold text-slate-600">
                          Gross profit
                        </th>

                        <th className="px-5 py-3 text-right font-semibold text-slate-600">
                          Transactions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {monthlyForecasts.map(
                        (item) => (
                          <tr
                            key={
                              item.month
                            }
                            className="hover:bg-slate-50"
                          >
                            <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-800">
                              {
                                item
                                  .month_label
                              }
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
                              {currency(
                                item
                                  .predicted_net_sales
                              )}
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 text-right text-slate-600">
                              {currency(
                                item
                                  .predicted_service_sales
                              )}
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 text-right text-slate-600">
                              {currency(
                                item
                                  .predicted_retail_sales
                              )}
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 text-right text-slate-600">
                              {currency(
                                item
                                  .predicted_gross_profit
                              )}
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 text-right text-slate-600">
                              {number(
                                item
                                  .predicted_transactions
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </section>


              <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Daily forecast
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Daily predicted sales with confidence bounds,
                    trends and risk classification.
                  </p>
                </div>

                <div className="max-h-[650px] overflow-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        <th className="px-5 py-3 text-left font-semibold text-slate-600">
                          Date
                        </th>

                        <th className="px-5 py-3 text-right font-semibold text-slate-600">
                          Net sales
                        </th>

                        <th className="px-5 py-3 text-right font-semibold text-slate-600">
                          Gross profit
                        </th>

                        <th className="px-5 py-3 text-right font-semibold text-slate-600">
                          Transactions
                        </th>

                        <th className="px-5 py-3 text-left font-semibold text-slate-600">
                          Trend
                        </th>

                        <th className="px-5 py-3 text-left font-semibold text-slate-600">
                          Risk
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {dailyForecasts.map(
                        (item) => {
                          const rising =
                            item.trend ===
                            "rising";

                          const falling =
                            item.trend ===
                            "falling";

                          return (
                            <tr
                              key={
                                item
                                  .forecast_date
                              }
                              className={
                                item
                                  .is_business_day
                                  ? "hover:bg-slate-50"
                                  : "bg-slate-50/70 text-slate-400"
                              }
                            >
                              <td className="whitespace-nowrap px-5 py-4">
                                <div className="font-semibold text-slate-800">
                                  {
                                    item.day_name
                                  }
                                </div>

                                <div className="text-xs text-slate-500">
                                  {formatDate(
                                    item
                                      .forecast_date
                                  )}
                                </div>
                              </td>

                              <td className="whitespace-nowrap px-5 py-4 text-right">
                                <div className="font-semibold text-slate-900">
                                  {currency(
                                    item
                                      .predicted_net_sales
                                  )}
                                </div>

                                {item
                                  .is_business_day ? (
                                  <div className="text-xs text-slate-500">
                                    {currency(
                                      item
                                        .lower_bound
                                    )}{" "}
                                    –{" "}
                                    {currency(
                                      item
                                        .upper_bound
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-xs">
                                    Closed
                                  </div>
                                )}
                              </td>

                              <td className="whitespace-nowrap px-5 py-4 text-right text-slate-700">
                                {currency(
                                  item
                                    .predicted_gross_profit
                                )}
                              </td>

                              <td className="whitespace-nowrap px-5 py-4 text-right text-slate-700">
                                {number(
                                  item
                                    .predicted_transactions,
                                  1
                                )}
                              </td>

                              <td className="whitespace-nowrap px-5 py-4">
                                <span
                                  className={
                                    rising
                                      ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                                      : falling
                                        ? "inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
                                        : "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                                  }
                                >
                                  {rising ? (
                                    <TrendingUp
                                      size={14}
                                    />
                                  ) : falling ? (
                                    <TrendingDown
                                      size={14}
                                    />
                                  ) : (
                                    <BarChart3
                                      size={14}
                                    />
                                  )}

                                  {trendLabel(
                                    item.trend
                                  )}
                                </span>
                              </td>

                              <td className="whitespace-nowrap px-5 py-4">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                  {riskLabel(
                                    item
                                      .sales_risk
                                  )}
                                </span>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </section>


              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    Forecast period:{" "}
                    <strong className="text-slate-700">
                      {formatDate(
                        forecast
                          .forecast_start
                      )}
                    </strong>{" "}
                    to{" "}
                    <strong className="text-slate-700">
                      {formatDate(
                        forecast
                          .forecast_end
                      )}
                    </strong>
                  </p>

                  <p>
                    Model:{" "}
                    <strong className="text-slate-700">
                      {
                        forecast
                          .metadata
                          ?.model_name
                      }
                    </strong>
                  </p>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}