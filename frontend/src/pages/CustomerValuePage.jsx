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
  Crown,
  LoaderCircle,
  PoundSterling,
  RefreshCcw,
  Repeat2,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";

import {
  getCustomerValueAnalytics,
} from "../Services/customerValueService.js";

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

function formatDate(value) {
  if (!value) {
    return "No completed visit";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
    }
  ).format(date);
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
    "Unable to load customer value analytics."
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

function SegmentBadge({
  segment,
}) {
  const labels = {
    vip: "VIP",
    loyal: "Loyal",
    regular: "Regular",
    new: "New",
    at_risk: "At risk",
    lapsed: "Lapsed",
    prospect: "Prospect",
  };

  const classes = {
    vip:
      "bg-amber-100 text-amber-800",

    loyal:
      "bg-emerald-100 text-emerald-800",

    regular:
      "bg-indigo-100 text-indigo-800",

    new:
      "bg-sky-100 text-sky-800",

    at_risk:
      "bg-orange-100 text-orange-800",

    lapsed:
      "bg-red-100 text-red-800",

    prospect:
      "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        classes[segment] ||
          classes.prospect,
      ].join(" ")}
    >
      {labels[segment] ||
        segment}
    </span>
  );
}

function CustomerRevenueChart({
  customer,
  currency,
}) {
  const monthly =
    Array.isArray(
      customer?.monthly
    )
      ? customer.monthly
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
        No monthly customer data is available.
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

export default function CustomerValuePage() {
  const [
    months,
    setMonths,
  ] = useState(12);

  const [
    analytics,
    setAnalytics,
  ] = useState(null);

  const [
    selectedCustomerId,
    setSelectedCustomerId,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    segmentFilter,
    setSegmentFilter,
  ] = useState("all");

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
            await getCustomerValueAnalytics({
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

          const customers =
            Array.isArray(
              result?.customers
            )
              ? result.customers
              : [];

          setSelectedCustomerId(
            (currentId) => {
              const exists =
                customers.some(
                  (customer) =>
                    customer.customerId ===
                    currentId
                );

              return exists
                ? currentId
                : customers[0]
                    ?.customerId ||
                    "";
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
    loadAnalytics(
      12,
      true
    );
  }, [loadAnalytics]);

  const customers =
    Array.isArray(
      analytics?.customers
    )
      ? analytics.customers
      : [];

  const summary =
    analytics?.summary || {};

  const currency =
    analytics?.currency ||
    "GBP";

  const filteredCustomers =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return customers.filter(
        (customer) => {
          const matchesSearch =
            !query ||
            String(
              customer.name || ""
            )
              .toLowerCase()
              .includes(query) ||
            String(
              customer.email || ""
            )
              .toLowerCase()
              .includes(query);

          const matchesSegment =
            segmentFilter === "all" ||
            customer.segment ===
              segmentFilter;

          return (
            matchesSearch &&
            matchesSegment
          );
        }
      );
    }, [
      customers,
      search,
      segmentFilter,
    ]);

  const selectedCustomer =
    customers.find(
      (customer) =>
        customer.customerId ===
        selectedCustomerId
    ) ||
    customers[0] ||
    null;

  function handleSubmit(event) {
    event.preventDefault();

    loadAnalytics(
      months
    );
  }

  return (
    <main className="space-y-7 p-6">
      <header className="rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 via-white to-indigo-50 p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
              <Crown size={28} />
            </span>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Customer Value
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Identify valuable, loyal,
                at-risk and lapsed customers
                using revenue, visits and
                recent activity.
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
          title="Customers"
          value={
            summary.customerCount ||
            0
          }
          description="Customers with appointments in this period"
          icon={UsersRound}
          loading={loading}
        />

        <SummaryCard
          title="Repeat customers"
          value={
            summary.repeatCustomers ||
            0
          }
          description="Customers with at least two completed visits"
          icon={Repeat2}
          loading={loading}
        />

        <SummaryCard
          title="Repeat rate"
          value={formatPercentage(
            summary.repeatRate
          )}
          description="Share of customers returning more than once"
          icon={Award}
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
          title="Average value"
          value={formatCurrency(
            summary.averageCustomerValue,
            currency
          )}
          description="Average earned revenue per customer"
          icon={Crown}
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
            <header className="grid gap-4 border-b border-slate-200 p-5 lg:grid-cols-[minmax(0,1fr)_280px_180px]">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Customer rankings
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Ranked by earned revenue and completed visits.
                </p>
              </div>

              <label className="relative block">
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
                  placeholder="Search customers"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500"
                />
              </label>

              <select
                value={segmentFilter}
                onChange={(event) =>
                  setSegmentFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              >
                <option value="all">
                  All segments
                </option>

                <option value="vip">
                  VIP
                </option>

                <option value="loyal">
                  Loyal
                </option>

                <option value="regular">
                  Regular
                </option>

                <option value="new">
                  New
                </option>

                <option value="at_risk">
                  At risk
                </option>

                <option value="lapsed">
                  Lapsed
                </option>

                <option value="prospect">
                  Prospect
                </option>
              </select>
            </header>

            {filteredCustomers.length ===
            0 ? (
              <div className="p-12 text-center">
                <UsersRound
                  size={44}
                  className="mx-auto text-slate-300"
                />

                <h3 className="mt-4 font-semibold text-slate-800">
                  No customers found
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  No customers matched the selected filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      {[
                        "Rank",
                        "Customer",
                        "Segment",
                        "Visits",
                        "Revenue",
                        "Average spend",
                        "Last visit",
                        "Repeat",
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
                    {filteredCustomers.map(
                      (
                        customer,
                        index
                      ) => (
                        <tr
                          key={
                            customer.customerId
                          }
                          onClick={() =>
                            setSelectedCustomerId(
                              customer.customerId
                            )
                          }
                          className={[
                            "cursor-pointer transition hover:bg-slate-50",
                            selectedCustomer
                              ?.customerId ===
                            customer.customerId
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
                              {customer.name}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {customer.email ||
                                "No email"}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <SegmentBadge
                              segment={
                                customer.segment
                              }
                            />
                          </td>

                          <td className="px-5 py-4 text-sm font-semibold text-slate-800">
                            {customer.completedAppointments}
                          </td>

                          <td className="px-5 py-4 font-semibold text-emerald-700">
                            {formatCurrency(
                              customer.earnedRevenue,
                              currency
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {formatCurrency(
                              customer.averageSpend,
                              currency
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {formatDate(
                              customer.lastVisit
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {customer.repeatCustomer
                              ? "Yes"
                              : "No"}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {selectedCustomer && (
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {selectedCustomer.name}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Monthly earned revenue
                    </p>
                  </div>

                  <SegmentBadge
                    segment={
                      selectedCustomer.segment
                    }
                  />
                </div>

                <div className="mt-6">
                  <CustomerRevenueChart
                    customer={
                      selectedCustomer
                    }
                    currency={
                      currency
                    }
                  />
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  Customer details
                </h2>

                <dl className="mt-5 space-y-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Total appointments
                    </dt>

                    <dd className="font-semibold text-slate-900">
                      {selectedCustomer.totalAppointments}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Completed visits
                    </dt>

                    <dd className="font-semibold text-slate-900">
                      {selectedCustomer.completedAppointments}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Active bookings
                    </dt>

                    <dd className="font-semibold text-slate-900">
                      {selectedCustomer.activeAppointments}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      First visit
                    </dt>

                    <dd className="text-right font-semibold text-slate-900">
                      {formatDate(
                        selectedCustomer.firstVisit
                      )}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Last visit
                    </dt>

                    <dd className="text-right font-semibold text-slate-900">
                      {formatDate(
                        selectedCustomer.lastVisit
                      )}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Days since visit
                    </dt>

                    <dd className="font-semibold text-slate-900">
                      {selectedCustomer.daysSinceLastVisit ??
                        "Not available"}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Services used
                    </dt>

                    <dd className="font-semibold text-slate-900">
                      {selectedCustomer.uniqueServices}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Stylists visited
                    </dt>

                    <dd className="font-semibold text-slate-900">
                      {selectedCustomer.uniqueStylists}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Collected revenue
                    </dt>

                    <dd className="font-semibold text-emerald-700">
                      {formatCurrency(
                        selectedCustomer.collectedRevenue,
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