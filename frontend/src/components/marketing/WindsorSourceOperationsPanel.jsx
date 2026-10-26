import { useMemo, useState } from "react";
import { BarChart3, Database, History } from "lucide-react";

import marketingConnections from "../../Services/marketingConnectionsService.js";

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function dateDaysAgo(days) {
  const value = new Date(Date.now() - days * 86400000);
  return value.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function WindsorSourceOperationsPanel({ item, account, source, canManage, onChanged }) {
  const defaultProfile = useMemo(
    () => item.profiles?.find((profile) => profile.isDefault)?.key || item.profiles?.[0]?.key || "",
    [item.profiles]
  );
  const [profileKey, setProfileKey] = useState(source?.profileKey && source.profileKey !== "custom" ? source.profileKey : defaultProfile);
  const [cadence, setCadence] = useState(source?.cadence || "manual");
  const [dateFrom, setDateFrom] = useState(dateDaysAgo(30));
  const [dateTo, setDateTo] = useState(today());
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [kpis, setKpis] = useState(null);

  async function importSource() {
    setBusy("import"); setError(""); setNotice("");
    try {
      const payload = await marketingConnections.importWindsorConnectorData(item.key, {
        accountId: account.accountId,
        profileKey,
        datePreset: "last_7d",
        limit: 100,
        syncCadence: cadence,
      });
      setNotice(`Imported ${payload.importedRecords || 0} records. Sync: ${payload.syncCadence || cadence}.`);
      await onChanged?.();
    } catch (importError) {
      setError(errorMessage(importError, `${item.label} could not be imported.`));
    } finally { setBusy(""); }
  }

  async function backfill() {
    if (!source?.sourceId) return;
    setBusy("backfill"); setError(""); setNotice("");
    try {
      const payload = await marketingConnections.backfillWindsorConnectorData(item.key, {
        sourceId: source.sourceId,
        dateFrom,
        dateTo,
        sliceDays: 7,
      });
      const saturation = payload.saturatedDays?.length
        ? ` ${payload.saturatedDays.length} one-day window(s) reached the row cap and need review.`
        : "";
      setNotice(`Historical import processed ${payload.importedRecords || 0} records across ${payload.requests || 0} request(s).${saturation}`);
      await onChanged?.();
    } catch (backfillError) {
      setError(errorMessage(backfillError, `${item.label} historical import failed.`));
    } finally { setBusy(""); }
  }

  async function loadKpis() {
    if (!source?.sourceId) return;
    setBusy("kpis"); setError("");
    try {
      setKpis(await marketingConnections.getWindsorSellerKpis(item.key, { sourceId: source.sourceId, profile: profileKey }));
    } catch (kpiError) {
      setError(errorMessage(kpiError, `${item.label} KPI summary could not be loaded.`));
    } finally { setBusy(""); }
  }

  return (
    <div className="mt-3 rounded-xl border border-stone-200 bg-white p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {item.profiles?.length ? (
          <label className="text-xs font-semibold text-stone-700">
            Data profile
            <select className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm" value={profileKey} onChange={(event) => setProfileKey(event.target.value)}>
              {item.profiles.map((profile) => <option key={profile.key} value={profile.key}>{profile.label}</option>)}
            </select>
          </label>
        ) : null}
        <label className="text-xs font-semibold text-stone-700">
          Automatic sync
          <select className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm" value={cadence} onChange={(event) => setCadence(event.target.value)}>
            <option value="manual">Manual</option>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50" disabled={!canManage || Boolean(busy)} onClick={importSource} type="button">
          <Database size={14} /> {source ? "Update Data Hub source" : "Import to Data Hub"}
        </button>
        {source?.sourceId ? <span className="text-xs text-stone-500">{source.profileLabel} · {source.cadence} · {source.status}</span> : null}
      </div>

      {source?.sourceId ? (
        <div className="mt-3 border-t border-stone-100 pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-stone-700">History from<input className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-2 text-sm" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
            <label className="text-xs font-semibold text-stone-700">History to<input className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-2 text-sm" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50" disabled={!canManage || Boolean(busy)} onClick={backfill} type="button"><History size={14} /> Import history</button>
            {item.kind === "seller" && item.profiles?.length ? (
              <button className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50" disabled={Boolean(busy)} onClick={loadKpis} type="button"><BarChart3 size={14} /> Seller KPIs</button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-900" role="alert">{error}</div> : null}
      {notice ? <div className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900" role="status">{notice}</div> : null}
      {kpis?.kpis?.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {kpis.kpis.map((kpi) => (
            <div className="rounded-lg bg-stone-50 p-3" key={kpi.key}>
              <div className="text-xs text-stone-500">{kpi.label}</div>
              <div className="mt-1 text-lg font-bold text-stone-950">{Number.isFinite(Number(kpi.value)) ? Number(kpi.value).toLocaleString() : String(kpi.value ?? 0)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
