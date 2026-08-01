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
  ClipboardList,
  HeartPulse,
  Home,
  LoaderCircle,
  PackageSearch,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  CHEMICAL_SERVICES,
  generateHaircareRecommendation,
  getAiServiceStatus,
  HAIR_CONCERNS,
  HAIR_TEXTURES,
  HAIR_TYPES,
  MAINTENANCE_PREFERENCES,
} from "../Services/haircareRecommendationService.js";

const INITIAL_FORM = {
  customerId: "",
  hairType: "",
  texture: "medium",
  concerns: [],
  chemicalServices: [],
  heatStylingPerWeek: 0,
  maintenancePreference: "medium",
  scalpSensitive: false,
  notes: "",
};

function formatLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
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

function getErrorMessage(error) {
  return (
    error?.data?.message ||
    error?.details?.message ||
    error?.message ||
    "The request could not be completed."
  );
}

function ChoiceGrid({
  legend,
  options,
  selected,
  onToggle,
  columns = "sm:grid-cols-2 lg:grid-cols-3",
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-800">
        {legend}
      </legend>

      <div className={`mt-3 grid gap-2 ${columns}`}>
        {options.map((option) => {
          const checked = selected.includes(option.value);

          return (
            <label
              key={option.value}
              className={[
                "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition",
                checked
                  ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-slate-50",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(option.value)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />

              <span className="font-medium">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function StatusPanel({ status, loading, error, onRefresh }) {
  const available = status?.available === true;
  const providerMode =
    status?.readiness?.providerMode ||
    status?.readiness?.provider_mode ||
    "unknown";

  return (
    <aside
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
            <p className="text-sm font-bold text-slate-900">
              {available ? "AI service ready" : "AI service unavailable"}
            </p>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              {loading
                ? "Checking the Python service…"
                : available
                  ? `FastAPI is connected in ${providerMode} mode.`
                  : error || status?.error || "Start the AI service and verify the shared key."}
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
    </aside>
  );
}

function RecommendationPanel({ recommendation }) {
  const services = recommendation?.recommended_services || [];
  const products = recommendation?.product_categories || [];
  const steps = recommendation?.homecare_steps || [];
  const cautions = recommendation?.cautions || [];
  const confidence = Math.round((Number(recommendation?.confidence) || 0) * 100);
  const metadata = recommendation?.metadata || {};
  const rules = metadata.rules_applied || [];

  if (!recommendation) {
    return (
      <section className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <BrainCircuit size={30} />
        </span>

        <h2 className="mt-5 text-xl font-bold text-slate-900">
          Recommendation results
        </h2>

        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          Complete the consultation form to generate an explainable salon and homecare plan through the Python AI service.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <article className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
              <Sparkles size={14} />
              AI recommendation
            </div>

            <h2 className="mt-4 text-2xl font-bold text-slate-950">
              Personalised haircare plan
            </h2>

            <p className="mt-3 text-base leading-7 text-slate-700">
              {recommendation.summary}
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
            Model: {metadata.model_name || "Not reported"}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            Provider: {metadata.provider_mode || "unknown"}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            Generated: {formatDateTime(recommendation.generatedAt)}
          </span>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Scissors size={20} />
          </span>
          <div>
            <h3 className="font-bold text-slate-900">Recommended salon services</h3>
            <p className="text-sm text-slate-500">Prioritised professional actions with reasons.</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {services.length > 0 ? (
            services.map((service) => (
              <div
                key={`${service.priority}-${service.name}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                    {service.priority}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{service.name}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{service.reason}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No salon services were returned.</p>
          )}
        </div>
      </article>

      <div className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <PackageSearch size={20} />
            </span>
            <h3 className="font-bold text-slate-900">Product categories</h3>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {products.length > 0 ? (
              products.map((product) => (
                <span
                  key={product}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
                >
                  {product}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-500">No product categories were returned.</p>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Home size={20} />
            </span>
            <h3 className="font-bold text-slate-900">Homecare routine</h3>
          </div>

          <div className="mt-5 space-y-4">
            {steps.length > 0 ? (
              steps.map((step) => (
                <div key={step.title} className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
                  <p className="font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{step.guidance}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-sky-700">
                    {step.frequency}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No homecare steps were returned.</p>
            )}
          </div>
        </article>
      </div>

      {cautions.length > 0 ? (
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-700" size={22} />
            <div>
              <h3 className="font-bold text-amber-950">Safety cautions</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
                {cautions.map((caution) => (
                  <li key={caution} className="flex items-start gap-2">
                    <span aria-hidden="true">•</span>
                    <span>{caution}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      ) : null}

      {rules.length > 0 ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <ShieldCheck size={18} className="text-indigo-600" />
            Explainability rules applied
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {rules.map((rule) => (
              <span
                key={rule}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600"
              >
                {formatLabel(rule)}
              </span>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}

export default function HaircareRecommendationsPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [recommendation, setRecommendation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const canSubmit = useMemo(
    () => Boolean(form.hairType) && status?.available === true && !submitting,
    [form.hairType, status?.available, submitting]
  );

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError("");

    try {
      const result = await getAiServiceStatus();
      setStatus(result);
    } catch (error) {
      setStatus(null);
      setStatusError(getErrorMessage(error));
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleListValue(field, value) {
    setForm((current) => {
      const selected = current[field];
      let next;

      if (field === "chemicalServices" && value === "none") {
        next = selected.includes("none") ? [] : ["none"];
      } else {
        const withoutNone = selected.filter((item) => item !== "none");
        next = withoutNone.includes(value)
          ? withoutNone.filter((item) => item !== value)
          : [...withoutNone, value];
      }

      return {
        ...current,
        [field]: next,
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");
    setSubmitting(true);

    try {
      const result = await generateHaircareRecommendation(form);
      setRecommendation(result);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm(INITIAL_FORM);
    setRecommendation(null);
    setSubmitError("");
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-indigo-700">
              <BrainCircuit size={15} />
              Phase 4 AI
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Haircare recommendations
            </h1>

            <p className="mt-3 text-base leading-7 text-slate-600">
              Generate an explainable salon and homecare plan using the protected Express-to-FastAPI integration. Recommendations support professional consultation and do not provide a medical diagnosis.
            </p>
          </div>

          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw size={17} />
            New consultation
          </button>
        </div>
      </header>

      <StatusPanel
        status={status}
        loading={statusLoading}
        error={statusError}
        onRefresh={refreshStatus}
      />

      <div className="mt-6 grid items-start gap-6 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7"
        >
          <div className="flex items-start gap-3 border-b border-slate-100 pb-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ClipboardList size={21} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Consultation details</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Hair type is required. All other fields improve the recommendation quality.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">Customer ID</span>
              <input
                type="text"
                value={form.customerId}
                onChange={(event) => updateField("customerId", event.target.value)}
                placeholder="Optional customer reference"
                maxLength={100}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-800">
                Hair type <span className="text-rose-600">*</span>
              </span>
              <select
                value={form.hairType}
                required
                onChange={(event) => updateField("hairType", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Select hair type</option>
                {HAIR_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-800">Texture</span>
              <select
                value={form.texture}
                onChange={(event) => updateField("texture", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {HAIR_TEXTURES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-800">Maintenance preference</span>
              <select
                value={form.maintenancePreference}
                onChange={(event) => updateField("maintenancePreference", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {MAINTENANCE_PREFERENCES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ChoiceGrid
            legend="Hair concerns"
            options={HAIR_CONCERNS}
            selected={form.concerns}
            onToggle={(value) => toggleListValue("concerns", value)}
          />

          <ChoiceGrid
            legend="Recent chemical services"
            options={CHEMICAL_SERVICES}
            selected={form.chemicalServices}
            onToggle={(value) => toggleListValue("chemicalServices", value)}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">Heat styling per week</span>
              <input
                type="number"
                min="0"
                max="14"
                step="1"
                value={form.heatStylingPerWeek}
                onChange={(event) => updateField("heatStylingPerWeek", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="mt-7 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={form.scalpSensitive}
                onChange={(event) => updateField("scalpSensitive", event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800">Sensitive scalp</span>
                <span className="mt-0.5 block text-xs text-slate-500">Adds patch-testing and irritation cautions.</span>
              </span>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-slate-800">Consultation notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Describe current routine, styling habits, breakage, recent services or goals."
              className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <span className="mt-1 block text-right text-xs text-slate-400">
              {form.notes.length}/1000
            </span>
          </label>

          {submitError ? (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <AlertTriangle size={19} className="mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
            <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <HeartPulse size={16} className="mt-0.5 shrink-0 text-slate-400" />
              <span>Persistent scalp inflammation or unexplained hair loss requires clinical assessment.</span>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
              {submitting ? "Generating…" : "Generate recommendation"}
            </button>
          </div>

          {!statusLoading && status?.available !== true ? (
            <p className="text-right text-xs font-medium text-amber-700">
              The Generate button is disabled until the AI service is ready.
            </p>
          ) : null}
        </form>

        <RecommendationPanel recommendation={recommendation} />
      </div>

      <footer className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-indigo-600" />
          <p className="text-sm leading-6 text-slate-600">
            This Phase 4 screen sends authenticated requests to Express. Express validates the data and calls FastAPI using the private service key, so the browser never receives the AI service credential.
          </p>
        </div>
      </footer>
    </main>
  );
}
