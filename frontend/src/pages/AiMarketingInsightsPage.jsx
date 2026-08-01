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
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  Filter,
  Loader2,
  Mail,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  RefreshCw,
  RotateCcw,
  Send,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";

import {
  DEFAULT_MARKETING_INSIGHTS_PARAMETERS,
  getAiMarketingInsights,
} from "../services/aiMarketingInsightsService.js";


const DEFAULT_FILTERS = {
  ...DEFAULT_MARKETING_INSIGHTS_PARAMETERS,
};


const CHANNEL_LABELS = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  push: "Push notifications",
  social: "Social media",
  referral: "Referrals",
  organic: "Organic",
  paid_search: "Paid search",
  paid_social: "Paid social",
  other: "Other",
};


const CHANNEL_ICONS = {
  email: Mail,
  sms: MessageCircle,
  whatsapp: MessageCircle,
  push: Send,
  social: Users,
  referral: UserPlus,
  organic: Sparkles,
  paid_search: Target,
  paid_social: Megaphone,
  other: BarChart3,
};


function currency(
  value,
  maximumFractionDigits = 0
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


function formatDate(
  value
) {
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


function channelLabel(
  value
) {
  return (
    CHANNEL_LABELS[value] ||
    value ||
    "Unknown"
  );
}


function trendLabel(
  value
) {
  if (
    value === "rising"
  ) {
    return "Rising";
  }

  if (
    value === "falling"
  ) {
    return "Falling";
  }

  return "Stable";
}


function riskLabel(
  value
) {
  if (
    value === "high"
  ) {
    return "High";
  }

  if (
    value === "medium"
  ) {
    return "Medium";
  }

  if (
    value === "balanced"
  ) {
    return "Balanced";
  }

  if (
    value === "low"
  ) {
    return "Low";
  }

  return "Unknown";
}


function priorityLabel(
  value
) {
  if (
    value === "critical"
  ) {
    return "Critical";
  }

  if (
    value === "high"
  ) {
    return "High";
  }

  if (
    value === "medium"
  ) {
    return "Medium";
  }

  return "Low";
}


function trendClasses(
  value
) {
  if (
    value === "rising"
  ) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (
    value === "falling"
  ) {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-slate-100 text-slate-600";
}


function riskClasses(
  value
) {
  if (
    value === "high"
  ) {
    return "bg-rose-50 text-rose-700";
  }

  if (
    value === "medium"
  ) {
    return "bg-amber-50 text-amber-700";
  }

  if (
    value === "balanced"
  ) {
    return "bg-emerald-50 text-emerald-700";
  }

  return "bg-slate-100 text-slate-600";
}


function priorityClasses(
  value
) {
  if (
    value === "critical"
  ) {
    return "bg-rose-100 text-rose-800";
  }

  if (
    value === "high"
  ) {
    return "bg-orange-100 text-orange-800";
  }

  if (
    value === "medium"
  ) {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-slate-100 text-slate-700";
}


function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  trend,
}) {
  const rising =
    trend === "rising";

  const falling =
    trend === "falling";

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
        {trend ? (
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
              {trendLabel(
                trend
              )}
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


function LoadingState() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <Loader2
        className="mx-auto animate-spin text-violet-700"
        size={42}
      />

      <h2 className="mt-4 text-lg font-semibold text-slate-900">
        Generating AI marketing insights
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        Analysing customer engagement, booking conversion, channel
        performance and attributed revenue.
      </p>
    </section>
  );
}


function EmptyState() {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <Megaphone
        className="mx-auto text-slate-400"
        size={42}
      />

      <h2 className="mt-4 text-lg font-semibold text-slate-900">
        No marketing insights available
      </h2>

      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
        Generate marketing insights to review engagement,
        conversion, channel performance, campaign effectiveness and
        revenue efficiency.
      </p>
    </section>
  );
}


function TrendBadge({
  value,
}) {
  const rising =
    value === "rising";

  const falling =
    value === "falling";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${trendClasses(
        value
      )}`}
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
        value
      )}
    </span>
  );
}


export default function AiMarketingInsightsPage() {
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


  const loadInsights =
    useCallback(
      async (
        selectedFilters =
          filters
      ) => {
        setLoading(true);
        setError("");

        try {
          const response =
            await getAiMarketingInsights(
              selectedFilters
            );

          setResult(
            response
          );
        } catch (requestError) {
          setError(
            requestError
              ?.response
              ?.data
              ?.message ||
              requestError
                ?.response
                ?.data
                ?.error ||
              requestError
                ?.message ||
              "Unable to generate AI marketing insights."
          );
        } finally {
          setLoading(false);
        }
      },
      [filters]
    );


  useEffect(
    () => {
      loadInsights(
        DEFAULT_FILTERS
      );
    },
    []
  );


  const insights =
    result?.insights ||
    null;

  const summary =
    insights?.summary ||
    null;

  const channelInsights =
    insights
      ?.channel_insights ||
    [];

  const campaignInsights =
    insights
      ?.campaign_insights ||
    [];

  const generatedInsights =
    insights?.insights ||
    [];

  const source =
    result?.source ||
    null;


  const strongestChannels =
    useMemo(
      () =>
        [
          ...channelInsights,
        ]
          .sort(
            (
              left,
              right
            ) =>
              right
                .value
                .net_attributed_revenue -
              left
                .value
                .net_attributed_revenue
          )
          .slice(
            0,
            6
          ),
      [channelInsights]
    );


  const strongestCampaigns =
    useMemo(
      () =>
        [
          ...campaignInsights,
        ]
          .sort(
            (
              left,
              right
            ) =>
              right
                .performance_score -
              left
                .performance_score
          )
          .slice(
            0,
            8
          ),
      [campaignInsights]
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


  function resetFilters() {
    setFilters(
      DEFAULT_FILTERS
    );

    loadInsights(
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
                AI Marketing Insights
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Analyse engagement, campaign performance, booking
                conversion, customer acquisition, channel efficiency
                and attributed marketing revenue.
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
                <Filter
                  size={18}
                />

                Analysis settings
              </button>

              <button
                type="button"
                onClick={() =>
                  loadInsights()
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

                Refresh insights
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
                  Bookings analysed
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {number(
                    source.appointmentRecords
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Active customer records
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {number(
                    source.activeCustomerRecords
                  )}
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
                  Analysis settings
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Adjust the historical window, performance thresholds
                  and included analysis sections.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  resetFilters
                }
                className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900"
              >
                <RotateCcw
                  size={16}
                />

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
                  min="28"
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
                  Minimum history
                </span>

                <input
                  type="number"
                  min="28"
                  max="730"
                  value={
                    filters
                      .minimumHistoryDays
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "minimumHistoryDays",
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
                  Strong open rate
                </span>

                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={
                    filters
                      .strongOpenRate
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "strongOpenRate",
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
                  Strong click rate
                </span>

                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={
                    filters
                      .strongClickRate
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "strongClickRate",
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
                  Strong conversion rate
                </span>

                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={
                    filters
                      .strongConversionRate
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "strongConversionRate",
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
                  High failure rate
                </span>

                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={
                    filters
                      .highFailureRate
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "highFailureRate",
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
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={
                    filters
                      .includeChannelInsights
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "includeChannelInsights",
                      event
                        .target
                        .checked
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 text-violet-700 focus:ring-violet-500"
                />

                <span className="text-sm font-medium text-slate-700">
                  Channel insights
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={
                    filters
                      .includeCampaignInsights
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "includeCampaignInsights",
                      event
                        .target
                        .checked
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 text-violet-700 focus:ring-violet-500"
                />

                <span className="text-sm font-medium text-slate-700">
                  Campaign insights
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={
                    filters
                      .includeRecommendations
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "includeRecommendations",
                      event
                        .target
                        .checked
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 text-violet-700 focus:ring-violet-500"
                />

                <span className="text-sm font-medium text-slate-700">
                  Recommendations
                </span>
              </label>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  loadInsights()
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

                Generate insights
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
                  Marketing insights unavailable
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
          ) : !insights ||
            !summary ? (
            <EmptyState />
          ) : (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Attributed revenue"
                  value={currency(
                    summary
                      .value
                      .net_attributed_revenue
                  )}
                  helper={`${number(
                    summary
                      .total_bookings
                  )} bookings`}
                  icon={
                    CircleDollarSign
                  }
                  trend={
                    summary
                      .revenue_trend
                  }
                />

                <MetricCard
                  title="Booking conversion"
                  value={percentage(
                    summary
                      .rates
                      .booking_conversion_rate
                  )}
                  helper={`${number(
                    summary
                      .total_completed_appointments
                  )} completed appointments`}
                  icon={
                    Target
                  }
                  trend={
                    summary
                      .conversion_trend
                  }
                />

                <MetricCard
                  title="Message engagement"
                  value={percentage(
                    summary
                      .rates
                      .open_rate
                  )}
                  helper={`${percentage(
                    summary
                      .rates
                      .click_rate
                  )} click rate`}
                  icon={
                    Eye
                  }
                  trend={
                    summary
                      .engagement_trend
                  }
                />

                <MetricCard
                  title="Marketing return"
                  value={`${number(
                    summary
                      .value
                      .return_on_marketing_spend,
                    2
                  )}x`}
                  helper={`${currency(
                    summary
                      .value
                      .marketing_cost
                  )} spend`}
                  icon={
                    TrendingUp
                  }
                />
              </section>


              <section className="mt-6 grid gap-6 lg:grid-cols-3">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        Marketing funnel
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Customer progression from message delivery to
                        completed appointment.
                      </p>
                    </div>

                    <Target className="text-violet-700" />
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <Send className="text-violet-700" />

                      <p className="mt-3 text-2xl font-bold text-slate-900">
                        {number(
                          summary
                            .total_messages_delivered
                        )}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Delivered
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <Eye className="text-violet-700" />

                      <p className="mt-3 text-2xl font-bold text-slate-900">
                        {number(
                          summary
                            .total_messages_opened
                        )}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Opened
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <MousePointerClick className="text-violet-700" />

                      <p className="mt-3 text-2xl font-bold text-slate-900">
                        {number(
                          summary
                            .total_messages_clicked
                        )}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Clicked
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <ShoppingBag className="text-violet-700" />

                      <p className="mt-3 text-2xl font-bold text-slate-900">
                        {number(
                          summary
                            .total_bookings
                        )}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Bookings
                      </p>
                    </div>
                  </div>
                </article>


                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Overall performance
                  </h2>

                  <div className="mt-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-500">
                        Risk level
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskClasses(
                          summary
                            .overall_risk
                        )}`}
                      >
                        {riskLabel(
                          summary
                            .overall_risk
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-500">
                        Delivery rate
                      </span>

                      <span className="font-semibold text-slate-900">
                        {percentage(
                          summary
                            .rates
                            .delivery_rate
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-500">
                        Unsubscribe rate
                      </span>

                      <span className="font-semibold text-slate-900">
                        {percentage(
                          summary
                            .rates
                            .unsubscribe_rate
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-500">
                        Failure rate
                      </span>

                      <span className="font-semibold text-slate-900">
                        {percentage(
                          summary
                            .rates
                            .failure_rate
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-500">
                        New customers
                      </span>

                      <span className="font-semibold text-slate-900">
                        {number(
                          summary
                            .total_new_customers
                        )}
                      </span>
                    </div>
                  </div>
                </article>
              </section>


              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Channel performance
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Strongest channels ranked by attributed revenue
                      and booking conversion.
                    </p>
                  </div>

                  <Megaphone className="text-violet-700" />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {strongestChannels.length > 0 ? (
                    strongestChannels.map(
                      (
                        channel
                      ) => {
                        const Icon =
                          CHANNEL_ICONS[
                            channel
                              .channel
                          ] ||
                          BarChart3;

                        return (
                          <article
                            key={
                              channel
                                .channel
                            }
                            className="rounded-xl border border-slate-200 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-violet-50 p-2 text-violet-700">
                                  <Icon
                                    size={18}
                                  />
                                </div>

                                <div>
                                  <h3 className="font-semibold text-slate-900">
                                    {channelLabel(
                                      channel
                                        .channel
                                    )}
                                  </h3>

                                  <p className="text-xs text-slate-500">
                                    {number(
                                      channel
                                        .messages_sent
                                    )}{" "}
                                    messages
                                  </p>
                                </div>
                              </div>

                              <span
                                className={`rounded-full px-2 py-1 text-xs font-semibold ${riskClasses(
                                  channel
                                    .risk
                                )}`}
                              >
                                {riskLabel(
                                  channel
                                    .risk
                                )}
                              </span>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs text-slate-500">
                                  Revenue
                                </p>

                                <p className="mt-1 font-semibold text-slate-900">
                                  {currency(
                                    channel
                                      .value
                                      .net_attributed_revenue
                                  )}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-slate-500">
                                  Conversion
                                </p>

                                <p className="mt-1 font-semibold text-slate-900">
                                  {percentage(
                                    channel
                                      .rates
                                      .booking_conversion_rate
                                  )}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-slate-500">
                                  Open rate
                                </p>

                                <p className="mt-1 font-semibold text-slate-900">
                                  {percentage(
                                    channel
                                      .rates
                                      .open_rate
                                  )}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-slate-500">
                                  ROMS
                                </p>

                                <p className="mt-1 font-semibold text-slate-900">
                                  {number(
                                    channel
                                      .value
                                      .return_on_marketing_spend,
                                    2
                                  )}x
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <TrendBadge
                                value={
                                  channel
                                    .engagement_trend
                                }
                              />

                              <TrendBadge
                                value={
                                  channel
                                    .conversion_trend
                                }
                              />
                            </div>
                          </article>
                        );
                      }
                    )
                  ) : (
                    <p className="text-sm text-slate-500">
                      No marketing channel met the minimum activity
                      threshold.
                    </p>
                  )}
                </div>
              </section>


              <section className="mt-6 grid gap-6 lg:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">
                    AI findings
                  </h2>

                  <div className="mt-4 space-y-3">
                    {generatedInsights.length > 0 ? (
                      generatedInsights.map(
                        (
                          insight
                        ) => (
                          <div
                            key={
                              insight
                                .insight_id
                            }
                            className="rounded-xl border border-slate-200 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h3 className="font-semibold text-slate-900">
                                {
                                  insight.title
                                }
                              </h3>

                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClasses(
                                  insight
                                    .priority
                                )}`}
                              >
                                {priorityLabel(
                                  insight
                                    .priority
                                )}
                              </span>
                            </div>

                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {
                                insight.description
                              }
                            </p>

                            {insight
                              .recommended_action ? (
                              <div className="mt-3 rounded-lg bg-violet-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                                  Recommended action
                                </p>

                                <p className="mt-1 text-sm leading-6 text-violet-950">
                                  {
                                    insight
                                      .recommended_action
                                  }
                                </p>
                              </div>
                            ) : null}
                          </div>
                        )
                      )
                    ) : (
                      <p className="text-sm text-slate-500">
                        No detailed AI findings were generated.
                      </p>
                    )}
                  </div>
                </article>


                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Recommended actions
                  </h2>

                  <div className="mt-4 space-y-3">
                    {(
                      summary
                        .recommended_actions ||
                      []
                    ).map(
                      (
                        action,
                        index
                      ) => (
                        <div
                          key={`${action}-${index}`}
                          className="flex gap-3 rounded-xl bg-violet-50 p-4"
                        >
                          <Sparkles
                            className="mt-0.5 shrink-0 text-violet-700"
                            size={18}
                          />

                          <p className="text-sm leading-6 text-violet-950">
                            {action}
                          </p>
                        </div>
                      )
                    )}

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
                    Campaign performance
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Highest-scoring campaigns based on engagement,
                    conversion and attributed revenue.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-5 py-3 text-left font-semibold text-slate-600">
                          Campaign
                        </th>

                        <th className="px-5 py-3 text-left font-semibold text-slate-600">
                          Channel
                        </th>

                        <th className="px-5 py-3 text-right font-semibold text-slate-600">
                          Score
                        </th>

                        <th className="px-5 py-3 text-right font-semibold text-slate-600">
                          Revenue
                        </th>

                        <th className="px-5 py-3 text-right font-semibold text-slate-600">
                          Conversion
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
                      {strongestCampaigns.length > 0 ? (
                        strongestCampaigns.map(
                          (
                            campaign
                          ) => (
                            <tr
                              key={
                                campaign
                                  .campaign_key
                              }
                              className="hover:bg-slate-50"
                            >
                              <td className="px-5 py-4">
                                <div className="font-semibold text-slate-900">
                                  {
                                    campaign
                                      .campaign_name
                                  }
                                </div>

                                <div className="mt-1 text-xs text-slate-500">
                                  {formatDate(
                                    campaign
                                      .started_on
                                  )}{" "}
                                  –{" "}
                                  {formatDate(
                                    campaign
                                      .ended_on
                                  )}
                                </div>
                              </td>

                              <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                                {channelLabel(
                                  campaign
                                    .channel
                                )}
                              </td>

                              <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
                                {number(
                                  campaign
                                    .performance_score,
                                  1
                                )}
                              </td>

                              <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
                                {currency(
                                  campaign
                                    .value
                                    .net_attributed_revenue
                                )}
                              </td>

                              <td className="whitespace-nowrap px-5 py-4 text-right text-slate-700">
                                {percentage(
                                  campaign
                                    .rates
                                    .booking_conversion_rate
                                )}
                              </td>

                              <td className="whitespace-nowrap px-5 py-4">
                                <TrendBadge
                                  value={
                                    campaign
                                      .trend
                                  }
                                />
                              </td>

                              <td className="whitespace-nowrap px-5 py-4">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskClasses(
                                    campaign
                                      .risk
                                  )}`}
                                >
                                  {riskLabel(
                                    campaign
                                      .risk
                                  )}
                                </span>
                              </td>
                            </tr>
                          )
                        )
                      ) : (
                        <tr>
                          <td
                            colSpan="7"
                            className="px-5 py-10 text-center text-slate-500"
                          >
                            No campaign met the configured minimum
                            message volume.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>


              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    Analysis period:{" "}
                    <strong className="text-slate-700">
                      {formatDate(
                        insights
                          .analysis_start
                      )}
                    </strong>{" "}
                    to{" "}
                    <strong className="text-slate-700">
                      {formatDate(
                        insights
                          .analysis_end
                      )}
                    </strong>
                  </p>

                  <p>
                    Model:{" "}
                    <strong className="text-slate-700">
                      {
                        insights
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