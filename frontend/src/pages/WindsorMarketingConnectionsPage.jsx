import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, ExternalLink, LoaderCircle, RefreshCw, Search, Store, Unplug } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import useAuth from "../hooks/useAuth.js";
import { hasPermission } from "../utils/permissions.js";
import marketingConnections from "../Services/marketingConnectionsService.js";

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function kindLabel(kind) {
  if (kind === "seller") return "Sellers";
  if (kind === "data-platform") return "Data platforms";
  if (kind === "destination") return "Destinations";
  if (kind === "ai-destination") return "AI destinations";
  return "Data sources";
}

function statusLabel(item) {
  if (item?.connection?.connected) return "Connected";
  if (item?.connection?.status === "pending") return "Authorisation pending";
  if (item?.available === false) return "Not currently exposed by Windsor";
  if (item?.available === null) return "Availability not checked";
  return "Ready to connect";
}

export default function WindsorMarketingConnectionsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const canManage = hasPermission(user, "feature-control:update");
  const requestedType = searchParams.get("type");
  const initialKind = ["seller", "source", "data-platform", "destination", "ai-destination"].includes(requestedType)
    ? requestedType
    : "all";
  const [items, setItems] = useState([]);
  const [runtime, setRuntime] = useState({ configured: false });
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState(initialKind);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const payload = await marketingConnections.getWindsorCatalogue();
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setRuntime(payload?.runtime || { configured: false });
    } catch (loadError) {
      setError(errorMessage(loadError, "Windsor connector catalogue could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const kindMatch = kind === "all" || item.kind === kind;
      const queryMatch = !q || [item.label, item.category, item.key]
        .some((value) => String(value || "").toLowerCase().includes(q));
      return kindMatch && queryMatch;
    });
  }, [items, kind, query]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const item of filtered) {
      const label = kindLabel(item.kind);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(item);
    }
    return [...map.entries()];
  }, [filtered]);

  async function connect(item) {
    setBusy(item.key); setError(""); setNotice("");
    try {
      const payload = await marketingConnections.authorizeWindsorConnector(item.key);
      if (!payload?.authorizationUrl) throw new Error("Windsor did not return an authorization link.");
      window.open(payload.authorizationUrl, "_blank", "noopener,noreferrer");
      setNotice(`${item.label}: complete the Windsor/provider authorization in the new tab, then choose Check connection.`);
      await load();
    } catch (connectError) {
      setError(errorMessage(connectError, `${item.label} authorization could not be started.`));
    } finally { setBusy(""); }
  }

  async function reconcile(item) {
    setBusy(item.key); setError(""); setNotice("");
    try {
      const payload = await marketingConnections.reconcileWindsorConnector(item.key);
      setNotice(payload?.connected
        ? `${item.label}: ${payload.accountCount} account${payload.accountCount === 1 ? "" : "s"} connected to this business.`
        : `${item.label}: no account has been linked through this business authorization yet.`);
      await load();
    } catch (reconcileError) {
      setError(errorMessage(reconcileError, `${item.label} connection could not be reconciled.`));
    } finally { setBusy(""); }
  }

  async function previewAccount(item, account) {
    setBusy(`${item.key}:${account.accountId}`); setError(""); setPreview(null);
    try {
      const payload = await marketingConnections.previewWindsorConnector(item.key, {
        accountId: account.accountId,
        fields: ["date", "account_id", "account_name"],
        datePreset: "last_7d",
        limit: 25,
      });
      setPreview({ title: `${item.label} — ${account.accountName || account.accountId}`, payload });
    } catch (previewError) {
      setError(errorMessage(previewError, `${item.label} preview could not be loaded.`));
    } finally { setBusy(""); }
  }

  async function importAccount(item, account) {
    setBusy(`${item.key}:${account.accountId}`); setError(""); setNotice("");
    try {
      const payload = await marketingConnections.importWindsorConnectorData(item.key, {
        accountId: account.accountId,
        fields: ["date", "account_id", "account_name"],
        datePreset: "last_7d",
        limit: 100,
      });
      setNotice(`${item.label}: imported ${payload.importedRecords || 0} records into the active location Data Hub (${payload.status || "complete"}).`);
    } catch (importError) {
      setError(errorMessage(importError, `${item.label} data could not be imported into the Data Hub.`));
    } finally { setBusy(""); }
  }

  async function unlink(item, account) {
    setBusy(`${item.key}:${account.accountId}`); setError(""); setNotice("");
    try {
      await marketingConnections.unlinkWindsorAccount(item.key, account.accountId);
      setNotice(`${item.label} account ${account.accountName || account.accountId} was disconnected from this business.`);
      await load();
    } catch (unlinkError) {
      setError(errorMessage(unlinkError, `${item.label} account could not be disconnected.`));
    } finally { setBusy(""); }
  }

  if (loading) {
    return <main className="min-h-screen bg-stone-50 px-4 py-8"><div className="mx-auto max-w-7xl rounded-2xl border bg-white p-5">Loading Windsor connections…</div></main>;
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-stone-600">Marketing · Windsor data connections</div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">Connect business data</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-600">
                Connect supported marketing, analytics, seller, CRM and business platforms through Windsor. OAuth/manual provider setup happens in Windsor/provider screens; this application never asks for the provider password. Connected account IDs are bound to the active business before data can be previewed or imported into the active location Data Hub.
              </p>
            </div>
            <div className="flex gap-2">
              <Link className="inline-flex min-h-11 items-center rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold" to="/marketing">Marketing</Link>
              <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold" onClick={() => { setLoading(true); load(); }} type="button"><RefreshCw size={17} /> Refresh</button>
            </div>
          </div>
          {!runtime.configured ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
              Windsor is not configured in this environment. Set the server-side WINDSOR_API_KEY before connection testing.
            </div>
          ) : null}
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-3 text-stone-500" size={18} />
              <span className="sr-only">Search connections</span>
              <input className="w-full rounded-xl border border-stone-300 py-2.5 pl-10 pr-3" onChange={(event) => setQuery(event.target.value)} placeholder="Search Amazon, eBay, Google, Meta, HubSpot…" value={query} />
            </label>
            <select aria-label="Connection type" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5" onChange={(event) => setKind(event.target.value)} value={kind}>
              <option value="all">All connection types</option>
              <option value="seller">Sellers</option>
              <option value="source">Data sources</option>
              <option value="data-platform">Data platforms</option>
              <option value="destination">Destinations</option>
              <option value="ai-destination">AI destinations</option>
            </select>
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">{error}</div> : null}
        {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{notice}</div> : null}

        {groups.map(([group, connections]) => (
          <section className="space-y-3" key={group}>
            <div className="flex items-center gap-2">
              {group === "Sellers" ? <Store size={20} aria-hidden="true" /> : null}
              <h2 className="text-xl font-bold text-stone-950">{group}</h2>
              <span className="text-sm text-stone-500">{connections.length}</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {connections.map((item) => {
                const isDestination = ["destination", "ai-destination"].includes(item.kind);
                const connection = item.connection || {};
                return (
                  <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" key={item.key}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-stone-950">{item.label}</h3>
                        <p className="mt-1 text-xs text-stone-500">{item.category} · {statusLabel(item)}</p>
                      </div>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold">Windsor</span>
                    </div>

                    {isDestination ? (
                      <p className="mt-4 text-sm leading-6 text-stone-600">
                        This is treated as a data/AI destination rather than a Marketing source. Destination activation will be configured separately so it cannot be mistaken for a source account.
                      </p>
                    ) : (
                      <>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-stone-950 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!canManage || !runtime.configured || busy === item.key || item.available === false} onClick={() => connect(item)} type="button">
                            {busy === item.key ? <LoaderCircle className="animate-spin" size={16} /> : <ExternalLink size={16} />}
                            {connection.status === "pending" || connection.connected ? "Reconnect" : "Connect securely"}
                          </button>
                          {(connection.status === "pending" || connection.connected) ? (
                            <button className="min-h-10 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm font-semibold disabled:opacity-50" disabled={!canManage || busy === item.key} onClick={() => reconcile(item)} type="button">Check connection</button>
                          ) : null}
                        </div>

                        {connection.accounts?.length ? (
                          <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Connected to this business</div>
                            {connection.accounts.map((account) => (
                              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 p-3" key={account.accountId}>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold">{account.accountName || account.accountId}</div>
                                  <div className="truncate text-xs text-stone-500">{account.accountId}</div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold" disabled={Boolean(busy)} onClick={() => previewAccount(item, account)} type="button">Preview</button>
                                  <button className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold" disabled={!canManage || Boolean(busy)} onClick={() => importAccount(item, account)} type="button"><Database size={14} /> Import to Data Hub</button>
                                  <button aria-label={`Disconnect ${account.accountName || account.accountId}`} className="inline-flex items-center rounded-lg border border-stone-300 bg-white px-2.5 py-1.5" disabled={!canManage || Boolean(busy)} onClick={() => unlink(item, account)} type="button"><Unplug size={15} /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        {preview ? (
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Data preview: {preview.title}</h2>
              <button className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm" onClick={() => setPreview(null)} type="button">Close</button>
            </div>
            <pre className="mt-4 max-h-[28rem] overflow-auto rounded-xl bg-stone-950 p-4 text-xs text-stone-100">{JSON.stringify(preview.payload?.data ?? preview.payload, null, 2)}</pre>
          </section>
        ) : null}
      </div>
    </main>
  );
}
