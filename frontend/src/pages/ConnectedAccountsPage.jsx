import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CircleAlert,
  Link2,
  LoaderCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Unplug,
} from "lucide-react";

import useAuth from "../hooks/useAuth.js";
import { hasPermission } from "../utils/permissions.js";
import connectedAccountsApi from "../Services/socialConnectedAccountsApi.js";

function errorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function statusPresentation(account) {
  if (account?.readiness === "connected") {
    return {
      label: "Connected",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }
  if (account?.readiness === "needs_attention") {
    return {
      label: "Needs attention",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }
  if (account?.readiness === "disconnected") {
    return {
      label: "Disconnected",
      className: "border-stone-300 bg-stone-100 text-stone-700",
    };
  }
  return {
    label: "Not connected",
    className: "border-stone-300 bg-white text-stone-700",
  };
}

function initialDraft(account) {
  return {
    displayName: account?.metadata?.displayName || "",
    accessToken: "",
    tokenExpiresAt: account?.tokenExpiresAt
      ? String(account.tokenExpiresAt).slice(0, 16)
      : "",
    ...Object.fromEntries(
      (account?.fields || []).map((field) => [
        field.key,
        account?.metadata?.[field.key] || "",
      ])
    ),
  };
}

function ConnectedAccountCard({
  account,
  draft,
  canManage,
  busy,
  onChange,
  onSave,
  onDisconnect,
}) {
  const status = statusPresentation(account);

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link2 aria-hidden="true" className="text-stone-600" size={20} />
            <h2 className="text-xl font-bold text-stone-950">{account.label}</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            {account.description}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-stone-800">
          Account label
          <input
            className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-950 outline-none focus:border-stone-700 focus:ring-2 focus:ring-stone-200 disabled:bg-stone-100"
            disabled={!canManage || busy}
            maxLength={180}
            onChange={(event) => onChange("displayName", event.target.value)}
            placeholder={`${account.label} account`}
            type="text"
            value={draft.displayName || ""}
          />
        </label>

        {(account.fields || []).map((field) => (
          <label className="text-sm font-medium text-stone-800" key={field.key}>
            {field.label}
            <input
              className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-950 outline-none focus:border-stone-700 focus:ring-2 focus:ring-stone-200 disabled:bg-stone-100"
              disabled={!canManage || busy}
              onChange={(event) => onChange(field.key, event.target.value)}
              placeholder={field.placeholder}
              required
              type="text"
              value={draft[field.key] || ""}
            />
          </label>
        ))}

        <label className="text-sm font-medium text-stone-800">
          Access token
          <input
            autoComplete="off"
            className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-950 outline-none focus:border-stone-700 focus:ring-2 focus:ring-stone-200 disabled:bg-stone-100"
            disabled={!canManage || busy}
            onChange={(event) => onChange("accessToken", event.target.value)}
            placeholder={account.credentialStored ? "Stored securely — leave blank to keep it" : "Paste access token"}
            type="password"
            value={draft.accessToken || ""}
          />
          <span className="mt-1 block text-xs font-normal text-stone-500">
            {account.credentialStored
              ? "A credential is stored. Its value is never returned to this page."
              : "Required for the first connection."}
          </span>
        </label>

        <label className="text-sm font-medium text-stone-800">
          Token expiry <span className="font-normal text-stone-500">(optional)</span>
          <input
            className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-950 outline-none focus:border-stone-700 focus:ring-2 focus:ring-stone-200 disabled:bg-stone-100"
            disabled={!canManage || busy}
            onChange={(event) => onChange("tokenExpiresAt", event.target.value)}
            type="datetime-local"
            value={draft.tokenExpiresAt || ""}
          />
        </label>
      </div>

      {account.missingFields?.length > 0 && account.connectionId ? (
        <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <span>
            This connection is incomplete. Add the required account identifiers and a valid credential.
          </span>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-stone-100 pt-4">
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canManage || busy}
          onClick={onSave}
          type="button"
        >
          {busy ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
          ) : (
            <Save aria-hidden="true" size={18} />
          )}
          {account.ready ? "Update connection" : "Connect account"}
        </button>

        {account.connectionId && account.readiness !== "disconnected" ? (
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canManage || busy}
            onClick={onDisconnect}
            type="button"
          >
            <Unplug aria-hidden="true" size={18} />
            Disconnect
          </button>
        ) : null}

        {!canManage ? (
          <span className="text-xs text-stone-500">
            You have read-only access to connected accounts.
          </span>
        ) : null}
      </div>
    </section>
  );
}

