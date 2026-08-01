import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  BadgePercent,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Crown,
  Download,
  ExternalLink,
  Gem,
  LoaderCircle,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserMinus,
  UsersRound,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Link } from "react-router-dom";

import {
  getAiServiceStatus,
} from "../Services/haircareRecommendationService.js";
import {
  getAiCustomerSegmentation,
} from "../Services/aiCustomerSegmentationService.js";

const DEFAULT_THRESHOLDS = {
  newCustomerDays: 45,
  loyalCompletedVisits: 6,
  loyalRebookingRate: 0.6,
  highValueSpend: 750,
  highValueAverageSpend: 120,
  inactiveDays: 180,
  atRiskDays: 90,
  discountUsageRate: 0.5,
};

const SEGMENTS = [
  {
    key: "all",
    label: "All customers",
    description: "Every customer analysed in this run.",
    icon: UsersRound,
    classes: "border-slate-200 bg-slate-50 text-slate-700",
  },
  {
    key: "new",
    label: "New",
    description: "Newly created relationships requiring welcome and rebooking support.",
    icon: Sparkles,
    classes: "border-sky-200 bg-sky-50 text-sky-700",
  },
  {
    key: "loyal",
    label: "Loyal",
    description: "Frequent customers with strong rebooking behaviour.",
    icon: Crown,
    classes: "border-violet-200 bg-violet-50 text-violet-700",
  },
  {
    key: "high_value",
    label: "High value",
    description: "Customers with high recorded service or retail value.",
    icon: Gem,
    classes: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  {
    key: "at_risk",
    label: "At risk",
    description: "Customers whose recency or booking behaviour indicates retention risk.",
    icon: TrendingUp,
    classes: "border-amber-200 bg-amber-50 text-amber-800",
  },
  {
    key: "inactive",
    label: "Inactive",
    description: "Customers beyond the inactivity threshold without a future booking.",
    icon: UserMinus,
    classes: "border-rose-200 bg-rose-50 text-rose-700",
  },
  {
    key: "discount_sensitive",
    label: "Discount sensitive",
    description: "Customers whose completed visits frequently use discounts.",
    icon: BadgePercent,
    classes: "border-orange-200 bg-orange-50 text-orange-700",
  },
  {
    key: "active",
    label: "Active",
    description: "Customers without a specialist segment trigger.",
    icon: Activity,
    classes: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
];

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(number(value));
}

function formatPercent(value) {
  return `${Math.round(number(value) * 100)}%`;
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function segmentDefinition(key) {
  return (
    SEGMENTS.find((item) => item.key === key) ||
    SEGMENTS[0]
  );
}

function errorMessage(error) {
  return (
    error?.data?.message ||
    error?.message ||
    "Customer segmentation could not be generated."
  );
}

function csvValue(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(rows) {
  const headings = [
    "Customer",
    "Primary segment",
    "All segments",
    "Service spend",
    "Retail spend",
    "Completed appointments",
    "Days since last visit",
    "Rebooking rate",
    "Risk score",
    "Value score",
    "Recommended action",
  ];

  const lines = [
    headings.map(csvValue).join(","),
    ...rows.map((row) =>
      [
        row.displayName,
        row.analysis?.primary_segment,
        row.analysis?.segments?.join(" | "),
        row.metrics?.serviceSpend,
        row.metrics?.retailSpend,
        row.metrics?.completedAppointments,
        row.metrics?.daysSinceLastVisit ?? "",
        row.metrics?.rebookingRate,
        row.analysis?.risk_score,
        row.analysis?.value_score,
        row.analysis?.recommended_action,
      ]
        .map(csvValue)
        .join(",")
    ),
  ];

  const blob = new Blob([lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `salonai-ai-customer-segments-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function StatusCard({ status, loading, error, onRefresh }) {
  const available = status?.available === true;

  return (
    <section
      className={[
        "rounded-2xl border p-5 shadow-sm",
        available
          ? "border-emerald-200 bg-emerald-50"
          : "border-amber-200 bg-amber-50",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={[
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              available
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700",
            ].join(" ")}
          >
            {available ? <Wifi size={22} /> : <WifiOff size={22} />}
          </span>

          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {available ? "AI service ready" : "AI service unavailable"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {loading
                ? "Checking the Python AI service…"
                : available
                  ? "FastAPI is ready to analyse customer behaviour."
                  : error || status?.error || "Start the Python service on port 8000."}
            </p>
            {status?.checkedAt ? (
              <p className="mt-1 text-xs text-slate-500">
                Last checked {formatDateTime(status.checkedAt)}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Check connection
        </button>
      </div>
    </section>
  );
}

function MetricCard({ definition, count, selected, onClick }) {
  const Icon = definition.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border p-4 text-left shadow-sm transition",
        definition.classes,
        selected
          ? "ring-2 ring-slate-900/10"
          : "hover:-translate-y-0.5 hover:shadow-md",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-sm">
          <Icon size={19} />
        </span>
        <span className="text-2xl font-black">{count}</span>
      </div>
      <h3 className="mt-4 font-bold">{definition.label}</h3>
      <p className="mt-1 text-xs leading-5 opacity-80">
        {definition.description}
      </p>
    </button>
  );
}

function ThresholdInput({ label, value, onChange, step = 1, suffix }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <div className="mt-1 flex rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
        <input
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border-0 px-3 py-2 text-sm outline-none"
        />
        {suffix ? (
          <span className="flex items-center border-l border-slate-200 px-3 text-xs font-semibold text-slate-500">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}

function CustomerRow({ row }) {
  const analysis = row.analysis || {};
  const primary = segmentDefinition(analysis.primary_segment);
  const PrimaryIcon = primary.icon;
  const metrics = row.metrics || {};

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-slate-950">
              {row.displayName}
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${primary.classes}`}
            >
              <PrimaryIcon size={13} />
              {primary.label}
            </span>
          </div>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {analysis.explanation || "No AI explanation was returned."}
          </p>
        </div>

        <Link
          to={`/customers/${encodeURIComponent(row.customerId)}`}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Open profile
          <ExternalLink size={15} />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">Total value</p>
          <p className="mt-1 font-bold text-slate-900">
            {formatCurrency(
              number(metrics.serviceSpend) + number(metrics.retailSpend)
            )}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">Completed visits</p>
          <p className="mt-1 font-bold text-slate-900">
            {metrics.completedAppointments || 0}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">Last visit</p>
          <p className="mt-1 font-bold text-slate-900">
            {metrics.daysSinceLastVisit === null ||
            metrics.daysSinceLastVisit === undefined
              ? "Not recorded"
              : `${metrics.daysSinceLastVisit} days ago`}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">Rebooking</p>
          <p className="mt-1 font-bold text-slate-900">
            {formatPercent(metrics.rebookingRate)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">Risk / value</p>
          <p className="mt-1 font-bold text-slate-900">
            {formatPercent(analysis.risk_score)} / {formatPercent(analysis.value_score)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
            Recommended action
          </p>
          <p className="mt-2 text-sm leading-6 text-indigo-950">
            {analysis.recommended_action}
          </p>
          <p className="mt-2 text-xs font-semibold text-indigo-700">
            Channel: {analysis.recommended_channel || "staff follow-up"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
            Evidence signals
          </p>
          <ul className="mt-2 space-y-2">
            {(analysis.signals || []).slice(0, 3).map((signal) => (
              <li
                key={signal}
                className="flex items-start gap-2 text-sm leading-5 text-slate-700"
              >
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                <span>{signal}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

export default function AiCustomerSegmentationPage() {
  const [serviceStatus, setServiceStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("risk-desc");
  const [showSettings, setShowSettings] = useState(false);
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);

  const checkStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError("");

    try {
      const response = await getAiServiceStatus();
      setServiceStatus(response);
    } catch (statusRequestError) {
      setServiceStatus(null);
      setStatusError(errorMessage(statusRequestError));
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getAiCustomerSegmentation({
        limit: 300,
        lookbackDays: 730,
        thresholds,
      });
      setResult(response);
    } catch (analysisError) {
      setError(errorMessage(analysisError));
    } finally {
      setLoading(false);
    }
  }, [thresholds]);

  useEffect(() => {
    checkStatus();
    runAnalysis();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = (result?.customers || []).filter((row) => {
      const matchesSegment =
        selectedSegment === "all" ||
        row.analysis?.segments?.includes(selectedSegment);
      const matchesSearch =
        !query ||
        row.displayName?.toLowerCase().includes(query) ||
        row.analysis?.explanation?.toLowerCase().includes(query);

      return matchesSegment && matchesSearch;
    });

    return filtered.sort((left, right) => {
      if (sort === "value-desc") {
        return number(right.analysis?.value_score) - number(left.analysis?.value_score);
      }
      if (sort === "spend-desc") {
        const rightSpend = number(right.metrics?.serviceSpend) + number(right.metrics?.retailSpend);
        const leftSpend = number(left.metrics?.serviceSpend) + number(left.metrics?.retailSpend);
        return rightSpend - leftSpend;
      }
      if (sort === "name-asc") {
        return String(left.displayName).localeCompare(String(right.displayName));
      }
      return number(right.analysis?.risk_score) - number(left.analysis?.risk_score);
    });
  }, [result, search, selectedSegment, sort]);

  const totalCustomers = result?.source?.customerCount || 0;
  const overview = result?.overview || {};

  function setThreshold(key, value) {
    setThresholds((current) => ({
      ...current,
      [key]: Math.max(0, number(value)),
    }));
  }

  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <BrainCircuit size={25} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
                Phase 4 artificial intelligence
              </p>
              <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">
                AI Customer Segmentation
              </h1>
            </div>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-600">
            Analyse recency, frequency, value, rebooking, discount usage and engagement to identify actionable customer groups. Results are explainable and generated on demand.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowSettings((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Settings2 size={17} />
            Thresholds
          </button>
          <button
            type="button"
            onClick={() => downloadCsv(rows)}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={17} />
            Export view
          </button>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading || serviceStatus?.available === false}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <RefreshCw size={17} />
            )}
            Run analysis
          </button>
        </div>
      </header>

      <StatusCard
        status={serviceStatus}
        loading={statusLoading}
        error={statusError}
        onRefresh={checkStatus}
      />

      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck size={21} className="mt-0.5 shrink-0 text-indigo-700" />
          <div>
            <h2 className="font-bold text-indigo-950">Privacy-preserving analysis</h2>
            <p className="mt-1 text-sm leading-6 text-indigo-900/80">
              Names, email addresses, phone numbers, postal addresses and free-text notes remain in Express. FastAPI receives only an anonymous customer reference and calculated operational metrics.
            </p>
          </div>
        </div>
      </section>

      {showSettings ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-950">Segmentation thresholds</h2>
              <p className="mt-1 text-sm text-slate-500">
                Changes apply to the next analysis run and do not alter customer records.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setThresholds(DEFAULT_THRESHOLDS)}
              className="text-sm font-bold text-indigo-700 hover:text-indigo-900"
            >
              Restore defaults
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ThresholdInput
              label="New customer window"
              value={thresholds.newCustomerDays}
              suffix="days"
              onChange={(value) => setThreshold("newCustomerDays", value)}
            />
            <ThresholdInput
              label="Loyal completed visits"
              value={thresholds.loyalCompletedVisits}
              suffix="visits"
              onChange={(value) => setThreshold("loyalCompletedVisits", value)}
            />
            <ThresholdInput
              label="Loyal rebooking rate"
              value={thresholds.loyalRebookingRate}
              step="0.05"
              suffix="0–1"
              onChange={(value) => setThreshold("loyalRebookingRate", value)}
            />
            <ThresholdInput
              label="High-value spend"
              value={thresholds.highValueSpend}
              suffix="GBP"
              onChange={(value) => setThreshold("highValueSpend", value)}
            />
            <ThresholdInput
              label="High-value average"
              value={thresholds.highValueAverageSpend}
              suffix="GBP"
              onChange={(value) => setThreshold("highValueAverageSpend", value)}
            />
            <ThresholdInput
              label="Inactive threshold"
              value={thresholds.inactiveDays}
              suffix="days"
              onChange={(value) => setThreshold("inactiveDays", value)}
            />
            <ThresholdInput
              label="At-risk threshold"
              value={thresholds.atRiskDays}
              suffix="days"
              onChange={(value) => setThreshold("atRiskDays", value)}
            />
            <ThresholdInput
              label="Discount usage rate"
              value={thresholds.discountUsageRate}
              step="0.05"
              suffix="0–1"
              onChange={(value) => setThreshold("discountUsageRate", value)}
            />
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {SEGMENTS.map((definition) => (
          <MetricCard
            key={definition.key}
            definition={definition}
            count={
              definition.key === "all"
                ? totalCustomers
                : overview[definition.key] || 0
            }
            selected={selectedSegment === definition.key}
            onClick={() => setSelectedSegment(definition.key)}
          />
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[240px] flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customers or AI explanations"
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="risk-desc">Highest risk first</option>
            <option value="value-desc">Highest value score</option>
            <option value="spend-desc">Highest recorded spend</option>
            <option value="name-asc">Customer name A–Z</option>
          </select>

          <div className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-600">
            {rows.length} result{rows.length === 1 ? "" : "s"}
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 shadow-sm">
          <p className="font-bold">Analysis failed</p>
          <p className="mt-1 leading-6">{error}</p>
        </section>
      ) : null}

      {loading ? (
        <section className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <LoaderCircle size={34} className="animate-spin text-indigo-600" />
          <h2 className="mt-4 text-lg font-bold text-slate-900">
            Analysing customer behaviour
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Express is preparing anonymous behavioural features for FastAPI.
          </p>
        </section>
      ) : rows.length > 0 ? (
        <section className="space-y-4">
          {rows.map((row) => (
            <CustomerRow key={row.customerId} row={row} />
          ))}
        </section>
      ) : (
        <section className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <CalendarClock size={34} className="text-slate-400" />
          <h2 className="mt-4 text-lg font-bold text-slate-900">
            No matching customers
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            Run the analysis, change the selected segment or clear the search term.
          </p>
        </section>
      )}

      {result ? (
        <footer className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              Generated {formatDateTime(result.generatedAt)} from {result.source?.appointmentCount || 0} appointments, {result.source?.orderCount || 0} retail orders and {result.source?.contactCount || 0} communication records.
            </p>
            <p className="inline-flex items-center gap-2 font-semibold text-slate-600">
              <BrainCircuit size={14} />
              {result.metadata?.model_name || "Explainable segmentation model"}
            </p>
          </div>
        </footer>
      ) : null}
    </main>
  );
}
