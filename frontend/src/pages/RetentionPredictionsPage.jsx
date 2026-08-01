import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  UserRoundSearch,
  UsersRound,
  X,
} from "lucide-react";

import { Link } from "react-router-dom";

import {
  generateRetentionPrediction,
  generateRetentionPredictionBatch,
  getRetentionPredictions,
  getRetentionPredictionSummary,
  RETENTION_RISK_LEVELS,
} from "../Services/retentionPredictionService.js";

const PAGE_SIZE = 20;

const INITIAL_FILTERS = {
  search: "",
  label: "all",
  sort: "risk",
  includeExpired: false,
};

const RISK_LABELS = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

const RISK_BADGE_CLASSES = {
  low:
    "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium:
    "border-amber-200 bg-amber-50 text-amber-700",
  high:
    "border-rose-200 bg-rose-50 text-rose-700",
};

const RISK_PROGRESS_CLASSES = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-rose-500",
};

const ACTION_PRIORITY_CLASSES = {
  urgent:
    "border-rose-200 bg-rose-50 text-rose-700",
  high:
    "border-amber-200 bg-amber-50 text-amber-700",
  normal:
    "border-slate-200 bg-slate-50 text-slate-600",
};

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.details?.message ||
    error?.message ||
    "The request could not be completed."
  );
}

function getCustomerId(customer) {
  return String(
    customer?._id ||
      customer?.id ||
      customer ||
      ""
  );
}

function getCustomerName(customer) {
  if (!customer) {
    return "Unknown customer";
  }

  if (
    typeof customer === "string"
  ) {
    return "Customer";
  }

  return (
    customer.preferredName ||
    customer.displayName ||
    customer.fullName ||
    [
      customer.firstName,
      customer.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    customer.email ||
    "Unnamed customer"
  );
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function formatPercentage(value) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return "0%";
  }

  return `${Math.round(
    Math.min(
      1,
      Math.max(
        0,
        number
      )
    ) * 100
  )}%`;
}

function formatCurrency(value) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return "£0.00";
  }

  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    }
  ).format(number);
}

function formatLabel(value) {
  return String(value || "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function getPaginationNumber(
  pagination,
  keys,
  fallback
) {
  for (const key of keys) {
    const value =
      Number(
        pagination?.[key]
      );

    if (
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return fallback;
}

function getAppointmentFeatures(
  prediction
) {
  return (
    prediction?.features
      ?.appointment ||
    {}
  );
}

function getCommunicationFeatures(
  prediction
) {
  return (
    prediction?.features
      ?.communication ||
    {}
  );
}

function getRiskFactors(
  prediction
) {
  if (
    Array.isArray(
      prediction?.riskFactors
    )
  ) {
    return prediction.riskFactors;
  }

  if (
    Array.isArray(
      prediction?.features
        ?.riskFactors
    )
  ) {
    return prediction
      .features
      .riskFactors;
  }

  return [];
}

function getRecommendedActions(
  prediction
) {
  if (
    Array.isArray(
      prediction?.recommendedActions
    )
  ) {
    return prediction.recommendedActions;
  }

  if (
    Array.isArray(
      prediction?.features
        ?.recommendedActions
    )
  ) {
    return prediction
      .features
      .recommendedActions;
  }

  return [];
}

function RiskBadge({
  label,
}) {
  const safeLabel =
    RISK_LABELS[label]
      ? label
      : "low";

  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-bold",
        RISK_BADGE_CLASSES[
          safeLabel
        ],
      ].join(" ")}
    >
      {RISK_LABELS[
        safeLabel
      ]}
    </span>
  );
}

