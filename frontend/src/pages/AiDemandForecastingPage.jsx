import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Info,
  LoaderCircle,
  PoundSterling,
  RefreshCw,
  Scissors,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  getAiAppointmentDemandForecast,
  getDemandForecastErrorMessage,
} from "../Services/aiDemandForecastingService.js";


const DEFAULT_OPTIONS = {
  lookbackDays: 180,
  horizonDays: 28,
  minimumHistoryDays: 56,
  recentWindowDays: 28,
  baselineWindowDays: 84,
  confidenceLevel: 0.9,
  targetUtilisation: 0.8,
  appointmentsPerStaffHour: 0.75,
  staffShiftHours: 8,
  businessDays: [
    0,
    1,
    2,
    3,
    4,
    5,
  ],
  includeRevenueForecast: true,
};


const WEEKDAYS = [
  {
    value: 0,
    label: "Mon",
    longLabel: "Monday",
  },
  {
    value: 1,
    label: "Tue",
    longLabel: "Tuesday",
  },
  {
    value: 2,
    label: "Wed",
    longLabel: "Wednesday",
  },
  {
    value: 3,
    label: "Thu",
    longLabel: "Thursday",
  },
  {
    value: 4,
    label: "Fri",
    longLabel: "Friday",
  },
  {
    value: 5,
    label: "Sat",
    longLabel: "Saturday",
  },
  {
    value: 6,
    label: "Sun",
    longLabel: "Sunday",
  },
];


const TIME_BUCKET_LABELS = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};


const currencyFormatter =
  new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }
  );


const decimalCurrencyFormatter =
  new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );


const numberFormatter =
  new Intl.NumberFormat(
    "en-GB",
    {
      maximumFractionDigits: 1,
    }
  );


const integerFormatter =
  new Intl.NumberFormat(
    "en-GB",
    {
      maximumFractionDigits: 0,
    }
  );


const percentFormatter =
  new Intl.NumberFormat(
    "en-GB",
    {
      style: "percent",
      maximumFractionDigits: 1,
    }
  );


function formatCurrency(
  value,
  {
    decimals = false,
  } = {}
) {
  const amount =
    Number(value);

  if (!Number.isFinite(amount)) {
    return decimals
      ? "£0.00"
      : "£0";
  }

  return (
    decimals
      ? decimalCurrencyFormatter
      : currencyFormatter
  ).format(amount);
}


function formatNumber(
  value,
  {
    integer = false,
  } = {}
) {
  const amount =
    Number(value);

  if (!Number.isFinite(amount)) {
    return "0";
  }

  return (
    integer
      ? integerFormatter
      : numberFormatter
  ).format(amount);
}


function formatPercent(value) {
  const amount =
    Number(value);

  if (!Number.isFinite(amount)) {
    return "0%";
  }

  return percentFormatter.format(
    amount
  );
}


