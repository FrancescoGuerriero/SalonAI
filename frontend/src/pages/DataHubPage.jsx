import {
  BarChart3,
  CheckCircle2,
  Database,
  Eye,
  Layers3,
  Loader2,
  Play,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Table2,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  createDestination,
  createSavedView,
  getCatalogue,
  getFields,
  getOverview,
  listDestinationRuns,
  listDestinations,
  listSavedViews,
  previewDestination,
  runQuery,
  runSavedView,
} from "../Services/dataHubService.js";
import useAuth from "../hooks/useAuth.js";
import { hasPermission } from "../utils/permissions.js";

function errorMessage(error) {
  return error?.response?.data?.message || error?.message || "The Data Hub request could not be completed.";
}

function label(value) {
  return String(value || "")
    .replace(/^dimensions\.|^metrics\.|^attributes\./, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(parsed)
    : "—";
}

function rowValue(row, column) {
  if (column.key === "dateBucket") return row.dateBucket || "—";
  if (column.kind === "dimension") return row.dimensions?.[column.key] ?? "—";
  if (column.kind === "metric") return number(row.metrics?.[column.key.replace(/^metrics\./, "")]);
  if (column.kind === "calculated_metric") return number(row.calculated?.[column.key]);
  return "—";
}

function Stat({ icon: Icon, title, value, detail }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Icon size={19} className="text-indigo-600" />
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </article>
  );
}

