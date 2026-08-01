import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  PoundSterling,
  RefreshCcw,
  Scissors,
  Search,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from "lucide-react";

import {
  getServicePerformance,
} from "../Services/servicePerformanceService.js";

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
    "Unable to load service performance."
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

function GrowthBadge({
  value,
}) {
  const growth =
    Number(value) || 0;

  const positive =
    growth > 0;

  const negative =
    growth < 0;

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        positive
          ? "bg-emerald-50 text-emerald-700"
          : negative
            ? "bg-red-50 text-red-700"
            : "bg-slate-100 text-slate-600",
      ].join(" ")}
    >
      {positive ? (
        <TrendingUp size={13} />
      ) : negative ? (
        <TrendingDown size={13} />
      ) : (
        <BarChart3 size={13} />
      )}

      {positive ? "+" : ""}
      {formatPercentage(growth)}
    </span>
  );
}

function MonthlyRevenueChart({
  service,
  currency,
}) {
  const monthly =
    Array.isArray(
      service?.monthly
    )
      ? service.monthly
      : [];

  const maximumRevenue =
    Math.max(
      ...monthly.map(
        (month) =>
          Number(
            month.earnedRevenue
          ) || 0
      ),
      1
    );

  if (!monthly.length) {
    return (
      <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
        No monthly revenue data is available.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex h-80 min-w-[650px] items-end gap-4 border-b border-slate-200 px-3">
        {monthly.map(
          (month) => {
            const revenue =
              Number(
                month.earnedRevenue
              ) || 0;

            const height =
              revenue > 0
                ? Math.max(
                    5,
                    (
                      revenue /
                      maximumRevenue
                    ) * 90
                  )
                : 2;

            return (
              <div
                key={month.month}
                className="flex min-w-16 flex-1 flex-col items-center justify-end"
              >
                <p className="mb-2 text-center text-[11px] font-semibold text-slate-600">
                  {formatCurrency(
                    revenue,
                    currency
                  )}
                </p>

                <div
                  title={`${month.label}: ${formatCurrency(
                    revenue,
                    currency
                  )}`}
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

export default function ServicePerformancePage() {
  const [
    months,
    setMonths,
  ] = useState(6);

  const [
    analytics,
    setAnalytics,
  ] = useState(null);

  const [
    selectedServiceId,
    setSelectedServiceId,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

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

  const loadPerformance =
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
            await getServicePerformance({
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

          const availableServices =
            Array.isArray(
              result?.services
            )
              ? result.services
              : [];

          setSelectedServiceId(
            (currentId) => {
              const currentExists =
                availableServices.some(
                  (service) =>
                    service.serviceId ===
                    currentId
                );

              if (currentExists) {
                return currentId;
              }

              return (
                availableServices[0]
                  ?.serviceId ||
                ""
              );
            }
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
    loadPerformance(
      6,
      true
    );
  }, [loadPerformance]);

  const services =
    Array.isArray(
      analytics?.services
    )
      ? analytics.services
      : [];

  const summary =
    analytics?.summary || {};

  const currency =
    analytics?.currency ||
    "GBP";

  const filteredServices =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return services;
      }

      return services.filter(
        (service) =>
          String(
            service.name || ""
          )
            .toLowerCase()
            .includes(query) ||
          String(
            service.category || ""
          )
            .toLowerCase()
            .includes(query)
      );
    }, [
      search,
      services,
    ]);

  const selectedService =
    services.find(
      (service) =>
        service.serviceId ===
        selectedServiceId
    ) ||
    services[0] ||
    null;

  function handleSubmit(event) {
    event.preventDefault();

    loadPerformance(
      months
    );
  }

  return (
    <main className="space-y-7 p-6">
      <header className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <Scissors size={28} />
            </span>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Service Performance
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Compare revenue, appointment demand,
                completion rates and customer activity
                across salon services.
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
              loadPerformance(
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
        onSubmit={
          handleSubmit
        }
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
          title="Services"
          value={
            summary.serviceCount ||
            0
          }
          description="Services with appointments during this period"
          icon={Scissors}
          loading={loading}
        />

        <SummaryCard
          title="Appointments"
          value={
            summary.totalAppointments ||
            0
          }
          description="Bookings across all salon services"
          icon={CalendarDays}
          loading={loading}
        />

        <SummaryCard
          title="Completed"
          value={
            summary.completedAppointments ||
            0
          }
          description="Successfully completed appointments"
          icon={CheckCircle2}
          loading={loading}
        />

        <SummaryCard
          title="Revenue earned"
          value={formatCurrency(
            summary.earnedRevenue,
            currency
          )}
          description="Revenue earned from completed services"
          icon={PoundSterling}
          loading={loading}
        />

        <SummaryCard
          title="Average ticket"
          value={formatCurrency(
            summary.averageTicket,
            currency
          )}
          description="Average completed appointment value"
          icon={Award}
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
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Service rankings
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Ranked by earned revenue and appointment demand.
                </p>
              </div>

              <label className="relative block md:w-80">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search services"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500"
                />
              </label>
            </header>

            {filteredServices.length ===
            0 ? (
              <div className="p-12 text-center">
                <Scissors
                  size={44}
                  className="mx-auto text-slate-300"
                />

                <h3 className="mt-4 font-semibold text-slate-800">
                  No service performance data
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  No appointments matched the selected period.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      {[
                        "Rank",
                        "Service",
                        "Appointments",
                        "Completed",
                        "Completion",
                        "Revenue",
                        "Average ticket",
                        "Growth",
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
                    {filteredServices.map(
                      (
                        service,
                        index
                      ) => (
                        <tr
                          key={
                            service.serviceId
                          }
                          onClick={() =>
                            setSelectedServiceId(
                              service.serviceId
                            )
                          }
                          className={[
                            "cursor-pointer transition hover:bg-slate-50",
                            selectedService
                              ?.serviceId ===
                            service.serviceId
                              ? "bg-indigo-50/60"
                              : "",
                          ].join(" ")}
                        >
                          <td className="px-5 py-4">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                              {index + 1}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-900">
                              {service.name}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {service.category}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {service.totalAppointments}
                          </td>

                          <td className="px-5 py-4 text-sm font-semibold text-slate-800">
                            {service.completedAppointments}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {formatPercentage(
                              service.completionRate
                            )}
                          </td>

                          <td className="px-5 py-4 font-semibold text-emerald-700">
                            {formatCurrency(
                              service.earnedRevenue,
                              currency
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {formatCurrency(
                              service.averageTicket,
                              currency
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <GrowthBadge
                              value={
                                service.revenueGrowthRate
                              }
                            />
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {selectedService && (
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900">
                  {selectedService.name}
                </h2>

                <p className="mb-6 mt-1 text-sm text-slate-500">
                  Monthly earned revenue
                </p>

                <MonthlyRevenueChart
                  service={
                    selectedService
                  }
                  currency={
                    currency
                  }
                />
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  Service details
                </h2>

                <dl className="mt-5 space-y-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Category
                    </dt>

                    <dd className="font-semibold text-slate-900">
                      {selectedService.category}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Listed price
                    </dt>

                    <dd className="font-semibold text-slate-900">
                      {formatCurrency(
                        selectedService.listedPrice,
                        currency
                      )}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Duration
                    </dt>

                    <dd className="font-semibold text-slate-900">
                      {selectedService.duration ||
                        0}{" "}
                      minutes
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Unique customers
                    </dt>

                    <dd className="font-semibold text-slate-900">
                      {selectedService.uniqueCustomers}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Active bookings
                    </dt>

                    <dd className="font-semibold text-slate-900">
                      {selectedService.activeAppointments}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Cancelled
                    </dt>

                    <dd className="font-semibold text-red-700">
                      {selectedService.cancelledAppointments}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      No-shows
                    </dt>

                    <dd className="font-semibold text-amber-700">
                      {selectedService.noShowAppointments}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Collected revenue
                    </dt>

                    <dd className="font-semibold text-emerald-700">
                      {formatCurrency(
                        selectedService.collectedRevenue,
                        currency
                      )}
                    </dd>
                  </div>
                </dl>
              </article>
            </section>
          )}
        </>
      )}
    </main>
  );
}