export default function ConnectedAccountsPage() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "feature-control:update");
  const [accounts, setAccounts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [livePublishingEnabled, setLivePublishingEnabled] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await connectedAccountsApi.getConnectedAccounts();
      const items = Array.isArray(response?.items) ? response.items : [];
      setAccounts(items);
      setLivePublishingEnabled(Boolean(response?.livePublishingEnabled));
      setDrafts(
        Object.fromEntries(items.map((account) => [account.provider, initialDraft(account)]))
      );
    } catch (loadError) {
      setError(errorMessage(loadError, "Connected accounts could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const connectedCount = useMemo(
    () => accounts.filter((account) => account.ready).length,
    [accounts]
  );

  function updateDraft(provider, field, value) {
    setDrafts((current) => ({
      ...current,
      [provider]: {
        ...(current[provider] || {}),
        [field]: value,
      },
    }));
  }

  async function saveAccount(account) {
    const draft = drafts[account.provider] || {};
    setBusyProvider(account.provider);
    setError("");
    setNotice("");
    try {
      await connectedAccountsApi.connectAccount(account.provider, {
        account: {
          displayName: draft.displayName || "",
          ...Object.fromEntries(
            (account.fields || []).map((field) => [field.key, draft[field.key] || ""])
          ),
        },
        accessToken: draft.accessToken || "",
        tokenExpiresAt: draft.tokenExpiresAt || null,
      });
      setNotice(`${account.label} connection saved securely.`);
      await load();
    } catch (saveError) {
      setError(errorMessage(saveError, `${account.label} could not be connected.`));
    } finally {
      setBusyProvider("");
    }
  }

  async function disconnect(account) {
    setBusyProvider(account.provider);
    setError("");
    setNotice("");
    try {
      await connectedAccountsApi.disconnectAccount(account.provider);
      setNotice(`${account.label} has been disconnected and its stored provider credential revoked.`);
      await load();
    } catch (disconnectError) {
      setError(errorMessage(disconnectError, `${account.label} could not be disconnected.`));
    } finally {
      setBusyProvider("");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-8" id="main-content" tabIndex="-1">
        <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-2xl border border-stone-200 bg-white p-5 text-stone-700">
          <LoaderCircle aria-hidden="true" className="animate-spin" size={20} />
          Loading connected accounts…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-600">
                <ShieldCheck aria-hidden="true" size={18} />
                Secure provider connections
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">
                Connected accounts
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
                Connect the business accounts used by governed social publishing. Access tokens are encrypted by the backend and are never returned to the browser after they are saved.
              </p>
            </div>
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50"
              onClick={() => {
                setLoading(true);
                load();
              }}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={18} />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-stone-100 p-4">
              <div className="text-2xl font-bold text-stone-950">{connectedCount}/{accounts.length}</div>
              <div className="text-sm text-stone-600">Accounts ready</div>
            </div>
            <div className="rounded-2xl bg-stone-100 p-4">
              <div className="text-sm font-semibold text-stone-950">Live publishing</div>
              <div className="mt-1 text-sm text-stone-600">
                {livePublishingEnabled ? "Enabled by controlled server configuration" : "Disabled — connection does not activate publishing"}
              </div>
            </div>
            <div className="rounded-2xl bg-stone-100 p-4">
              <div className="text-sm font-semibold text-stone-950">Messaging integrations</div>
              <div className="mt-1 text-sm text-stone-600">
                Twilio and transactional/marketing email connections are on hold.
              </div>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
            {notice}
          </div>
        ) : null}

        <div className="grid gap-5">
          {accounts.map((account) => (
            <ConnectedAccountCard
              account={account}
              busy={busyProvider === account.provider}
              canManage={canManage}
              draft={drafts[account.provider] || initialDraft(account)}
              key={account.provider}
              onChange={(field, value) => updateDraft(account.provider, field, value)}
              onDisconnect={() => disconnect(account)}
              onSave={() => saveAccount(account)}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
