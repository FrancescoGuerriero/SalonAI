import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, SearchCheck } from "lucide-react";
import API from "../../api/axios.js";

const BASE = "/integration-platform/marketing-data";

export default function MarketingSeoAuditPanel() {
  const [sources, setSources] = useState([]);
  const [selected, setSelected] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    API.get(`${BASE}/sources`)
      .then(({ data }) => {
        if (cancelled) return;
        const seo = (data.items || []).filter((item) => item.provider === "technical_seo");
        setSources(seo);
        setSelected((current) => current || (seo[0]?._id ? String(seo[0]._id) : ""));
      })
      .catch(() => {
        if (!cancelled) setError("SEO sources could not be loaded. Check your workspace access and selected Location.");
      });
    return () => { cancelled = true; };
  }, []);

  async function openAudit() {
    if (!selected) return;
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const { data } = await API.get(`${BASE}/seo-audit`, { params: { sourceId: selected } });
      setReport(data);
    } catch (err) {
      setError(err?.response?.data?.message || "SEO audit unavailable. Verify the source and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="marketing-seo-audit" className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <SearchCheck aria-hidden="true" className="text-stone-700" size={22} />
        <div className="min-w-0 flex-1">
          <h2 id="marketing-seo-audit" className="text-lg font-bold text-stone-950">Technical & on-page SEO audit</h2>
          <p className="mt-1 text-sm text-stone-600">Review evidence from a completed technical SEO crawl. No automatic website changes or indexing requests.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1 text-sm font-medium text-stone-800">
          SEO source
          <select className="mt-1 block w-full rounded-lg border border-stone-300 bg-white p-2.5" value={selected} onChange={(e) => { setSelected(e.target.value); setReport(null); }}>
            {sources.length === 0 && <option value="">No technical SEO source configured</option>}
            {sources.map((source) => <option key={source._id} value={source._id}>{source.name}</option>)}
          </select>
        </label>
        <button type="button" disabled={!selected || loading} onClick={openAudit}
          className="rounded-lg bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? "Loading audit…" : "View latest audit"}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-red-700"><AlertTriangle size={16}/>{error}</p>}
      {sources.length === 0 && <p className="mt-3 text-sm text-stone-600">Create and run a Technical SEO source in Marketing Data Connections to generate your first audit.</p>}
      {report?.state === "not-scanned" && <p className="mt-3 text-sm text-stone-600">No completed scan yet. Run the selected source in Marketing Data Connections.</p>}
      {report?.state === "ready" && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="SEO audit summary">
            {[
              ["Pages scanned", report.summary.pagesScanned],
              ["Indexable candidates", report.summary.indexableCandidates],
              ["Errors", report.summary.errors],
              ["Warnings", report.summary.warnings],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-stone-50 p-3">
                <div className="text-xs font-semibold text-stone-600">{label}</div>
                <div className="mt-1 text-2xl font-bold text-stone-950">{value}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-stone-500">{report.summary.coverage}</p>
          {report.summary.findings.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-stone-700"><CheckCircle2 size={16}/> No findings in this scanned sample.</p>
          ) : (
            <div className="max-h-96 overflow-auto rounded-xl border border-stone-200">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">SEO audit findings ordered by severity</caption>
                <thead className="bg-stone-50 text-stone-700"><tr><th scope="col" className="p-3">Severity</th><th scope="col" className="p-3">Finding</th><th scope="col" className="p-3">Page</th></tr></thead>
                <tbody>{report.summary.findings.map((finding, index) => (
                  <tr className="border-t border-stone-100" key={`${finding.code}-${finding.url}-${index}`}>
                    <td className="p-3 font-semibold capitalize">{finding.severity}</td>
                    <td className="p-3"><div className="font-medium">{finding.message}</div><div className="text-xs text-stone-500">{finding.code}</div></td>
                    <td className="max-w-xs break-all p-3 text-xs">{finding.url}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