function RiskScore({
  score,
  label,
}) {
  const safeScore =
    Math.min(
      1,
      Math.max(
        0,
        Number(score) || 0
      )
    );

  const safeLabel =
    RISK_LABELS[label]
      ? label
      : "low";

  return (
    <div className="min-w-32">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-slate-800">
          {formatPercentage(
            safeScore
          )}
        </span>

        <RiskBadge
          label={safeLabel}
        />
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={[
            "h-full rounded-full transition-all",
            RISK_PROGRESS_CLASSES[
              safeLabel
            ],
          ].join(" ")}
          style={{
            width: `${safeScore * 100}%`,
          }}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  icon: Icon,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {value}
          </p>

          {description && (
            <p className="mt-2 text-xs text-slate-400">
              {description}
            </p>
          )}
        </div>

        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={22} />
        </span>
      </div>
    </div>
  );
}

function Modal({
  title,
  description,
  onClose,
  children,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {title}
            </h2>

            {description && (
              <p className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

export default function RetentionPredictionsPage() {
  const [
    predictions,
    setPredictions,
  ] = useState([]);

  const [
    summary,
    setSummary,
  ] = useState({
    totalCustomers: 0,
    predictedCustomers: 0,
    coverageRate: 0,
    stalePredictions: 0,
    byRisk: {
      low: {
        count: 0,
        averageScore: 0,
      },
      medium: {
        count: 0,
        averageScore: 0,
      },
      high: {
        count: 0,
        averageScore: 0,
      },
    },
    topRisk: [],
  });

  const [
    filters,
    setFilters,
  ] = useState(
    INITIAL_FILTERS
  );

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    pagination,
    setPagination,
  ] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 0,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    batchLoading,
    setBatchLoading,
  ] = useState(false);

  const [
    refreshingCustomerId,
    setRefreshingCustomerId,
  ] = useState("");

  const [
    selectedPrediction,
    setSelectedPrediction,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const totalPages =
    Math.max(
      1,
      getPaginationNumber(
        pagination,
        [
          "pages",
          "totalPages",
        ],
        1
      )
    );

  const totalResults =
    getPaginationNumber(
      pagination,
      ["total"],
      predictions.length
    );

  const coverageDescription =
    useMemo(
      () =>
        `${summary.predictedCustomers} of ${summary.totalCustomers} active customers`,
      [
        summary.predictedCustomers,
        summary.totalCustomers,
      ]
    );

  const loadData =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const [
            predictionResult,
            summaryResult,
          ] =
            await Promise.all([
              getRetentionPredictions({
                ...filters,
                page,
                limit:
                  PAGE_SIZE,
              }),

              getRetentionPredictionSummary(),
            ]);

          setPredictions(
            predictionResult.items ||
              []
          );

          setPagination(
            predictionResult.pagination ||
              {
                page,
                limit:
                  PAGE_SIZE,
                total:
                  predictionResult
                    .items
                    ?.length ||
                  0,
                pages: 1,
              }
          );

          setSummary({
            totalCustomers:
              Number(
                summaryResult
                  .totalCustomers
              ) || 0,

            predictedCustomers:
              Number(
                summaryResult
                  .predictedCustomers
              ) || 0,

            coverageRate:
              Number(
                summaryResult
                  .coverageRate
              ) || 0,

            stalePredictions:
              Number(
                summaryResult
                  .stalePredictions
              ) || 0,

            byRisk: {
              low: {
                count:
                  Number(
                    summaryResult
                      .byRisk
                      ?.low
                      ?.count
                  ) || 0,

                averageScore:
                  Number(
                    summaryResult
                      .byRisk
                      ?.low
                      ?.averageScore
                  ) || 0,
              },

              medium: {
                count:
                  Number(
                    summaryResult
                      .byRisk
                      ?.medium
                      ?.count
                  ) || 0,

                averageScore:
                  Number(
                    summaryResult
                      .byRisk
                      ?.medium
                      ?.averageScore
                  ) || 0,
              },

              high: {
                count:
                  Number(
                    summaryResult
                      .byRisk
                      ?.high
                      ?.count
                  ) || 0,

                averageScore:
                  Number(
                    summaryResult
                      .byRisk
                      ?.high
                      ?.averageScore
                  ) || 0,
              },
            },

            topRisk:
              Array.isArray(
                summaryResult.topRisk
              )
                ? summaryResult
                    .topRisk
                : [],
          });
        } catch (requestError) {
          setError(
            getErrorMessage(
              requestError
            )
          );
        } finally {
          setLoading(false);
        }
      },
      [
        filters,
        page,
      ]
    );

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          loadData();
        },
        filters.search
          ? 300
          : 0
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [loadData, filters.search]);

  function showSuccess(
    message
  ) {
    setSuccessMessage(
      message
    );

    window.setTimeout(
      () => {
        setSuccessMessage(
          ""
        );
      },
      4500
    );
  }

  function updateFilter(
    field,
    value
  ) {
    setFilters(
      (
        current
      ) => ({
        ...current,
        [field]:
          value,
      })
    );

    setPage(1);
  }

  async function handleBatchGeneration(
    force
  ) {
    setBatchLoading(true);
    setError("");

    try {
      const result =
        await generateRetentionPredictionBatch({
          status: "active",
          limit: 500,
          concurrency: 5,
          force,
        });

      showSuccess(
        `${result.succeeded} prediction${
          result.succeeded === 1
            ? ""
            : "s"
        } completed: ${result.refreshed} refreshed and ${result.reused} reused.`
      );

      await loadData();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setBatchLoading(false);
    }
  }

  async function handleRefreshCustomer(
    prediction
  ) {
    const customerId =
      getCustomerId(
        prediction.customer
      );

    if (!customerId) {
      setError(
        "The prediction does not contain a valid customer identifier."
      );

      return;
    }

    setRefreshingCustomerId(
      customerId
    );

    setError("");

    try {
      const result =
        await generateRetentionPrediction(
          customerId,
          {
            force: true,
          }
        );

      showSuccess(
        `Retention prediction refreshed for ${getCustomerName(
          result.customer ||
            prediction.customer
        )}.`
      );

      if (
        selectedPrediction &&
        getCustomerId(
          selectedPrediction.customer
        ) === customerId
      ) {
        setSelectedPrediction(
          result.risk
            ? {
                ...result.risk,
                customer:
                  result.customer,
                riskFactors:
                  result.riskFactors,
                recommendedActions:
                  result.recommendedActions,
                features:
                  result.features,
                fresh:
                  true,
              }
            : selectedPrediction
        );
      }

      await loadData();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setRefreshingCustomerId(
        ""
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-indigo-600">
              Artificial Intelligence
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Retention Predictions
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Identify customers at risk of leaving,
              understand the contributing signals and
              prioritise suitable retention actions.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                handleBatchGeneration(
                  false
                )
              }
              disabled={
                batchLoading
              }
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {batchLoading ? (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Sparkles
                  size={17}
                />
              )}

              Generate missing
            </button>

            <button
              type="button"
              onClick={() =>
                handleBatchGeneration(
                  true
                )
              }
              disabled={
                batchLoading
              }
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {batchLoading ? (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <BrainCircuit
                  size={17}
                />
              )}

              Refresh all predictions
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0"
            />

            <span>
              {successMessage}
            </span>
          </div>
        )}

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Prediction coverage"
            value={formatPercentage(
              summary.coverageRate
            )}
            description={
              coverageDescription
            }
            icon={ShieldCheck}
          />

          <SummaryCard
            label="High-risk customers"
            value={
              summary.byRisk
                .high.count
            }
            description={`Average risk ${formatPercentage(
              summary.byRisk
                .high
                .averageScore
            )}`}
            icon={TrendingDown}
          />

          <SummaryCard
            label="Medium-risk customers"
            value={
              summary.byRisk
                .medium.count
            }
            description={`Average risk ${formatPercentage(
              summary.byRisk
                .medium
                .averageScore
            )}`}
            icon={UserRoundSearch}
          />

          <SummaryCard
            label="Expired predictions"
            value={
              summary.stalePredictions
            }
            description="Refresh these before acting"
            icon={Clock3}
          />
        </div>

        <div className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="relative xl:col-span-2">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-3 text-slate-400"
                />

                <input
                  type="search"
                  value={
                    filters.search
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "search",
                      event.target
                        .value
                    )
                  }
                  placeholder="Search customer name, email or phone"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <select
                value={
                  filters.label
                }
                onChange={(
                  event
                ) =>
                  updateFilter(
                    "label",
                    event.target
                      .value
                  )
                }
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              >
                <option value="all">
                  All risk levels
                </option>

                {RETENTION_RISK_LEVELS.map(
                  (
                    riskLevel
                  ) => (
                    <option
                      key={
                        riskLevel
                      }
                      value={
                        riskLevel
                      }
                    >
                      {
                        RISK_LABELS[
                          riskLevel
                        ]
                      }
                    </option>
                  )
                )}
              </select>

              <select
                value={
                  filters.sort
                }
                onChange={(
                  event
                ) =>
                  updateFilter(
                    "sort",
                    event.target
                      .value
                  )
                }
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              >
                <option value="risk">
                  Highest risk first
                </option>

                <option value="newest">
                  Newest prediction
                </option>

                <option value="oldest">
                  Oldest prediction
                </option>
              </select>

              <label className="flex items-center gap-3 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={
                    filters.includeExpired
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "includeExpired",
                      event.target
                        .checked
                    )
                  }
                />

                Include expired
              </label>

              <button
                type="button"
                onClick={
                  loadData
                }
                disabled={
                  loading
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-80 items-center justify-center">
              <LoaderCircle
                size={34}
                className="animate-spin text-indigo-600"
              />
            </div>
          ) : predictions.length ===
            0 ? (
            <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
              <BrainCircuit
                size={48}
                className="text-slate-300"
              />

              <h2 className="mt-4 text-lg font-semibold text-slate-800">
                No retention predictions found
              </h2>

              <p className="mt-2 max-w-md text-sm text-slate-500">
                Generate predictions for active
                customers or adjust the selected
                filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Customer",
                      "Risk",
                      "Key signals",
                      "Recommendation",
                      "Prediction date",
                      "Actions",
                    ].map(
                      (
                        heading
                      ) => (
                        <th
                          key={
                            heading
                          }
                          className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500"
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {predictions.map(
                    (
                      prediction
                    ) => {
                      const customer =
                        prediction.customer;

                      const customerId =
                        getCustomerId(
                          customer
                        );

                      const appointmentFeatures =
                        getAppointmentFeatures(
                          prediction
                        );

                      const communicationFeatures =
                        getCommunicationFeatures(
                          prediction
                        );

                      const riskFactors =
                        getRiskFactors(
                          prediction
                        );

                      const recommendedActions =
                        getRecommendedActions(
                          prediction
                        );

                      const isRefreshing =
                        refreshingCustomerId ===
                        customerId;

                      return (
                        <tr
                          key={
                            prediction._id
                          }
                          className="align-top hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-900">
                              {getCustomerName(
                                customer
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {customer?.email ||
                                customer?.phone ||
                                "No contact details"}
                            </p>

                            {customer
                              ?.totalSpent !==
                              undefined && (
                              <p className="mt-1 text-xs font-medium text-slate-400">
                                Historical spend:{" "}
                                {formatCurrency(
                                  customer.totalSpent
                                )}
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <RiskScore
                              score={
                                prediction.score
                              }
                              label={
                                prediction.label
                              }
                            />

                            {!prediction.fresh && (
                              <p className="mt-2 text-xs font-semibold text-amber-600">
                                Prediction expired
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="space-y-1.5 text-xs text-slate-600">
                              <p>
                                Last visit:{" "}
                                <strong className="text-slate-800">
                                  {formatDate(
                                    appointmentFeatures
                                      .lastCompletedAt
                                  )}
                                </strong>
                              </p>

                              <p>
                                Completed visits:{" "}
                                <strong className="text-slate-800">
                                  {appointmentFeatures
                                    .completedCount ||
                                    0}
                                </strong>
                              </p>

                              <p>
                                Future booking:{" "}
                                <strong className="text-slate-800">
                                  {appointmentFeatures
                                    .hasFutureAppointment
                                    ? "Yes"
                                    : "No"}
                                </strong>
                              </p>

                              {riskFactors[0] && (
                                <p className="max-w-xs text-slate-400">
                                  {riskFactors[0]
                                    .label}
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold text-slate-800">
                              {recommendedActions[0]
                                ?.title ||
                                "Review customer"}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Channel:{" "}
                              {formatLabel(
                                communicationFeatures
                                  .recommendedChannel ||
                                  "none"
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Response rate:{" "}
                              {formatPercentage(
                                communicationFeatures
                                  .responseRate
                              )}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-500">
                            <p>
                              {formatDateTime(
                                prediction.updatedAt
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Expires{" "}
                              {formatDate(
                                prediction.expiresAt
                              )}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex min-w-40 flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedPrediction(
                                    prediction
                                  )
                                }
                                className="rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                              >
                                Details
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleRefreshCustomer(
                                    prediction
                                  )
                                }
                                disabled={
                                  isRefreshing
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                              >
                                <RefreshCw
                                  size={13}
                                  className={
                                    isRefreshing
                                      ? "animate-spin"
                                      : ""
                                  }
                                />

                                Refresh
                              </button>

                              {customerId && (
                                <Link
                                  to={`/customers/${customerId}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  Profile
                                  <ExternalLink
                                    size={12}
                                  />
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
            <p className="text-sm text-slate-500">
              {totalResults} prediction
              {totalResults === 1
                ? ""
                : "s"}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={
                  page <= 1 ||
                  loading
                }
                onClick={() =>
                  setPage(
                    (
                      current
                    ) =>
                      Math.max(
                        1,
                        current - 1
                      )
                  )
                }
                className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft
                  size={17}
                />
              </button>

              <span className="min-w-24 text-center text-sm font-medium text-slate-600">
                Page {page} of{" "}
                {totalPages}
              </span>

              <button
                type="button"
                disabled={
                  page >=
                    totalPages ||
                  loading
                }
                onClick={() =>
                  setPage(
                    (
                      current
                    ) =>
                      Math.min(
                        totalPages,
                        current + 1
                      )
                  )
                }
                className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight
                  size={17}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedPrediction && (
        <Modal
          title={getCustomerName(
            selectedPrediction.customer
          )}
          description="Retention risk analysis, contributing signals and recommended actions."
          onClose={() =>
            setSelectedPrediction(
              null
            )
          }
        >
          <div className="space-y-6 p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Churn risk
                </p>

                <div className="mt-3">
                  <RiskScore
                    score={
                      selectedPrediction.score
                    }
                    label={
                      selectedPrediction.label
                    }
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Recommended channel
                </p>

                <p className="mt-3 text-xl font-bold text-slate-900">
                  {formatLabel(
                    getCommunicationFeatures(
                      selectedPrediction
                    )
                      .recommendedChannel ||
                      "none"
                  )}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Based on consent, preference
                  and previous engagement.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Future booking
                </p>

                <p className="mt-3 text-xl font-bold text-slate-900">
                  {getAppointmentFeatures(
                    selectedPrediction
                  )
                    .hasFutureAppointment
                    ? "Booked"
                    : "Not booked"}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  {getAppointmentFeatures(
                    selectedPrediction
                  )
                    .nextAppointmentAt
                    ? formatDateTime(
                        getAppointmentFeatures(
                          selectedPrediction
                        )
                          .nextAppointmentAt
                      )
                    : "No future appointment recorded"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-bold text-slate-900">
                Prediction explanation
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {selectedPrediction.explanation ||
                  "No explanation is available for this prediction."}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Risk factors
              </h3>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {getRiskFactors(
                  selectedPrediction
                ).length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No individual risk factors were
                    recorded.
                  </p>
                ) : (
                  getRiskFactors(
                    selectedPrediction
                  ).map(
                    (
                      factor,
                      index
                    ) => (
                      <div
                        key={`${factor.key || "factor"}-${index}`}
                        className={[
                          "rounded-xl border p-4",
                          factor.impact ===
                          "increase"
                            ? "border-rose-100 bg-rose-50/60"
                            : "border-emerald-100 bg-emerald-50/60",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-slate-900">
                            {factor.label}
                          </p>

                          <span
                            className={[
                              "rounded-full px-2 py-1 text-xs font-bold",
                              factor.impact ===
                              "increase"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-emerald-100 text-emerald-700",
                            ].join(" ")}
                          >
                            {factor.impact ===
                            "increase"
                              ? "+"
                              : "-"}
                            {formatPercentage(
                              factor.weight
                            )}
                          </span>
                        </div>

                        <p className="mt-2 text-sm leading-5 text-slate-600">
                          {factor.detail}
                        </p>

                        <p className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-400">
                          {formatLabel(
                            factor.category
                          )}
                        </p>
                      </div>
                    )
                  )
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Recommended actions
              </h3>

              <div className="mt-3 space-y-3">
                {getRecommendedActions(
                  selectedPrediction
                ).length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No recommended actions were recorded.
                  </p>
                ) : (
                  getRecommendedActions(
                    selectedPrediction
                  ).map(
                    (
                      action,
                      index
                    ) => (
                      <div
                        key={`${action.action || "action"}-${index}`}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">
                            {action.title}
                          </p>

                          <span
                            className={[
                              "rounded-full border px-2 py-0.5 text-xs font-bold",
                              ACTION_PRIORITY_CLASSES[
                                action.priority
                              ] ||
                                ACTION_PRIORITY_CLASSES.normal,
                            ].join(" ")}
                          >
                            {formatLabel(
                              action.priority ||
                                "normal"
                            )}
                          </span>
                        </div>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {action.description}
                        </p>
                      </div>
                    )
                  )
                )}
              </div>
            </div>

            <div className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Completed visits
                </p>

                <p className="mt-2 text-lg font-bold text-slate-900">
                  {getAppointmentFeatures(
                    selectedPrediction
                  ).completedCount ||
                    0}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Days since visit
                </p>

                <p className="mt-2 text-lg font-bold text-slate-900">
                  {getAppointmentFeatures(
                    selectedPrediction
                  )
                    .daysSinceLastCompleted ??
                    "—"}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  No-show rate
                </p>

                <p className="mt-2 text-lg font-bold text-slate-900">
                  {formatPercentage(
                    getAppointmentFeatures(
                      selectedPrediction
                    ).noShowRate
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Response rate
                </p>

                <p className="mt-2 text-lg font-bold text-slate-900">
                  {formatPercentage(
                    getCommunicationFeatures(
                      selectedPrediction
                    ).responseRate
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
              {getCustomerId(
                selectedPrediction.customer
              ) && (
                <Link
                  to={`/customers/${getCustomerId(
                    selectedPrediction.customer
                  )}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open customer profile
                  <ExternalLink
                    size={15}
                  />
                </Link>
              )}

              <button
                type="button"
                onClick={() =>
                  handleRefreshCustomer(
                    selectedPrediction
                  )
                }
                disabled={
                  refreshingCustomerId ===
                  getCustomerId(
                    selectedPrediction.customer
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={
                    refreshingCustomerId ===
                    getCustomerId(
                      selectedPrediction.customer
                    )
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh prediction
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}