function MultiSelect({ labelText, value, options, onChange, hint }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {labelText}
      <select
        multiple
        value={value}
        onChange={(event) => onChange(Array.from(event.target.selectedOptions).map((option) => option.value))}
        className="mt-2 min-h-32 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {hint ? <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}

export default function DataHubPage() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "feature-control:update");
  const [catalogue, setCatalogue] = useState(null);
  const [overview, setOverview] = useState(null);
  const [fieldCatalogue, setFieldCatalogue] = useState(null);
  const [savedViews, setSavedViews] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [runs, setRuns] = useState([]);
  const [queryResult, setQueryResult] = useState(null);
  const [destinationPreview, setDestinationPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState({
    sourceIds: [],
    dateRange: { rollingDays: 30 },
    dateGrain: "day",
    dimensions: ["provider"],
    metrics: [],
    calculatedMetrics: [],
    filters: [],
    rowLimit: 100,
  });
  const [viewName, setViewName] = useState("");
  const [destinationForm, setDestinationForm] = useState({
    name: "",
    view: "",
    type: "google_sheets",
    format: "table",
    writeMode: "replace",
    schedule: { cadence: "daily", timezone: "Europe/London" },
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [catalogueData, overviewData, fieldsData, viewsData, destinationData, runData] = await Promise.all([
        getCatalogue(),
        getOverview(),
        getFields(),
        listSavedViews(),
        listDestinations(),
        listDestinationRuns({ limit: 20 }),
      ]);
      setCatalogue(catalogueData);
      setOverview(overviewData);
      setFieldCatalogue(fieldsData);
      setSavedViews(viewsData);
      setDestinations(destinationData);
      setRuns(runData);
      setDestinationForm((current) => ({ ...current, view: current.view || viewsData[0]?._id || "" }));
      setQuery((current) => {
        if (current.metrics.length) return current;
        return {
          ...current,
          metrics: (fieldsData?.fields || [])
            .filter((field) => field.role === "metric")
            .slice(0, 4)
            .map((field) => field.path),
        };
      });
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const sourceOptions = useMemo(
    () => (fieldCatalogue?.sources || []).map((source) => ({
      value: String(source._id),
      label: `${source.name} · ${label(source.provider)}`,
    })),
    [fieldCatalogue]
  );
  const dimensionOptions = useMemo(
    () => (fieldCatalogue?.fields || [])
      .filter((field) => field.role === "dimension")
      .map((field) => ({ value: field.path, label: field.label || label(field.path) })),
    [fieldCatalogue]
  );
  const metricOptions = useMemo(
    () => (fieldCatalogue?.fields || [])
      .filter((field) => field.role === "metric")
      .map((field) => ({ value: field.path, label: field.label || label(field.path) })),
    [fieldCatalogue]
  );
  const calculatedOptions = useMemo(
    () => (fieldCatalogue?.calculatedMetrics || []).map((metric) => ({ value: metric.key, label: metric.label })),
    [fieldCatalogue]
  );
  const resultColumns = queryResult?.columns || [];
  const resultRows = queryResult?.rows || [];

  async function executeQuery() {
    setWorking("query"); setError(""); setSuccess("");
    try { setQueryResult(await runQuery(query)); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setWorking(""); }
  }

  async function saveView() {
    if (!viewName.trim()) return;
    setWorking("save-view"); setError(""); setSuccess("");
    try {
      const view = await createSavedView({ name: viewName, status: "active", query });
      setSavedViews((current) => [view, ...current]);
      setDestinationForm((current) => ({ ...current, view: current.view || view._id }));
      setViewName("");
      setSuccess("Saved Data Hub view created.");
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setWorking(""); }
  }

  async function executeSavedView(viewId) {
    setWorking(`view:${viewId}`); setError("");
    try { setQueryResult(await runSavedView(viewId)); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setWorking(""); }
  }

  async function addDestination(event) {
    event.preventDefault();
    setWorking("destination"); setError(""); setSuccess("");
    try {
      const created = await createDestination({ ...destinationForm, status: "ready" });
      setDestinations((current) => [created, ...current]);
      setDestinationForm((current) => ({ ...current, name: "" }));
      setSuccess("Destination task saved in governed preview mode.");
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setWorking(""); }
  }

  async function previewTask(taskId) {
    setWorking(`destination:${taskId}`); setError(""); setSuccess("");
    try {
      const result = await previewDestination(taskId);
      setDestinationPreview(result);
      setRuns(await listDestinationRuns({ limit: 20 }));
      setSuccess("Destination preview generated without an external write.");
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setWorking(""); }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-8" id="main-content" tabIndex="-1">
        <Loader2 className="mx-auto mt-24 animate-spin text-indigo-600" size={32} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-indigo-700"><Sparkles size={18} /> AIIBP evidence layer</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">AIIBP Data Hub</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                Connect tenant-owned business data, blend cross-channel facts, build reusable reports and prepare governed destination exports and AI evidence from one canonical data layer.
              </p>
            </div>
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3 text-sm leading-6 text-emerald-950">
            <ShieldCheck size={20} className="mt-0.5 shrink-0" />
            <p><strong>Governed mode.</strong> Queries use tenant-scoped normalised records and preserve source provenance. Destination tasks can be configured and previewed, but live external writes and AI actions remain disabled until separately approved and activated.</p>
          </div>
        </section>

        {error ? <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</section> : null}
        {success ? <section role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white p-4 text-sm font-semibold text-emerald-800"><CheckCircle2 size={17} />{success}</section> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat icon={Database} title="Connected sources" value={overview?.sources || 0} detail="AIIBP ingestion authority" />
          <Stat icon={Layers3} title="Normalised records" value={overview?.normalisedRecords || 0} detail="Query-ready canonical facts" />
          <Stat icon={Table2} title="Saved views" value={overview?.savedViews || savedViews.length} detail="Reusable BI definitions" />
          <Stat icon={Workflow} title="Destination tasks" value={overview?.destinationTasks || destinations.length} detail="Governed external delivery" />
          <Stat icon={Eye} title="Export previews" value={overview?.destinationPreviews || runs.length} detail="Auditable preview ledger" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><BarChart3 size={19} className="text-indigo-600" /><h2 className="text-xl font-bold text-slate-900">Cross-source query builder</h2></div>
            <p className="mt-1 text-sm text-slate-500">Leave sources empty to query every source in the active Business/Location scope.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <MultiSelect labelText="Sources" value={query.sourceIds} options={sourceOptions} onChange={(value) => setQuery((current) => ({ ...current, sourceIds: value }))} hint="Ctrl/Cmd-click for multiple sources." />
              <label className="text-sm font-semibold text-slate-700">Date grain
                <select value={query.dateGrain} onChange={(event) => setQuery((current) => ({ ...current, dateGrain: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option value="day">Day</option><option value="week">Week</option><option value="month">Month</option><option value="none">No date grouping</option>
                </select>
              </label>
              <MultiSelect labelText="Dimensions" value={query.dimensions} options={dimensionOptions} onChange={(value) => setQuery((current) => ({ ...current, dimensions: value }))} />
              <MultiSelect labelText="Metrics" value={query.metrics} options={metricOptions} onChange={(value) => setQuery((current) => ({ ...current, metrics: value }))} />
              <div className="sm:col-span-2"><MultiSelect labelText="Calculated metrics" value={query.calculatedMetrics} options={calculatedOptions} onChange={(value) => setQuery((current) => ({ ...current, calculatedMetrics: value }))} hint="Calculated from canonical base facts; AI does not redefine deterministic formulas." /></div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => void executeQuery()} disabled={working === "query"} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {working === "query" ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Run query
              </button>
              {canManage ? <div className="flex min-w-0 flex-1 gap-2"><input value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="Saved view name" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /><button type="button" onClick={() => void saveView()} disabled={!viewName.trim() || working === "save-view"} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold disabled:opacity-50"><Save size={16} /> Save</button></div> : null}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden">
            <h2 className="text-xl font-bold text-slate-900">Query results</h2>
            <p className="mt-1 text-sm text-slate-500">{queryResult?.meta?.rowCount ?? 0} row(s) from tenant-scoped normalised evidence.</p>
            <div className="mt-4 overflow-auto">
              {resultColumns.length ? (
                <table className="min-w-full text-left text-xs"><thead><tr>{resultColumns.map((column) => <th className="border-b p-2" key={`${column.kind}:${column.key}`}>{column.label || label(column.key)}</th>)}</tr></thead><tbody>{resultRows.map((row, index) => <tr key={row.key || index}>{resultColumns.map((column) => <td className="border-b p-2" key={`${index}:${column.kind}:${column.key}`}>{rowValue(row, column)}</td>)}</tr>)}</tbody></table>
              ) : <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Run a query or saved view to inspect results.</div>}
            </div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Saved views</h2>
            <div className="mt-4 space-y-2">
              {savedViews.length ? savedViews.map((view) => (
                <button key={view._id} type="button" onClick={() => void executeSavedView(view._id)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm hover:bg-slate-50">
                  <span><strong>{view.name}</strong><span className="ml-2 text-xs text-slate-500">{view.status}</span></span>{working === `view:${view._id}` ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                </button>
              )) : <p className="text-sm text-slate-500">No saved views yet.</p>}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Destination tasks</h2>
            <p className="mt-1 text-sm text-slate-500">Configure scheduled destinations through AIIBP. Preview remains auditable and live export activation stays separately governed.</p>
            {canManage ? (
              <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={addDestination}>
                <input required placeholder="Destination name" value={destinationForm.name} onChange={(event) => setDestinationForm((current) => ({ ...current, name: event.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
                <select required value={destinationForm.view} onChange={(event) => setDestinationForm((current) => ({ ...current, view: event.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="">Select saved view</option>{savedViews.map((view) => <option key={view._id} value={view._id}>{view.name}</option>)}</select>
                <select value={destinationForm.type} onChange={(event) => setDestinationForm((current) => ({ ...current, type: event.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">{(catalogue?.destinations || ["google_sheets", "bigquery", "s3", "webhook"]).map((type) => <option key={type.key || type} value={type.key || type}>{type.label || label(type.key || type)}</option>)}</select>
                <select value={destinationForm.schedule.cadence} onChange={(event) => setDestinationForm((current) => ({ ...current, schedule: { ...current.schedule, cadence: event.target.value } }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="manual">Manual</option><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select>
                <button disabled={!destinationForm.view || working === "destination"} className="sm:col-span-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" type="submit">Save destination task</button>
              </form>
            ) : null}
            <div className="mt-4 space-y-2">
              {destinations.map((task) => <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3" key={task._id}><div><div className="text-sm font-bold">{task.name}</div><div className="text-xs text-slate-500">{label(task.type)} · {task.schedule?.cadence || "manual"} · {task.status}</div></div><button type="button" onClick={() => void previewTask(task._id)} disabled={working === `destination:${task._id}`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold">Preview</button></div>)}
            </div>
          </article>
        </section>

        {destinationPreview ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Destination preview</h2><pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(destinationPreview, null, 2)}</pre></section> : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Source connector catalogue</h2>
          <p className="mt-1 text-sm text-slate-500">AIIBP native and managed connection contracts available to the Data Hub, subject to tenant entitlement and provider configuration.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(catalogue?.connectors || catalogue?.sources || []).map((connector) => <div className="rounded-xl border border-slate-200 p-3" key={connector.key || connector.provider}><div className="text-sm font-bold">{connector.label || label(connector.key || connector.provider)}</div><div className="mt-1 text-xs text-slate-500">{connector.status || connector.kind || "available"}</div></div>)}
          </div>
        </section>
      </div>
    </main>
  );
}
