import { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  KeyRound,
  Link2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";

import marketingConnections from "../../Services/marketingConnectionsService.js";
import {
  PROVIDER_AUTH_MODES,
  PROVIDER_CONNECTION_CATEGORIES,
  PROVIDER_CONNECTIONS,
} from "../../config/providerConnectionRegistry.js";

function message(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function normaliseKey(value) {
  return String(value || "").trim().toLowerCase().replaceAll("-", "_");
}

function managedByKey(items = []) {
  const map = new Map();
  for (const item of items) {
    map.set(normaliseKey(item?.key), item);
    for (const alias of item?.aliases || []) map.set(normaliseKey(alias), item);
  }
  return map;
}

function nativeByKey(items = []) {
  return new Map(
    items
      .filter((item) => item?.provider)
      .map((item) => [normaliseKey(item.provider), item])
  );
}

function connectionState(definition, managed, native) {
  if (native?.ready || native?.verified || native?.status === "connected") return "Connected";
  if (native?.status === "pending" || native?.readiness === "verification_required") return "Verification required";
  if (native?.readiness === "verification_failed") return "Attention required";
  if (managed?.connection?.connected) return "Connected";
  if (managed?.connection?.status === "pending") return "Authorisation pending";
  if (managed?.available === false || native?.configurable === false) return "Adapter unavailable";
  if (definition.priority === "planned") return "Planned";
  return "Ready to connect";
}

function statusClass(status) {
  if (status === "Connected") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (["Attention required", "Adapter unavailable"].includes(status)) return "border-red-300 bg-red-50 text-red-900";
  if (status === "Planned") return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-amber-300 bg-amber-50 text-black";
}

function fieldValue(form, key) {
  return Object.prototype.hasOwnProperty.call(form, key) ? form[key] : "";
}

function SetupDialog({ definition, native, onClose, onChanged, canManage }) {
  const [form, setForm] = useState({ displayName: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fields = native?.fields || [];
  const credentials = native?.credentials || [];

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveCredentials(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = { displayName: form.displayName || definition.label, credentials: {} };
      for (const field of fields) payload[field.key] = fieldValue(form, field.key);
      for (const credential of credentials) {
        const value = fieldValue(form, credential.key);
        if (value) payload.credentials[credential.key] = value;
      }
      await marketingConnections.configureMarketingAccount(definition.key, payload);
      setNotice(`${definition.label} was saved and verified against the provider account.`);
      await onChanged();
    } catch (requestError) {
      setError(message(requestError, `${definition.label} could not be connected.`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-3 sm:p-6" role="presentation">
      <section
        aria-labelledby="provider-setup-title"
        aria-modal="true"
        className="max-h-[calc(100vh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-black/10 bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]"
        role="dialog"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-black/10 bg-white p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Secure provider setup</p>
            <h2 className="mt-1 text-xl font-bold text-black" id="provider-setup-title">{definition.label}</h2>
            <p className="mt-1 text-sm text-stone-600">{definition.category}</p>
          </div>
          <button aria-label="Close provider setup" className="rounded-lg p-2 hover:bg-stone-100" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            <div className="flex items-center gap-2 font-bold"><ShieldCheck size={17} /> Security boundary</div>
            <p className="mt-1">Secrets are submitted to the protected backend and are not displayed again after storage. AIIBP does not ask for a Google, Meta, Microsoft, Amazon or eBay password when provider OAuth is available.</p>
          </div>

          <div>
            <h3 className="font-bold text-black">Requested capabilities</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {definition.scopes.map((scope) => (
                <span className="rounded-full border border-black/10 bg-stone-50 px-2.5 py-1 text-xs text-stone-700" key={scope}>{scope}</span>
              ))}
            </div>
          </div>

          {error ? <div className="flex gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900"><CircleAlert className="shrink-0" size={17} />{error}</div> : null}
          {notice ? <div className="flex gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="shrink-0" size={17} />{notice}</div> : null}

          <form className="space-y-4" onSubmit={saveCredentials}>
            <label className="block text-sm font-semibold text-black">
              Connection name
              <input
                className="mt-1 min-h-11 w-full rounded-xl border border-black/15 px-3 py-2 outline-none focus:border-amber-500"
                onChange={(event) => update("displayName", event.target.value)}
                placeholder={definition.label}
                value={fieldValue(form, "displayName")}
              />
            </label>

            {fields.map((field) => (
              <label className="block text-sm font-semibold text-black" key={field.key}>
                {field.label}
                <input
                  autoComplete="off"
                  className="mt-1 min-h-11 w-full rounded-xl border border-black/15 px-3 py-2 outline-none focus:border-amber-500"
                  onChange={(event) => update(field.key, event.target.value)}
                  placeholder={field.placeholder || ""}
                  required={field.required}
                  value={fieldValue(form, field.key)}
                />
                {field.help ? <span className="mt-1 block text-xs font-normal text-stone-500">{field.help}</span> : null}
              </label>
            ))}

            {credentials.map((credential) => (
              <label className="block text-sm font-semibold text-black" key={credential.key}>
                {credential.label}
                <input
                  autoComplete="new-password"
                  className="mt-1 min-h-11 w-full rounded-xl border border-black/15 px-3 py-2 outline-none focus:border-amber-500"
                  onChange={(event) => update(credential.key, event.target.value)}
                  placeholder={credential.stored ? "Stored securely — leave blank to keep current value" : "Enter credential"}
                  required={credential.required && !credential.stored}
                  type="password"
                  value={fieldValue(form, credential.key)}
                />
              </label>
            ))}

            <div className="flex flex-wrap justify-end gap-2 border-t border-black/10 pt-4">
              <button className="min-h-11 rounded-xl border border-black/10 px-4 py-2 font-semibold hover:bg-stone-100" onClick={onClose} type="button">Cancel</button>
              <button
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black bg-amber-400 px-4 py-2 font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
                disabled={!canManage || busy || (!native?.configurable && !native?.verificationAvailable)}
                type="submit"
              >
                {busy ? <LoaderCircle className="animate-spin" size={17} /> : <KeyRound size={17} />}
                Save & verify
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

export default function ProviderConnectionDirectory({ managedItems = [], nativeItems = [], runtime = {}, canManage = false, onChanged }) {
  const managedMap = useMemo(() => managedByKey(managedItems), [managedItems]);
  const nativeMap = useMemo(() => nativeByKey(nativeItems), [nativeItems]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function startOAuth(definition, managed) {
    setBusy(definition.key);
    setError("");
    setNotice("");
    try {
      if (!managed) throw new Error("This provider adapter is not available in the active connection runtime yet.");
      if (!runtime?.configured) throw new Error("The managed provider connection runtime is not configured in this environment.");
      const payload = await marketingConnections.authorizeManagedDataConnection(managed.key || definition.key);
      if (!payload?.authorizationUrl) throw new Error("The provider did not return a secure authorisation URL.");
      window.open(payload.authorizationUrl, "_blank", "noopener,noreferrer");
      setNotice(`${definition.label}: complete provider authorisation in the new tab, then refresh the connection status.`);
      await onChanged?.();
    } catch (requestError) {
      setError(message(requestError, `${definition.label} authorisation could not be started.`));
    } finally {
      setBusy("");
    }
  }

  async function verifyNative(definition) {
    setBusy(definition.key);
    setError("");
    setNotice("");
    try {
      await marketingConnections.verifyMarketingAccount(definition.key);
      setNotice(`${definition.label}: provider account verification completed.`);
      await onChanged?.();
    } catch (requestError) {
      setError(message(requestError, `${definition.label} verification failed.`));
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="space-y-5" aria-label="Provider connection directory">
      <div>
        <h2 className="text-xl font-bold text-black">Provider connections</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-600">One governed connection experience is shared by Marketing, Communications, Marketplace, Accounting, Payments and future commercial modules. OAuth providers redirect to the provider; API credentials are submitted only through protected backend routes.</p>
      </div>

      {error ? <div className="flex gap-2 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert"><CircleAlert className="shrink-0" size={17} />{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{notice}</div> : null}

      {PROVIDER_CONNECTION_CATEGORIES.map((category) => {
        const providers = PROVIDER_CONNECTIONS.filter((item) => item.category === category);
        return (
          <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm" key={category}>
            <h3 className="text-lg font-bold text-black">{category}</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {providers.map((definition) => {
                const managed = managedMap.get(normaliseKey(definition.key));
                const native = nativeMap.get(normaliseKey(definition.key));
                const status = connectionState(definition, managed, native);
                const isBusy = busy === definition.key;
                const credentialMode = [PROVIDER_AUTH_MODES.API_CREDENTIALS, PROVIDER_AUTH_MODES.HYBRID].includes(definition.authMode);
                const canConfigureCredentials = credentialMode && native?.configurable !== false && (native?.fields?.length || native?.credentials?.length);
                return (
                  <article className="flex min-h-64 flex-col rounded-2xl border border-black/10 bg-stone-50 p-4" key={definition.key}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-black">{definition.label}</h4>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{definition.authMode === "oauth" ? "Secure provider sign-in" : "Protected API credentials"}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusClass(status)}`}>{status}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {definition.modules.map((module) => <span className="rounded-full bg-white px-2 py-1 text-[11px] text-stone-600" key={module}>{module}</span>)}
                    </div>
                    <p className="mt-3 text-sm leading-5 text-stone-600">Access: {definition.scopes.join(", ")}.</p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-4">
                      {definition.authMode === PROVIDER_AUTH_MODES.OAUTH ? (
                        <button
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-black bg-amber-400 px-3 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
                          disabled={!canManage || isBusy || definition.priority === "planned"}
                          onClick={() => startOAuth(definition, managed)}
                          type="button"
                        >
                          {isBusy ? <LoaderCircle className="animate-spin" size={16} /> : <ExternalLink size={16} />}
                          {status === "Connected" ? "Reconnect" : "Connect"}
                        </button>
                      ) : (
                        <button
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-black bg-amber-400 px-3 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
                          disabled={!canManage || !canConfigureCredentials}
                          onClick={() => setSelected({ definition, native })}
                          type="button"
                        >
                          <KeyRound size={16} /> {status === "Connected" ? "Update credentials" : "Configure"}
                        </button>
                      )}
                      {native?.connectionId ? (
                        <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:bg-amber-50 disabled:opacity-50" disabled={!canManage || isBusy} onClick={() => verifyNative(definition)} type="button">
                          <RefreshCw size={16} /> Verify
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {selected ? (
        <SetupDialog
          canManage={canManage}
          definition={selected.definition}
          native={selected.native}
          onChanged={onChanged || (async () => {})}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}
