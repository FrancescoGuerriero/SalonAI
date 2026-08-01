import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Database, Download, FileJson, FileSpreadsheet } from "lucide-react";

import { exportDataset, getAuditEvents } from "../Services/dataExportAuditService.js";
import { EmptyState, ErrorBanner, FeatureHeader, LoadingPanel, Pill, SummaryCard } from "../shared/FutureUi.jsx";
import { formatDateTime, getErrorMessage } from "../shared/formatters.js";

const datasets = [
  { key: "appointments", label: "Appointments" },
  { key: "campaigns", label: "Rebooking campaigns" },
  { key: "inventory", label: "Inventory" },
  { key: "feedback", label: "Customer feedback" },
];

export default function DataExportAuditPage() {
  const [events, setEvents] = useState([]);
  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (initial = false) => { initial ? setLoading(true) : setRefreshing(true); setError(""); try { const response = await getAuditEvents({ limit: 100 }); setEvents(response?.events || []); } catch (requestError) { setError(getErrorMessage(requestError, "Unable to load the audit trail.")); } finally { setLoading(false); setRefreshing(false); } }, []);
  useEffect(() => { load(true); }, [load]);

  async function runExport(dataset, format) {
    const key = `${dataset}-${format}`; setExporting(key); setError("");
    try { await exportDataset(dataset, { format, months }); await load(); }
    catch (requestError) { setError(getErrorMessage(requestError, "Unable to export the selected dataset.")); }
    finally { setExporting(""); }
  }

  const recordCount = events.reduce((total, event) => total + Number(event.recordCount || 0), 0);

  return <main className="space-y-7 p-6">
    <FeatureHeader icon={Database} title="Data Export and Audit Centre" description="Export operational datasets as CSV or JSON and retain a traceable record of export activity." onRefresh={() => load()} refreshing={refreshing} />
    <ErrorBanner message={error} />
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard title="Audit events" value={events.length} description="Export events in the current view" icon={ClipboardList} loading={loading} /><SummaryCard title="Records exported" value={recordCount} description="Total rows across listed exports" icon={Database} loading={loading} /><SummaryCard title="CSV support" value="Yes" description="Spreadsheet-compatible downloads" icon={FileSpreadsheet} loading={loading} /><SummaryCard title="JSON support" value="Yes" description="Structured application data" icon={FileJson} loading={loading} /></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-bold">Export datasets</h2><p className="mt-1 text-sm text-slate-500">The browser downloads the generated file directly.</p></div><label className="text-sm font-semibold">Months <select value={months} onChange={(event) => setMonths(Number(event.target.value))} className="ml-2 rounded-lg border p-2"><option value={3}>3</option><option value={6}>6</option><option value={12}>12</option><option value={24}>24</option><option value={60}>60</option></select></label></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{datasets.map((dataset) => <article key={dataset.key} className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold">{dataset.label}</h3><div className="mt-4 flex gap-2"><button type="button" onClick={() => runExport(dataset.key, "csv")} disabled={Boolean(exporting)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"><Download size={14} />{exporting === `${dataset.key}-csv` ? "Working" : "CSV"}</button><button type="button" onClick={() => runExport(dataset.key, "json")} disabled={Boolean(exporting)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"><Download size={14} />{exporting === `${dataset.key}-json` ? "Working" : "JSON"}</button></div></article>)}</div></section>
    {loading ? <LoadingPanel /> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="border-b p-5"><h2 className="text-xl font-bold">Export audit trail</h2></header>{events.length === 0 ? <EmptyState icon={ClipboardList} title="No audit events" description="Run the first dataset export above." /> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{["Time", "Dataset", "Format", "Records", "Actor", "Action"].map((heading) => <th key={heading} className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-500">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{events.map((event) => <tr key={event._id}><td className="px-5 py-4">{formatDateTime(event.createdAt)}</td><td className="px-5 py-4 capitalize">{event.dataset}</td><td className="px-5 py-4"><Pill tone="blue">{event.format}</Pill></td><td className="px-5 py-4">{event.recordCount}</td><td className="px-5 py-4">{event.actor?.email || event.actor?.role || "Authenticated user"}</td><td className="px-5 py-4">{event.action}</td></tr>)}</tbody></table></div>}</section>}
  </main>;
}
