import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Database, ExternalLink, LoaderCircle, RefreshCw, Save, ShieldCheck, Unplug } from "lucide-react";
import { Link } from "react-router-dom";

import useAuth from "../hooks/useAuth.js";
import { hasPermission } from "../utils/permissions.js";
import marketingConnections from "../Services/marketingConnectionsService.js";

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function status(account) {
  if (account?.implementationStatus === "research_required") return { label: "Research required", cls: "border-violet-200 bg-violet-50 text-violet-900" };
  if (account?.configurable === false || account?.implementationStatus === "planned") return { label: "Planned", cls: "border-sky-200 bg-sky-50 text-sky-900" };
  if (account?.readiness === "configured") return { label: "Configured", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  if (account?.readiness === "needs_attention") return { label: "Needs attention", cls: "border-amber-200 bg-amber-50 text-amber-900" };
  if (account?.readiness === "disconnected") return { label: "Disconnected", cls: "border-stone-300 bg-stone-100 text-stone-700" };
  return { label: "Not connected", cls: "border-stone-300 bg-white text-stone-700" };
}

function initialDraft(account) {
  return {
    displayName: account?.metadata?.displayName || "",
    tokenExpiresAt: account?.tokenExpiresAt ? String(account.tokenExpiresAt).slice(0, 16) : "",
    ...Object.fromEntries((account?.fields || []).map((item) => [item.key, account?.metadata?.[item.key] || ""])),
    ...Object.fromEntries((account?.credentials || []).map((item) => [item.key, ""])),
  };
}

function ProviderCard({ account, draft, expanded, busy, canManage, onToggle, onChange, onSave, onDisconnect }) {
  const presentation = status(account);
  const canConfigure = account?.configurable !== false;
  return (
    <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <button className="flex w-full items-start justify-between gap-4 p-5 text-left" onClick={onToggle} type="button" aria-expanded={expanded}>
        <div>
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown aria-hidden="true" size={18} /> : <ChevronRight aria-hidden="true" size={18} />}
            <h3 className="text-lg font-bold text-stone-950">{account.label}</h3>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">{account.description}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${presentation.cls}`}>{presentation.label}</span>
      </button>

      {expanded ? (
        <div className="border-t border-stone-100 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-stone-600">
            <span className="rounded-full bg-stone-100 px-2.5 py-1">{account.category}</span>
            {canConfigure ? <span>Scopes: {(account.scopes || []).join(", ") || "provider default"}</span> : <span>Connector state: catalogue only</span>}
            {account.documentationUrl ? (
              <a className="inline-flex items-center gap-1 font-semibold text-stone-800 underline" href={account.documentationUrl} rel="noreferrer" target="_blank">
                Provider setup guide <ExternalLink aria-hidden="true" size={13} />
              </a>
            ) : null}
          </div>

          {!canConfigure ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
              <strong>Included in the Marketing Hub roadmap.</strong> This provider is visible for planning and architecture coverage, but connection controls remain disabled until its API/auth adapter and normalisation contract pass controlled acceptance. No live provider execution is enabled.
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-stone-800">
                  Connection label
                  <input className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5" disabled={!canManage || busy} onChange={(e) => onChange("displayName", e.target.value)} placeholder={`${account.label} account`} value={draft.displayName || ""} />
                </label>

                {(account.fields || []).map((item) => (
                  <label className="text-sm font-medium text-stone-800" key={item.key}>
                    {item.label}{!item.required ? <span className="font-normal text-stone-500"> (optional)</span> : null}
                    <input className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5" disabled={!canManage || busy} onChange={(e) => onChange(item.key, e.target.value)} placeholder={item.placeholder || ""} required={item.required} value={draft[item.key] || ""} />
                    {item.help ? <span className="mt-1 block text-xs font-normal text-stone-500">{item.help}</span> : null}
                  </label>
                ))}

                {(account.credentials || []).map((item) => (
                  <label className="text-sm font-medium text-stone-800" key={item.key}>
                    {item.label}{!item.required ? <span className="font-normal text-stone-500"> (optional)</span> : null}
                    <input autoComplete="off" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5" disabled={!canManage || busy} onChange={(e) => onChange(item.key, e.target.value)} placeholder={item.stored ? "Stored securely — leave blank to keep it" : (item.placeholder || "Enter credential")} type="password" value={draft[item.key] || ""} />
                    <span className="mt-1 block text-xs font-normal text-stone-500">{item.stored ? "Encrypted credential stored. Its value is never returned to this page." : (item.help || "Stored encrypted on the server.")}</span>
                  </label>
                ))}

                {(account.credentials || []).some((item) => item.role === "access_token") ? (
                  <label className="text-sm font-medium text-stone-800">
                    Access-token expiry <span className="font-normal text-stone-500">(optional)</span>
                    <input className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5" disabled={!canManage || busy} onChange={(e) => onChange("tokenExpiresAt", e.target.value)} type="datetime-local" value={draft.tokenExpiresAt || ""} />
                  </label>
                ) : null}
              </div>

              {(account.missingFields?.length || account.missingCredentials?.length) && account.connectionId ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  This connection still needs: {[...(account.missingFields || []), ...(account.missingCredentials || [])].join(", ")}.
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3 border-t border-stone-100 pt-4">
                <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={!canManage || busy} onClick={onSave} type="button">
                  {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : <Save aria-hidden="true" size={18} />}
                  Save connection
                </button>
                {account.connectionId && account.readiness !== "disconnected" ? (
                  <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 disabled:opacity-50" disabled={!canManage || busy} onClick={onDisconnect} type="button">
                    <Unplug aria-hidden="true" size={18} /> Disconnect
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default function MarketingHubPage() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "feature-control:update");
  const [accounts, setAccounts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [expanded, setExpanded] = useState(new Set());
  const [busyProvider, setBusyProvider] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await marketingConnections.getMarketingAccounts();
      const items = Array.isArray(response?.items) ? response.items : [];
      setAccounts(items);
      setMessage(response?.message || "");
      setDrafts(Object.fromEntries(items.map((account) => [account.provider, initialDraft(account)])));
    } catch (loadError) {
      setError(errorMessage(loadError, "Marketing connections could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const result = new Map();
    for (const account of accounts) {
      if (!result.has(account.category)) result.set(account.category, []);
      result.get(account.category).push(account);
    }
    return Array.from(result.entries());
  }, [accounts]);

  const configuredCount = useMemo(() => accounts.filter((item) => item.ready).length, [accounts]);
  const availableCount = useMemo(() => accounts.filter((item) => item.configurable !== false).length, [accounts]);
  const plannedCount = useMemo(() => accounts.filter((item) => item.configurable === false).length, [accounts]);

  function updateDraft(provider, field, value) {
    setDrafts((current) => ({ ...current, [provider]: { ...(current[provider] || {}), [field]: value } }));
  }

  function toggle(provider) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(provider)) next.delete(provider); else next.add(provider);
      return next;
    });
  }

  async function save(account) {
    if (account.configurable === false) return;
    const draft = drafts[account.provider] || {};
    setBusyProvider(account.provider); setError(""); setNotice("");
    try {
      await marketingConnections.configureMarketingAccount(account.provider, {
        account: {
          displayName: draft.displayName || "",
          ...Object.fromEntries((account.fields || []).map((item) => [item.key, draft[item.key] || ""])),
        },
        credentials: Object.fromEntries((account.credentials || []).map((item) => [item.key, draft[item.key] || ""])),
        tokenExpiresAt: draft.tokenExpiresAt || null,
      });
      setNotice(`${account.label} connection details were saved securely.`);
      await load();
    } catch (saveError) {
      setError(errorMessage(saveError, `${account.label} connection could not be saved.`));
    } finally { setBusyProvider(""); }
  }

  async function disconnect(account) {
    if (account.configurable === false) return;
    setBusyProvider(account.provider); setError(""); setNotice("");
    try {
      await marketingConnections.disconnectMarketingAccount(account.provider);
      setNotice(`${account.label} was disconnected and stored credentials were revoked.`);
      await load();
    } catch (disconnectError) {
      setError(errorMessage(disconnectError, `${account.label} could not be disconnected.`));
    } finally { setBusyProvider(""); }
  }

  if (loading) return <main className="min-h-screen bg-stone-50 px-4 py-8"><div className="mx-auto max-w-7xl rounded-2xl border bg-white p-5">Loading Marketing…</div></main>;

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-600"><ShieldCheck aria-hidden="true" size={18} /> AIIBP Marketing</div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">Marketing connections</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">Connect advertising, analytics, social, commerce, CRM, finance, survey, communications and governed data sources to the AIIBP Data Hub. Provider secrets are encrypted and never returned after storage.</p>
            </div>
            <div className="flex gap-2">
              <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800" to="/admin/system/data-hub"><Database aria-hidden="true" size={18} /> Data Hub</Link>
              <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800" onClick={() => { setLoading(true); load(); }} type="button"><RefreshCw aria-hidden="true" size={18} /> Refresh</button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-stone-100 p-4"><div className="text-2xl font-bold">{configuredCount}/{availableCount}</div><div className="text-sm text-stone-600">Available providers configured</div></div>
            <div className="rounded-2xl bg-stone-100 p-4"><div className="text-2xl font-bold">{plannedCount}</div><div className="text-sm text-stone-600">Planned provider connectors</div></div>
            <div className="rounded-2xl bg-stone-100 p-4"><div className="text-sm font-semibold">Live provider sync</div><div className="mt-1 text-sm text-stone-600">Disabled until each adapter passes acceptance.</div></div>
            <div className="rounded-2xl bg-stone-100 p-4"><div className="text-sm font-semibold">Credential policy</div><div className="mt-1 text-sm text-stone-600">Encrypted server-side; never stored in Data Hub config.</div></div>
          </div>
          {message ? <p className="mt-4 text-xs text-stone-500">{message}</p> : null}
        </header>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">{error}</div> : null}
        {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{notice}</div> : null}

        {groups.map(([category, items]) => (
          <section className="space-y-3" key={category}>
            <h2 className="text-xl font-bold text-stone-950">{category}</h2>
            {items.map((account) => (
              <ProviderCard account={account} busy={busyProvider === account.provider} canManage={canManage} draft={drafts[account.provider] || initialDraft(account)} expanded={expanded.has(account.provider)} key={account.provider} onChange={(field, value) => updateDraft(account.provider, field, value)} onDisconnect={() => disconnect(account)} onSave={() => save(account)} onToggle={() => toggle(account.provider)} />
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
