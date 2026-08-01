import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Mail,
  Phone,
  PoundSterling,
  RefreshCcw,
  Repeat2,
  Search,
  UserRound,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import {
  getRebookingOpportunities,
} from "../services/rebookingOpportunityService.js";

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

function formatDate(value) {
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
    "Unable to load rebooking opportunities."
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

function PriorityBadge({
  priority,
}) {
  const classes = {
    high:
      "bg-red-100 text-red-800",

    medium:
      "bg-amber-100 text-amber-800",

    low:
      "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
        classes[priority] ||
          classes.low,
      ].join(" ")}
    >
      {priority}
    </span>
  );
}

function SourceBadge({
  status,
}) {
  const labels = {
    completed:
      "Repeat service",

    cancelled:
      "Cancelled",

    no_show:
      "No-show",
  };

  const classes = {
    completed:
      "bg-indigo-100 text-indigo-800",

    cancelled:
      "bg-orange-100 text-orange-800",

    no_show:
      "bg-red-100 text-red-800",
  };

  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        classes[status] ||
          "bg-slate-100 text-slate-700",
      ].join(" ")}
    >
      {labels[status] ||
        status}
    </span>
  );
}

function PriorityBreakdown({
  counts,
}) {
  const rows = [
    {
      key: "high",
      label:
        "High priority",
    },
    {
      key: "medium",
      label:
        "Medium priority",
    },
    {
      key: "low",
      label:
        "Low priority",
    },
  ];

  const maximum =
    Math.max(
      ...rows.map(
        (row) =>
          Number(
            counts?.[row.key]
          ) || 0
      ),
      1
    );

  return (
    <div className="space-y-4">
      {rows.map(
        (row) => {
          const value =
            Number(
              counts?.[row.key]
            ) || 0;

          const width =
            Math.max(
              2,
              (value / maximum) *
                100
            );

          return (
            <div key={row.key}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  {row.label}
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
                  className={[
                    "h-full rounded-full",
                    row.key === "high"
                      ? "bg-red-500"
                      : row.key ===
                          "medium"
                        ? "bg-amber-500"
                        : "bg-slate-400",
                  ].join(" ")}
                />
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}

export default function RebookingOpportunitiesPage() {
  const [
    lookbackDays,
    setLookbackDays,
  ] = useState(90);

  const [
    analytics,
    setAnalytics,
  ] = useState(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState("all");

  const [
    sourceFilter,
    setSourceFilter,
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

  const loadOpportunities =
    useCallback(
      async (
        selectedLookbackDays,
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
            await getRebookingOpportunities({
              lookbackDays:
                selectedLookbackDays,
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
    loadOpportunities(
      90,
      true
    );
  }, [loadOpportunities]);

  const summary =
    analytics?.summary || {};

  const currency =
    analytics?.currency ||
    "GBP";

  const opportunities =
    Array.isArray(
      analytics?.opportunities
    )
      ? analytics.opportunities
      : [];

  const filteredOpportunities =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return opportunities.filter(
        (opportunity) => {
          const matchesSearch =
            !query ||
            String(
              opportunity.customer
                ?.name || ""
            )
              .toLowerCase()
              .includes(query) ||
            String(
              opportunity.customer
                ?.email || ""
            )
              .toLowerCase()
              .includes(query) ||
            String(
              opportunity.service
                ?.name || ""
            )
              .toLowerCase()
              .includes(query);

          const matchesPriority =
            priorityFilter ===
              "all" ||
            opportunity.priority ===
              priorityFilter;

          const matchesSource =
            sourceFilter === "all" ||
            opportunity.sourceStatus ===
              sourceFilter;

          return (
            matchesSearch &&
            matchesPriority &&
            matchesSource
          );
        }
      );
    }, [
      opportunities,
      priorityFilter,
      search,
      sourceFilter,
    ]);

  function handleSubmit(event) {
    event.preventDefault();

    loadOpportunities(
      lookbackDays
    );
  }

  return (
    <main className="space-y-7 p-6">
      <header className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <Repeat2 size={28} />
            </span>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Rebooking Opportunities
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Find customers who cancelled,
                missed an appointment or are due
                to repeat a completed service.
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
              loadOpportunities(
                lookbackDays
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

            Refresh opportunities
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
              Opportunity lookback
            </span>

            <select
              value={lookbackDays}
              onChange={(event) =>
                setLookbackDays(
                  Number(
                    event.target.value
                  )
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              <option value={30}>
                Last 30 days
              </option>

              <option value={60}>
                Last 60 days
              </option>

              <option value={90}>
                Last 90 days
              </option>

              <option value={180}>
                Last 180 days
              </option>

              <option value={365}>
                Last 365 days
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
              <CalendarPlus
                size={17}
              />
            )}

            Find opportunities
          </button>
        </div>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Opportunities"
          value={
            summary.opportunityCount ||
            0
          }
          description="Customers currently eligible for rebooking"
          icon={Repeat2}
          loading={loading}
        />

        <SummaryCard
          title="High priority"
          value={
            summary.highPriority ||
            0
          }
          description="Strongest opportunities requiring attention"
          icon={AlertTriangle}
          loading={loading}
        />

        <SummaryCard
          title="Contactable"
          value={
            summary.contactableOpportunities ||
            0
          }
          description="Customers with an email address or phone number"
          icon={CheckCircle2}
          loading={loading}
        />

        <SummaryCard
          title="Recoverable revenue"
          value={formatCurrency(
            summary.estimatedRecoverableRevenue,
            currency
          )}
          description="Estimated value of all rebooking opportunities"
          icon={PoundSterling}
          loading={loading}
        />

        <SummaryCard
          title="Average value"
          value={formatCurrency(
            summary.averageOpportunityValue,
            currency
          )}
          description="Average estimated revenue per opportunity"
          icon={CalendarClock}
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
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">
                Opportunity filters
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <label className="relative">
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
                    placeholder="Search customer or service"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500"
                  />
                </label>

                <select
                  value={
                    priorityFilter
                  }
                  onChange={(event) =>
                    setPriorityFilter(
                      event.target.value
                    )
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="all">
                    All priorities
                  </option>

                  <option value="high">
                    High priority
                  </option>

                  <option value="medium">
                    Medium priority
                  </option>

                  <option value="low">
                    Low priority
                  </option>
                </select>

                <select
                  value={
                    sourceFilter
                  }
                  onChange={(event) =>
                    setSourceFilter(
                      event.target.value
                    )
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="all">
                    All reasons
                  </option>

                  <option value="completed">
                    Repeat services
                  </option>

                  <option value="cancelled">
                    Cancelled appointments
                  </option>

                  <option value="no_show">
                    No-shows
                  </option>
                </select>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Priority breakdown
              </h2>

              <div className="mt-5">
                <PriorityBreakdown
                  counts={
                    summary.priorityCounts
                  }
                />
              </div>
            </article>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200 p-5">
              <h2 className="text-xl font-bold text-slate-900">
                Customer opportunities
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {filteredOpportunities.length} opportunities match the current filters.
              </p>
            </header>

            {filteredOpportunities.length ===
            0 ? (
              <div className="p-12 text-center">
                <Repeat2
                  size={44}
                  className="mx-auto text-slate-300"
                />

                <h3 className="mt-4 font-semibold text-slate-800">
                  No rebooking opportunities
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  No customers matched the selected period and filters.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredOpportunities.map(
                  (
                    opportunity
                  ) => (
                    <article
                      key={
                        opportunity.opportunityId
                      }
                      className="p-5 hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900">
                              {opportunity.customer
                                ?.name ||
                                "Unknown customer"}
                            </h3>

                            <PriorityBadge
                              priority={
                                opportunity.priority
                              }
                            />

                            <SourceBadge
                              status={
                                opportunity.sourceStatus
                              }
                            />
                          </div>

                          <p className="mt-2 text-sm font-semibold text-indigo-700">
                            {opportunity.service
                              ?.name ||
                              "Salon service"}
                          </p>

                          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                            {opportunity.reason}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                            <span>
                              Last appointment:{" "}
                              <strong className="text-slate-700">
                                {formatDate(
                                  opportunity.appointmentDate
                                )}
                              </strong>
                            </span>

                            <span>
                              Overdue:{" "}
                              <strong className="text-slate-700">
                                {opportunity.daysOverdue ||
                                  0}{" "}
                                days
                              </strong>
                            </span>

                            <span>
                              Stylist:{" "}
                              <strong className="text-slate-700">
                                {opportunity.stylist
                                  ?.name ||
                                  "Unassigned"}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 xl:text-right">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Estimated value
                          </p>

                          <p className="mt-1 text-2xl font-bold text-emerald-700">
                            {formatCurrency(
                              opportunity.estimatedRevenue,
                              currency
                            )}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2 xl:justify-end">
                            {opportunity.customer
                              ?.hasEmail && (
                              <a
                                href={`mailto:${opportunity.customer.email}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                              >
                                <Mail size={14} />
                                Email
                              </a>
                            )}

                            {opportunity.customer
                              ?.hasPhone && (
                              <a
                                href={`tel:${opportunity.customer.phone}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                              >
                                <Phone size={14} />
                                Call
                              </a>
                            )}

                            {opportunity.customer
                              ?.customerId && (
                              <Link
                                to={`/customers/${opportunity.customer.customerId}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <UserRound
                                  size={14}
                                />
                                Customer
                                <ExternalLink
                                  size={12}
                                />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}