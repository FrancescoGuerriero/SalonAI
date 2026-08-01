import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  ListChecks,
  LoaderCircle,
  RefreshCw,
  Scissors,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  Link,
  useSearchParams,
} from "react-router-dom";

import {
  getAiServiceStatus,
} from "../Services/haircareRecommendationService.js";
import {
  generateCustomerAiSummary,
} from "../Services/customerAiSummaryService.js";
import {
  getCustomerDisplayName,
  listCustomerProfiles,
} from "../Services/customerProfileService.js";

function customerId(customer) {
  return String(customer?._id || customer?.id || "").trim();
}

function extractCustomers(response) {
  const candidates = [
    response?.customers,
    response?.data?.customers,
    response?.data,
    response?.results,
  ];

  return (
    candidates.find(Array.isArray) ||
    (Array.isArray(response) ? response : [])
  );
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function errorMessage(error) {
  return (
    error?.data?.message ||
    error?.message ||
    "The AI summary could not be generated."
  );
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
                  ? "FastAPI is ready to generate customer briefings."
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

function SummaryList({ title, icon: Icon, items, emptyText, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-700",
    indigo: "border-indigo-200 bg-indigo-50/50 text-indigo-900",
    amber: "border-amber-200 bg-amber-50/60 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-900",
  };

  return (
    <article className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
          <Icon size={19} />
        </span>
        <h3 className="font-bold">{title}</h3>
      </div>

      {Array.isArray(items) && items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((item, index) => (
            <li
              key={`${title}-${index}-${item}`}
              className="flex items-start gap-3 text-sm leading-6"
            >
              <CheckCircle2 size={17} className="mt-1 shrink-0 opacity-70" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 opacity-70">{emptyText}</p>
      )}
    </article>
  );
}

function EmptySummary() {
  return (
    <section className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <BrainCircuit size={30} />
      </span>

      <h2 className="mt-5 text-xl font-bold text-slate-900">
        AI customer briefing
      </h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        Select a customer and generate an explainable briefing from authorised appointment, note, preference and retail history.
      </p>
    </section>
  );
}

function SummaryResult({ result }) {
  const summary = result?.summary;

  if (!summary) {
    return <EmptySummary />;
  }

  const confidence = Math.round((Number(summary.confidence) || 0) * 100);
  const source = result.source || {};

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
              <Sparkles size={14} />
              AI customer summary
            </span>

            <h2 className="mt-4 text-2xl font-bold text-slate-950">
              {summary.headline}
            </h2>

            <p className="mt-3 text-base leading-7 text-slate-700">
              {summary.executive_summary}
            </p>
          </div>

          <div className="rounded-2xl border border-white bg-white/90 px-5 py-4 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Confidence
            </p>
            <p className="mt-1 text-3xl font-bold text-indigo-700">
              {confidence}%
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            Appointments: {source.appointmentCount || 0}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            Notes: {source.noteCount || 0}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            Orders: {source.orderCount || 0}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            Generated {formatDateTime(result.generatedAt)}
          </span>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <SummaryList
          title="Preferences"
          icon={UserRound}
          items={summary.key_preferences}
          emptyText="No clear customer preferences are recorded."
          tone="indigo"
        />

        <SummaryList
          title="Service history"
          icon={Scissors}
          items={summary.service_history_insights}
          emptyText="There is not enough completed service history to identify a pattern."
        />

        <SummaryList
          title="Hair and safety"
          icon={ShieldCheck}
          items={summary.hair_and_safety_notes}
          emptyText="No hair or safety notes were available."
          tone="amber"
        />

        <SummaryList
          title="Recommended staff actions"
          icon={ListChecks}
          items={summary.relationship_actions}
          emptyText="No immediate customer relationship action was identified."
          tone="emerald"
        />

        <SummaryList
          title="Upcoming appointment focus"
          icon={CalendarDays}
          items={summary.upcoming_appointment_focus}
          emptyText="No upcoming appointment is currently recorded."
        />

        <SummaryList
          title="Product insights"
          icon={ShoppingBag}
          items={summary.product_insights}
          emptyText="No useful retail-product pattern was identified."
        />
      </section>

      {summary.data_quality_gaps?.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle size={21} className="mt-0.5 shrink-0 text-amber-700" />
            <div>
              <h3 className="font-bold text-amber-950">Data-quality gaps</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
                {summary.data_quality_gaps.map((item, index) => (
                  <li key={`${index}-${item}`}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-slate-700" />
          <p>
            Contact details, addresses, emergency contacts and private notes are not sent to the Python AI service. This briefing supports staff preparation and does not replace consultation, allergy checks or professional judgement.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function CustomerAiSummariesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    searchParams.get("customerId") || ""
  );
  const [style, setStyle] = useState("detailed");
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState("");

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError("");

    try {
      setStatus(await getAiServiceStatus());
    } catch (requestError) {
      setStatus(null);
      setStatusError(errorMessage(requestError));
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    setCustomerLoading(true);
    setError("");

    try {
      const response = await listCustomerProfiles({
        page: 1,
        limit: 100,
        sortBy: "updatedAt",
        sortDirection: "desc",
      });

      setCustomers(extractCustomers(response));
    } catch (requestError) {
      setCustomers([]);
      setError(errorMessage(requestError));
    } finally {
      setCustomerLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    void loadCustomers();
  }, [loadCustomers, loadStatus]);

  const filteredCustomers = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();

    if (!normalisedQuery) {
      return customers;
    }

    return customers.filter((customer) =>
      [
        getCustomerDisplayName(customer),
        customer.email,
        customer.phone,
        customerId(customer),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalisedQuery)
    );
  }, [customers, query]);

  const selectedCustomer = useMemo(
    () =>
      customers.find(
        (customer) => customerId(customer) === selectedCustomerId
      ) || null,
    [customers, selectedCustomerId]
  );

  function chooseCustomer(identifier) {
    setSelectedCustomerId(identifier);
    setResult(null);
    setError("");

    const next = new URLSearchParams(searchParams);
    if (identifier) {
      next.set("customerId", identifier);
    } else {
      next.delete("customerId");
    }
    setSearchParams(next, { replace: true });
  }

  async function handleGenerate() {
    if (!selectedCustomerId) {
      setError("Select a customer before generating the briefing.");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const response = await generateCustomerAiSummary(
        selectedCustomerId,
        { style }
      );
      setResult(response);
    } catch (requestError) {
      setResult(null);
      setError(errorMessage(requestError));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
              <BrainCircuit size={14} />
              Phase 4 AI
            </span>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
              AI customer summaries
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Prepare for appointments using an explainable summary of customer preferences, service history, hair and safety records, follow-ups, loyalty and retail activity.
            </p>
          </div>

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <FileText size={26} />
          </div>
        </div>
      </header>

      <StatusCard
        status={status}
        loading={statusLoading}
        error={statusError}
        onRefresh={() => void loadStatus()}
      />

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-6 xl:self-start">
          <div>
            <h2 className="font-bold text-slate-950">Choose customer</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Search the current customer database, then generate a fresh briefing.
            </p>
          </div>

          <label className="relative block">
            <span className="sr-only">Search customers</span>
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-3.5 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email or phone"
              className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {customerLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                <LoaderCircle size={18} className="animate-spin" />
                Loading customers…
              </div>
            ) : filteredCustomers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                No matching customer was found.
              </p>
            ) : (
              filteredCustomers.slice(0, 40).map((customer) => {
                const identifier = customerId(customer);
                const selected = identifier === selectedCustomerId;

                return (
                  <button
                    key={identifier}
                    type="button"
                    onClick={() => chooseCustomer(identifier)}
                    className={[
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                      selected
                        ? "border-indigo-300 bg-indigo-50"
                        : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        selected
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600",
                      ].join(" ")}
                    >
                      <UserRound size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {getCustomerDisplayName(customer)}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {customer.email || customer.phone || identifier}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {selectedCustomer ? (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                Selected customer
              </p>
              <p className="mt-1 font-bold text-indigo-950">
                {getCustomerDisplayName(selectedCustomer)}
              </p>
              <Link
                to={`/customers/${encodeURIComponent(selectedCustomerId)}`}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:text-indigo-900"
              >
                Open customer profile
                <ExternalLink size={15} />
              </Link>
            </div>
          ) : null}

          <div>
            <label htmlFor="summary-style" className="text-sm font-semibold text-slate-800">
              Summary detail
            </label>
            <select
              id="summary-style"
              value={style}
              onChange={(event) => setStyle(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="detailed">Detailed briefing</option>
              <option value="concise">Concise briefing</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={
              generating ||
              !selectedCustomerId ||
              status?.available !== true
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <Sparkles size={18} />
            )}
            {generating ? "Generating briefing…" : "Generate customer briefing"}
          </button>
        </aside>

        <SummaryResult result={result} />
      </section>
    </main>
  );
}