function formatDate(
  value,
  {
    includeYear = true,
  } = {}
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      `${String(value).slice(0, 10)}T12:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year:
        includeYear
          ? "numeric"
          : undefined,
    }
  );
}


function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleString(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}


function riskClasses(risk) {
  if (risk === "high") {
    return (
      "border-red-200 bg-red-50 " +
      "text-red-700"
    );
  }

  if (risk === "low") {
    return (
      "border-sky-200 bg-sky-50 " +
      "text-sky-700"
    );
  }

  if (risk === "balanced") {
    return (
      "border-emerald-200 " +
      "bg-emerald-50 " +
      "text-emerald-700"
    );
  }

  return (
    "border-slate-200 bg-slate-50 " +
    "text-slate-600"
  );
}


function riskLabel(risk) {
  const labels = {
    high: "High pressure",
    low: "Spare capacity",
    balanced: "Balanced",
    unknown: "Unknown",
  };

  return labels[risk] || "Unknown";
}


function trendIcon(trend) {
  if (trend === "rising") {
    return (
      <TrendingUp
        size={15}
        aria-hidden="true"
      />
    );
  }

  if (trend === "falling") {
    return (
      <TrendingDown
        size={15}
        aria-hidden="true"
      />
    );
  }

  return (
    <Activity
      size={15}
      aria-hidden="true"
    />
  );
}


function trendClasses(trend) {
  if (trend === "rising") {
    return (
      "border-emerald-200 " +
      "bg-emerald-50 " +
      "text-emerald-700"
    );
  }

  if (trend === "falling") {
    return (
      "border-amber-200 bg-amber-50 " +
      "text-amber-700"
    );
  }

  return (
    "border-slate-200 bg-slate-50 " +
    "text-slate-600"
  );
}


function MetricCard({
  icon: Icon,
  label,
  value,
  description,
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {label}
          </p>

          <p className="mt-3 text-2xl font-bold text-slate-950">
            {value}
          </p>

          {description && (
            <p className="mt-2 text-sm leading-5 text-slate-500">
              {description}
            </p>
          )}
        </div>

        <span className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
          <Icon
            size={22}
            aria-hidden="true"
          />
        </span>
      </div>
    </article>
  );
}


function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
          <Icon
            size={20}
            aria-hidden="true"
          />
        </span>

        <div>
          <h2 className="font-bold text-slate-950">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm text-slate-500">
              {description}
            </p>
          )}
        </div>
      </div>

      {action}
    </div>
  );
}


function RiskBadge({
  risk,
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full",
        "border px-2.5 py-1 text-xs font-bold",
        riskClasses(risk),
      ].join(" ")}
    >
      {riskLabel(risk)}
    </span>
  );
}


function TrendBadge({
  trend,
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5",
        "rounded-full border px-2.5 py-1",
        "text-xs font-bold capitalize",
        trendClasses(trend),
      ].join(" ")}
    >
      {trendIcon(trend)}
      {trend || "stable"}
    </span>
  );
}


function SettingField({
  label,
  description,
  children,
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-800">
        {label}
      </span>

      {description && (
        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      )}

      <span className="mt-2 block">
        {children}
      </span>
    </label>
  );
}


function LoadingPanel() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-12 shadow-sm">
      <div className="flex flex-col items-center justify-center text-center">
        <LoaderCircle
          className="animate-spin text-indigo-600"
          size={34}
          aria-hidden="true"
        />

        <h2 className="mt-5 text-lg font-bold text-slate-950">
          Generating demand forecast
        </h2>

        <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
          SalonAI is aggregating historical
          bookings, service demand, staffing
          capacity and appointment outcomes.
        </p>
      </div>
    </section>
  );
}


function EmptyPanel() {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <BarChart3
        className="mx-auto text-slate-400"
        size={38}
        aria-hidden="true"
      />

      <h2 className="mt-5 text-lg font-bold text-slate-950">
        No forecast available
      </h2>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
        Generate a forecast to view predicted
        bookings, revenue, capacity pressure and
        staffing recommendations.
      </p>
    </section>
  );
}


export default function AiDemandForecastingPage() {
  const [
    options,
    setOptions,
  ] = useState(
    DEFAULT_OPTIONS
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
    settingsOpen,
    setSettingsOpen,
  ] = useState(false);


  async function loadForecast(
    selectedOptions = options
  ) {
    setLoading(true);
    setError("");

    try {
      const payload =
        await getAiAppointmentDemandForecast(
          selectedOptions
        );

      setResult(payload);
    } catch (requestError) {
      setError(
        getDemandForecastErrorMessage(
          requestError
        )
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadForecast(
      DEFAULT_OPTIONS
    );
  }, []);


  const forecast =
    result?.forecast || null;

  const source =
    result?.source || null;

  const summary =
    forecast?.summary || {};

  const forecasts =
    Array.isArray(
      forecast?.forecasts
    )
      ? forecast.forecasts
      : [];

  const businessForecasts =
    useMemo(
      () =>
        forecasts.filter(
          (item) =>
            Number(
              item.predicted_bookings
            ) > 0
        ),
      [forecasts]
    );

  const maximumBookings =
    useMemo(
      () =>
        Math.max(
          1,
          ...businessForecasts.map(
            (item) =>
              Number(
                item.upper_bound ||
                  item.predicted_bookings ||
                  0
              )
          )
        ),
      [businessForecasts]
    );

  const peakDateSet =
    useMemo(
      () =>
        new Set(
          summary.peak_dates || []
        ),
      [summary.peak_dates]
    );

  const quietDateSet =
    useMemo(
      () =>
        new Set(
          summary.quiet_dates || []
        ),
      [summary.quiet_dates]
    );

  const peakForecasts =
    useMemo(
      () =>
        forecasts.filter(
          (item) =>
            peakDateSet.has(
              item.forecast_date
            )
        ),
      [forecasts, peakDateSet]
    );

  const quietForecasts =
    useMemo(
      () =>
        forecasts.filter(
          (item) =>
            quietDateSet.has(
              item.forecast_date
            )
        ),
      [forecasts, quietDateSet]
    );

  const topServices =
    useMemo(() => {
      const services =
        new Map();

      for (
        const day
        of businessForecasts
      ) {
        for (
          const service
          of day.service_forecasts || []
        ) {
          const key =
            service.service_key ||
            service.service_name;

          const current =
            services.get(key) || {
              serviceKey: key,
              serviceName:
                service.service_name,
              predictedAppointments: 0,
              confidenceTotal: 0,
              records: 0,
              trends: [],
            };

          current.predictedAppointments +=
            Number(
              service
                .predicted_appointments ||
                0
            );

          current.confidenceTotal +=
            Number(
              service.confidence ||
                0
            );

          current.records += 1;

          current.trends.push(
            service.trend
          );

          services.set(
            key,
            current
          );
        }
      }

      return Array.from(
        services.values()
      )
        .map((service) => {
          const rising =
            service.trends.filter(
              (trend) =>
                trend === "rising"
            ).length;

          const falling =
            service.trends.filter(
              (trend) =>
                trend === "falling"
            ).length;

          return {
            ...service,

            confidence:
              service.records > 0
                ? (
                    service
                      .confidenceTotal /
                    service.records
                  )
                : 0,

            trend:
              rising > falling
                ? "rising"
                : falling > rising
                  ? "falling"
                  : "stable",
          };
        })
        .sort(
          (left, right) =>
            right
              .predictedAppointments -
            left
              .predictedAppointments
        )
        .slice(0, 8);
    }, [businessForecasts]);


  function updateOption(
    field,
    value
  ) {
    setOptions(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }


  function toggleBusinessDay(
    weekday
  ) {
    setOptions(
      (current) => {
        const selected =
          current.businessDays.includes(
            weekday
          );

        const businessDays =
          selected
            ? current.businessDays.filter(
                (item) =>
                  item !== weekday
              )
            : [
                ...current.businessDays,
                weekday,
              ];

        return {
          ...current,
          businessDays:
            businessDays.sort(
              (left, right) =>
                left - right
            ),
        };
      }
    );
  }


  function resetOptions() {
    setOptions(
      DEFAULT_OPTIONS
    );

    loadForecast(
      DEFAULT_OPTIONS
    );
  }


  return (
    <div className="space-y-6 pb-10">
      <header className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-200">
              <Sparkles
                size={17}
                aria-hidden="true"
              />

              Phase 4.5 AI forecasting
            </div>

            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Appointment demand forecast
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Predict future bookings, revenue,
              service demand and staffing pressure
              from privacy-safe historical salon
              operations.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                setSettingsOpen(
                  (current) =>
                    !current
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
            >
              <SlidersHorizontal
                size={18}
                aria-hidden="true"
              />

              Forecast settings
            </button>

            <button
              type="button"
              onClick={() =>
                loadForecast()
              }
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <LoaderCircle
                  className="animate-spin"
                  size={18}
                  aria-hidden="true"
                />
              ) : (
                <RefreshCw
                  size={18}
                  aria-hidden="true"
                />
              )}

              Regenerate
            </button>
          </div>
        </div>

        {forecast && (
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs text-slate-300">
            <span>
              Forecast:
              {" "}
              <strong className="text-white">
                {formatDate(
                  forecast.forecast_start
                )}
              </strong>
              {" — "}
              <strong className="text-white">
                {formatDate(
                  forecast.forecast_end
                )}
              </strong>
            </span>

            <span>
              History:
              {" "}
              <strong className="text-white">
                {source?.historyDays || 0}
                {" days"}
              </strong>
            </span>

            <span>
              Generated:
              {" "}
              <strong className="text-white">
                {formatDateTime(
                  forecast.generated_at
                )}
              </strong>
            </span>
          </div>
        )}
      </header>

      {settingsOpen && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 shadow-sm">
          <SectionHeader
            icon={SlidersHorizontal}
            title="Forecast configuration"
            description="Adjust the historical window, forecast horizon and operating assumptions."
          />

          <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-4">
            <SettingField
              label="History window"
              description="Days of operational history sent to the forecasting engine."
            >
              <input
                type="number"
                min="28"
                max="365"
                value={
                  options.lookbackDays
                }
                onChange={(event) =>
                  updateOption(
                    "lookbackDays",
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </SettingField>

            <SettingField
              label="Forecast horizon"
              description="Number of future days to predict."
            >
              <select
                value={
                  options.horizonDays
                }
                onChange={(event) =>
                  updateOption(
                    "horizonDays",
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="7">
                  7 days
                </option>

                <option value="14">
                  14 days
                </option>

                <option value="28">
                  28 days
                </option>

                <option value="42">
                  42 days
                </option>

                <option value="60">
                  60 days
                </option>

                <option value="90">
                  90 days
                </option>
              </select>
            </SettingField>

            <SettingField
              label="Recent trend window"
              description="Recent days compared with the longer baseline."
            >
              <input
                type="number"
                min="7"
                max="120"
                value={
                  options
                    .recentWindowDays
                }
                onChange={(event) =>
                  updateOption(
                    "recentWindowDays",
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </SettingField>

            <SettingField
              label="Baseline window"
              description="Longer period used for seasonal comparison."
            >
              <input
                type="number"
                min="28"
                max="365"
                value={
                  options
                    .baselineWindowDays
                }
                onChange={(event) =>
                  updateOption(
                    "baselineWindowDays",
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </SettingField>

            <SettingField
              label="Confidence level"
              description="Controls the forecast confidence interval."
            >
              <select
                value={
                  options
                    .confidenceLevel
                }
                onChange={(event) =>
                  updateOption(
                    "confidenceLevel",
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="0.8">
                  80%
                </option>

                <option value="0.85">
                  85%
                </option>

                <option value="0.9">
                  90%
                </option>

                <option value="0.95">
                  95%
                </option>

                <option value="0.99">
                  99%
                </option>
              </select>
            </SettingField>

            <SettingField
              label="Target utilisation"
              description="Preferred share of available appointment capacity."
            >
              <input
                type="number"
                min="0.5"
                max="0.98"
                step="0.01"
                value={
                  options
                    .targetUtilisation
                }
                onChange={(event) =>
                  updateOption(
                    "targetUtilisation",
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </SettingField>

            <SettingField
              label="Appointments per staff hour"
              description="Average productive appointment capacity per hour."
            >
              <input
                type="number"
                min="0.05"
                max="10"
                step="0.05"
                value={
                  options
                    .appointmentsPerStaffHour
                }
                onChange={(event) =>
                  updateOption(
                    "appointmentsPerStaffHour",
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </SettingField>

            <SettingField
              label="Staff shift hours"
              description="Hours used to calculate recommended staff count."
            >
              <input
                type="number"
                min="1"
                max="24"
                step="0.5"
                value={
                  options
                    .staffShiftHours
                }
                onChange={(event) =>
                  updateOption(
                    "staffShiftHours",
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </SettingField>
          </div>

          <div className="border-t border-indigo-100 p-5">
            <p className="text-sm font-semibold text-slate-800">
              Salon business days
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {WEEKDAYS.map(
                (weekday) => {
                  const selected =
                    options
                      .businessDays
                      .includes(
                        weekday.value
                      );

                  return (
                    <button
                      key={
                        weekday.value
                      }
                      type="button"
                      title={
                        weekday.longLabel
                      }
                      onClick={() =>
                        toggleBusinessDay(
                          weekday.value
                        )
                      }
                      className={[
                        "rounded-lg border px-3 py-2",
                        "text-sm font-bold transition",
                        selected
                          ? (
                              "border-indigo-600 " +
                              "bg-indigo-600 text-white"
                            )
                          : (
                              "border-slate-300 " +
                              "bg-white text-slate-600 " +
                              "hover:border-indigo-300"
                            ),
                      ].join(" ")}
                    >
                      {weekday.label}
                    </button>
                  );
                }
              )}
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <input
                type="checkbox"
                checked={
                  options
                    .includeRevenueForecast
                }
                onChange={(event) =>
                  updateOption(
                    "includeRevenueForecast",
                    event.target.checked
                  )
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />

              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  Include revenue forecast
                </span>

                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Estimate revenue from predicted
                  completed appointments and
                  historical average value.
                </span>
              </span>
            </label>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={resetOptions}
                disabled={loading}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Reset defaults
              </button>

              <button
                type="button"
                onClick={() =>
                  loadForecast()
                }
                disabled={
                  loading ||
                  options
                    .businessDays
                    .length === 0
                }
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <LoaderCircle
                    className="animate-spin"
                    size={17}
                  />
                ) : (
                  <Sparkles
                    size={17}
                  />
                )}

                Apply and forecast
              </button>
            </div>
          </div>
        </section>
      )}

      {error && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 shrink-0 text-red-600"
              size={22}
              aria-hidden="true"
            />

            <div className="flex-1">
              <h2 className="font-bold text-red-900">
                Forecast unavailable
              </h2>

              <p className="mt-1 text-sm leading-6 text-red-700">
                {error}
              </p>

              <button
                type="button"
                onClick={() =>
                  loadForecast()
                }
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
              >
                <RefreshCw
                  size={16}
                  aria-hidden="true"
                />

                Try again
              </button>
            </div>
          </div>
        </section>
      )}

      {loading ? (
        <LoadingPanel />
      ) : !forecast ? (
        <EmptyPanel />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={CalendarDays}
              label="Predicted bookings"
              value={formatNumber(
                summary
                  .total_predicted_bookings
              )}
              description={`${formatNumber(
                summary
                  .average_daily_bookings
              )} average per open day`}
            />

            <MetricCard
              icon={PoundSterling}
              label="Predicted revenue"
              value={formatCurrency(
                summary
                  .total_predicted_revenue
              )}
              description={`${formatCurrency(
                summary
                  .average_daily_revenue
              )} average per open day`}
            />

            <MetricCard
              icon={TrendingDown}
              label="Cancellation rate"
              value={formatPercent(
                summary
                  .predicted_cancellation_rate
              )}
              description="Expected share of forecast bookings"
            />

            <MetricCard
              icon={Clock3}
              label="No-show rate"
              value={formatPercent(
                summary
                  .predicted_no_show_rate
              )}
              description="Expected share of forecast bookings"
            />
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={BarChart3}
              title="Daily demand profile"
              description="Predicted bookings with lower and upper confidence bounds."
            />

            <div className="overflow-x-auto p-5">
              <div className="flex min-w-max items-end gap-3">
                {forecasts.map(
                  (item) => {
                    const predicted =
                      Number(
                        item
                          .predicted_bookings ||
                          0
                      );

                    const lower =
                      Number(
                        item
                          .lower_bound ||
                          0
                      );

                    const upper =
                      Number(
                        item
                          .upper_bound ||
                          0
                      );

                    const predictedHeight =
                      Math.max(
                        predicted > 0
                          ? 8
                          : 0,
                        (
                          predicted /
                          maximumBookings
                        ) * 180
                      );

                    const upperHeight =
                      Math.max(
                        upper > 0
                          ? 8
                          : 0,
                        (
                          upper /
                          maximumBookings
                        ) * 180
                      );

                    const isPeak =
                      peakDateSet.has(
                        item.forecast_date
                      );

                    const isQuiet =
                      quietDateSet.has(
                        item.forecast_date
                      );

                    return (
                      <div
                        key={
                          item.forecast_date
                        }
                        className="w-12 shrink-0 text-center"
                        title={
                          item.explanation
                        }
                      >
                        <div className="relative flex h-52 items-end justify-center">
                          {upper > 0 && (
                            <div
                              className="absolute bottom-0 w-8 rounded-t-lg border border-indigo-200 bg-indigo-50"
                              style={{
                                height:
                                  `${upperHeight}px`,
                              }}
                            />
                          )}

                          {lower > 0 && (
                            <div
                              className="absolute bottom-0 z-10 w-8 border-t-2 border-dashed border-indigo-400"
                              style={{
                                height:
                                  `${Math.max(
                                    1,
                                    (
                                      lower /
                                      maximumBookings
                                    ) * 180
                                  )}px`,
                              }}
                            />
                          )}

                          <div
                            className={[
                              "relative z-20 w-6 rounded-t-md",
                              isPeak
                                ? "bg-red-500"
                                : isQuiet
                                  ? "bg-sky-400"
                                  : "bg-indigo-600",
                            ].join(" ")}
                            style={{
                              height:
                                `${predictedHeight}px`,
                            }}
                          />

                          {predicted > 0 && (
                            <span className="absolute -top-1 text-[10px] font-bold text-slate-700">
                              {formatNumber(
                                predicted
                              )}
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-[10px] font-bold uppercase text-slate-500">
                          {
                            item.day_name?.slice(
                              0,
                              3
                            )
                          }
                        </p>

                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {String(
                            item
                              .forecast_date ||
                              ""
                          ).slice(8, 10)}
                        </p>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-5 border-t border-slate-100 px-5 py-4 text-xs text-slate-500">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-indigo-600" />
                Predicted
              </span>

              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-red-500" />
                Peak day
              </span>

              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-sky-400" />
                Quiet day
              </span>

              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border border-indigo-200 bg-indigo-50" />
                Upper confidence bound
              </span>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeader
                icon={TrendingUp}
                title="Peak dates"
                description="Dates forecast materially above normal demand."
              />

              <div className="divide-y divide-slate-100">
                {peakForecasts.length ===
                0 ? (
                  <p className="p-5 text-sm text-slate-500">
                    No significant peak dates
                    were detected.
                  </p>
                ) : (
                  peakForecasts
                    .slice(0, 8)
                    .map(
                      (item) => (
                        <div
                          key={
                            item
                              .forecast_date
                          }
                          className="flex items-center justify-between gap-4 p-4"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">
                              {formatDate(
                                item
                                  .forecast_date
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {formatNumber(
                                item
                                  .required_staff_hours
                              )}
                              {" staff hours recommended"}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="font-bold text-red-600">
                              {formatNumber(
                                item
                                  .predicted_bookings
                              )}
                              {" bookings"}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {formatCurrency(
                                item
                                  .predicted_revenue
                              )}
                            </p>
                          </div>
                        </div>
                      )
                    )
                )}
              </div>
            </article>

            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeader
                icon={TrendingDown}
                title="Quiet dates"
                description="Dates with spare appointment capacity."
              />

              <div className="divide-y divide-slate-100">
                {quietForecasts.length ===
                0 ? (
                  <p className="p-5 text-sm text-slate-500">
                    No significant quiet dates
                    were detected.
                  </p>
                ) : (
                  quietForecasts
                    .slice(0, 8)
                    .map(
                      (item) => (
                        <div
                          key={
                            item
                              .forecast_date
                          }
                          className="flex items-center justify-between gap-4 p-4"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">
                              {formatDate(
                                item
                                  .forecast_date
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Consider targeted
                              offers or staff
                              development.
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="font-bold text-sky-600">
                              {formatNumber(
                                item
                                  .predicted_bookings
                              )}
                              {" bookings"}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {formatPercent(
                                item
                                  .expected_utilisation
                              )}
                              {" utilisation"}
                            </p>
                          </div>
                        </div>
                      )
                    )
                )}
              </div>
            </article>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={CalendarRange}
              title="Daily operational forecast"
              description="Booking, revenue, capacity and staffing recommendations by date."
            />

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">
                      Date
                    </th>

                    <th className="px-4 py-3">
                      Demand
                    </th>

                    <th className="px-4 py-3">
                      Outcomes
                    </th>

                    <th className="px-4 py-3">
                      Revenue
                    </th>

                    <th className="px-4 py-3">
                      Capacity
                    </th>

                    <th className="px-4 py-3">
                      Staffing
                    </th>

                    <th className="px-4 py-3">
                      Risk
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {forecasts.map(
                    (item) => {
                      const closed =
                        Number(
                          item
                            .predicted_bookings
                        ) === 0;

                      return (
                        <tr
                          key={
                            item
                              .forecast_date
                          }
                          className="align-top hover:bg-slate-50/70"
                        >
                          <td className="whitespace-nowrap px-4 py-4">
                            <p className="font-semibold text-slate-900">
                              {formatDate(
                                item
                                  .forecast_date,
                                {
                                  includeYear:
                                    false,
                                }
                              )}
                            </p>

                            {item.is_peak_day && (
                              <span className="mt-2 inline-flex rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold uppercase text-red-700">
                                Peak
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            {closed ? (
                              <span className="text-sm text-slate-400">
                                Closed
                              </span>
                            ) : (
                              <>
                                <p className="font-bold text-slate-900">
                                  {formatNumber(
                                    item
                                      .predicted_bookings
                                  )}
                                  {" bookings"}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {formatNumber(
                                    item
                                      .lower_bound
                                  )}
                                  {"–"}
                                  {formatNumber(
                                    item
                                      .upper_bound
                                  )}
                                  {" confidence range"}
                                </p>
                              </>
                            )}
                          </td>

                          <td className="px-4 py-4 text-xs leading-5 text-slate-600">
                            {closed ? (
                              "—"
                            ) : (
                              <>
                                <p>
                                  {formatNumber(
                                    item
                                      .predicted_completed
                                  )}
                                  {" completed"}
                                </p>

                                <p>
                                  {formatNumber(
                                    item
                                      .predicted_cancellations
                                  )}
                                  {" cancelled"}
                                </p>

                                <p>
                                  {formatNumber(
                                    item
                                      .predicted_no_shows
                                  )}
                                  {" no-shows"}
                                </p>
                              </>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-900">
                            {closed
                              ? "—"
                              : formatCurrency(
                                  item
                                    .predicted_revenue
                                )}
                          </td>

                          <td className="px-4 py-4">
                            {closed ? (
                              "—"
                            ) : (
                              <>
                                <p className="font-semibold text-slate-900">
                                  {formatPercent(
                                    item
                                      .expected_utilisation
                                  )}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {formatNumber(
                                    item
                                      .historical_capacity
                                  )}
                                  {" historical capacity"}
                                </p>
                              </>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            {closed ? (
                              "—"
                            ) : (
                              <>
                                <p className="font-semibold text-slate-900">
                                  {item
                                    .recommended_staff_count}
                                  {" staff"}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {formatNumber(
                                    item
                                      .required_staff_hours
                                  )}
                                  {" hours"}
                                </p>
                              </>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <RiskBadge
                              risk={
                                item
                                  .utilisation_risk
                              }
                            />
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
              <SectionHeader
                icon={Scissors}
                title="Service demand"
                description="Highest predicted service volumes across the forecast period."
              />

              <div className="divide-y divide-slate-100">
                {topServices.length ===
                0 ? (
                  <p className="p-5 text-sm text-slate-500">
                    Service-level history is
                    unavailable.
                  </p>
                ) : (
                  topServices.map(
                    (
                      service,
                      index
                    ) => (
                      <div
                        key={
                          service
                            .serviceKey
                        }
                        className="grid gap-4 p-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                          {index + 1}
                        </span>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">
                              {
                                service
                                  .serviceName
                              }
                            </p>

                            <TrendBadge
                              trend={
                                service.trend
                              }
                            />
                          </div>

                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-indigo-600"
                              style={{
                                width:
                                  `${Math.min(
                                    100,
                                    (
                                      service
                                        .predictedAppointments /
                                      Math.max(
                                        1,
                                        topServices[0]
                                          ?.predictedAppointments ||
                                          1
                                      )
                                    ) *
                                      100
                                  )}%`,
                              }}
                            />
                          </div>

                          <p className="mt-2 text-xs text-slate-500">
                            {formatPercent(
                              service.confidence
                            )}
                            {" average confidence"}
                          </p>
                        </div>

                        <p className="text-right text-lg font-bold text-indigo-700">
                          {formatNumber(
                            service
                              .predictedAppointments
                          )}
                        </p>
                      </div>
                    )
                  )
                )}
              </div>
            </article>

            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeader
                icon={Clock3}
                title="Time-of-day demand"
                description="Demand mix for the busiest forecast date."
              />

              <div className="space-y-5 p-5">
                {(
                  peakForecasts[0] ||
                  businessForecasts[0]
                )?.time_bucket_forecasts
                  ?.length > 0 ? (
                  (
                    peakForecasts[0] ||
                    businessForecasts[0]
                  ).time_bucket_forecasts.map(
                    (bucket) => (
                      <div
                        key={
                          bucket.bucket
                        }
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-800">
                            {
                              TIME_BUCKET_LABELS[
                                bucket
                                  .bucket
                              ] ||
                              bucket
                                .bucket
                            }
                          </p>

                          <p className="text-sm font-bold text-indigo-700">
                            {formatNumber(
                              bucket
                                .predicted_appointments
                            )}
                          </p>
                        </div>

                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{
                              width:
                                `${Math.min(
                                  100,
                                  Number(
                                    bucket
                                      .demand_share ||
                                      0
                                  ) *
                                    100
                                )}%`,
                            }}
                          />
                        </div>

                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          {
                            bucket
                              .staffing_signal
                          }
                        </p>
                      </div>
                    )
                  )
                ) : (
                  <p className="text-sm text-slate-500">
                    Time-of-day history is
                    unavailable.
                  </p>
                )}
              </div>
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeader
                icon={Users}
                title="Staffing alerts"
                description="Dates where demand may exceed comfortable operating capacity."
              />

              <div className="divide-y divide-slate-100">
                {summary
                  .staffing_alerts
                  ?.length > 0 ? (
                  summary.staffing_alerts.map(
                    (
                      message,
                      index
                    ) => (
                      <div
                        key={`${message}-${index}`}
                        className="flex items-start gap-3 p-4"
                      >
                        <AlertTriangle
                          className="mt-0.5 shrink-0 text-amber-600"
                          size={18}
                          aria-hidden="true"
                        />

                        <p className="text-sm leading-6 text-slate-700">
                          {message}
                        </p>
                      </div>
                    )
                  )
                ) : (
                  <div className="flex items-start gap-3 p-5">
                    <CheckCircle2
                      className="mt-0.5 text-emerald-600"
                      size={20}
                    />

                    <p className="text-sm leading-6 text-slate-600">
                      No high-capacity staffing
                      alerts were detected.
                    </p>
                  </div>
                )}
              </div>
            </article>

            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeader
                icon={Sparkles}
                title="AI service insights"
                description="Forecast observations generated from the historical service mix."
              />

              <div className="divide-y divide-slate-100">
                {summary
                  .service_insights
                  ?.length > 0 ? (
                  summary.service_insights.map(
                    (
                      message,
                      index
                    ) => (
                      <div
                        key={`${message}-${index}`}
                        className="flex items-start gap-3 p-4"
                      >
                        <Sparkles
                          className="mt-0.5 shrink-0 text-indigo-600"
                          size={17}
                          aria-hidden="true"
                        />

                        <p className="text-sm leading-6 text-slate-700">
                          {message}
                        </p>
                      </div>
                    )
                  )
                ) : (
                  <p className="p-5 text-sm text-slate-500">
                    No service insights are
                    available.
                  </p>
                )}
              </div>
            </article>
          </section>

          {summary
            .data_quality_warnings
            ?.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
              <SectionHeader
                icon={Info}
                title="Data-quality notices"
                description="Factors that may reduce forecast confidence."
              />

              <div className="divide-y divide-amber-100">
                {summary
                  .data_quality_warnings
                  .map(
                    (
                      warning,
                      index
                    ) => (
                      <div
                        key={`${warning}-${index}`}
                        className="flex items-start gap-3 p-4"
                      >
                        <Info
                          className="mt-0.5 shrink-0 text-amber-700"
                          size={18}
                          aria-hidden="true"
                        />

                        <p className="text-sm leading-6 text-amber-900">
                          {warning}
                        </p>
                      </div>
                    )
                  )}
              </div>
            </section>
          )}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <CalendarRange
                className="text-indigo-600"
                size={22}
              />

              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                Source period
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {formatDate(
                  source
                    ?.historyStart
                )}
              </p>

              <p className="text-sm text-slate-500">
                to
                {" "}
                {formatDate(
                  source
                    ?.historyEnd
                )}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <CalendarDays
                className="text-indigo-600"
                size={22}
              />

              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                Appointment records
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-950">
                {formatNumber(
                  source
                    ?.appointmentRecords,
                  {
                    integer: true,
                  }
                )}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <Users
                className="text-indigo-600"
                size={22}
              />

              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                Capacity sources
              </p>

              <p className="mt-2 text-sm font-semibold text-slate-900">
                {formatNumber(
                  source
                    ?.rotaShiftRecords,
                  {
                    integer: true,
                  }
                )}
                {" rota shifts"}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {formatNumber(
                  source
                    ?.activeStylists,
                  {
                    integer: true,
                  }
                )}
                {" active stylists"}
              </p>
            </article>

            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <ShieldCheck
                className="text-emerald-700"
                size={22}
              />

              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-emerald-700">
                Privacy protection
              </p>

              <p className="mt-2 text-sm font-semibold text-emerald-950">
                No customer or staff PII
              </p>

              <p className="mt-1 text-xs leading-5 text-emerald-800">
                Only aggregate operational
                metrics are sent to FastAPI.
              </p>
            </article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck
                className="mt-0.5 shrink-0 text-slate-600"
                size={20}
              />

              <div>
                <h2 className="font-bold text-slate-900">
                  Explainable forecasting model
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Model:
                  {" "}
                  <strong>
                    {
                      forecast
                        .metadata
                        ?.model_name ||
                      "SalonAI demand forecast"
                    }
                  </strong>
                  . Provider mode:
                  {" "}
                  <strong>
                    {
                      forecast
                        .metadata
                        ?.provider_mode ||
                      "mock"
                    }
                  </strong>
                  .
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {forecast
                    .metadata
                    ?.rules_applied
                    ?.map(
                      (rule) => (
                        <span
                          key={rule}
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600"
                        >
                          {String(rule)
                            .replaceAll(
                              "-",
                              " "
                            )}
                        </span>
                      )
                    )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}