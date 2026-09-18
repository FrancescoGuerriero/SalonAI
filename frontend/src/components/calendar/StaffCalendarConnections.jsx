import {
  CalendarDays,
  CheckCircle2,
  Link2,
  Link2Off,
  RefreshCw,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import calendarConnectionApi from "../../Services/calendarConnectionApi.js";

const PROVIDERS = Object.freeze({
  google: {
    label: "Google Calendar",
    description:
      "Connect your Google account for optional two-way employee appointment synchronization.",
  },
  outlook: {
    label: "Microsoft Outlook",
    description:
      "Connect Outlook / Microsoft 365 for optional two-way employee appointment synchronization.",
  },
});

function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Calendar connection could not be updated."
  );
}

function formatDate(value) {
  if (!value) return "Not synced yet";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not synced yet"
    : new Intl.DateTimeFormat(
        "en-GB",
        {
          dateStyle: "medium",
          timeStyle: "short",
        }
      ).format(date);
}

export default function StaffCalendarConnections() {
  const [connections, setConnections] =
    useState([]);
  const [loading, setLoading] =
    useState(true);
  const [working, setWorking] =
    useState("");
  const [error, setError] =
    useState("");

  const load = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const result =
          await calendarConnectionApi.list();

        setConnections(
          result.connections || []
        );
      } catch (requestError) {
        setError(
          errorMessage(
            requestError
          )
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function connect(provider) {
    setWorking(
      `connect:${provider}`
    );
    setError("");

    try {
      const result =
        await calendarConnectionApi.connect(
          provider
        );

      if (!result.authorizationUrl) {
        throw new Error(
          "Calendar provider did not return a connection URL."
        );
      }

      window.location.assign(
        result.authorizationUrl
      );
    } catch (requestError) {
      setError(
        errorMessage(
          requestError
        )
      );
      setWorking("");
    }
  }

  async function toggleSync(
    connection
  ) {
    const enabled =
      connection.syncEnabled !== true;

    setWorking(
      `sync:${connection.provider}`
    );
    setError("");

    try {
      await calendarConnectionApi.setSync(
        connection.provider,
        enabled
      );

      await load();
    } catch (requestError) {
      setError(
        errorMessage(
          requestError
        )
      );
    } finally {
      setWorking("");
    }
  }

  async function disconnect(
    connection
  ) {
    if (
      !window.confirm(
        `Disconnect ${PROVIDERS[connection.provider]?.label || connection.provider}? SalonAI appointments will remain unchanged.`
      )
    ) {
      return;
    }

    setWorking(
      `disconnect:${connection.provider}`
    );
    setError("");

    try {
      await calendarConnectionApi.disconnect(
        connection.provider
      );
      await load();
    } catch (requestError) {
      setError(
        errorMessage(
          requestError
        )
      );
    } finally {
      setWorking("");
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays
              size={21}
            />
            <h2 className="text-lg font-bold text-black">
              External calendar connections
            </h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            SalonAI remains the appointment source of truth. Connect your own staff calendar only if you want two-way synchronization. Turning synchronization off pauses it without deleting SalonAI appointments.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void load()
          }
          disabled={
            loading ||
            Boolean(working)
          }
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-black hover:border-amber-400 disabled:opacity-50"
        >
          <RefreshCw
            size={15}
          />
          Refresh
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="mt-5 text-sm text-slate-600">
          Loading calendar connections…
        </p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {connections.map(
            (connection) => {
              const provider =
                PROVIDERS[
                  connection
                    .provider
                ];

              return (
                <article
                  key={
                    connection.provider
                  }
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-black">
                        {provider?.label ||
                          connection.provider}
                      </h3>
                      <p className="mt-1 text-sm leading-5 text-slate-600">
                        {provider?.description}
                      </p>
                    </div>

                    {connection.connected ? (
                      <CheckCircle2
                        size={21}
                        aria-label="Connected"
                        className="shrink-0"
                      />
                    ) : (
                      <Link2Off
                        size={21}
                        aria-label="Not connected"
                        className="shrink-0"
                      />
                    )}
                  </div>

                  {!connection.configured ? (
                    <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                      This provider is not yet configured by the SalonAI administrator.
                    </p>
                  ) : connection.connected ? (
                    <>
                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="font-bold text-slate-500">
                            Account
                          </dt>
                          <dd className="mt-1 text-black">
                            {connection.accountEmail ||
                              connection.accountName ||
                              "Connected account"}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-500">
                            Calendar
                          </dt>
                          <dd className="mt-1 text-black">
                            {connection.calendarName ||
                              "Primary calendar"}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-500">
                            Synchronization
                          </dt>
                          <dd className="mt-1 text-black">
                            {connection.syncEnabled
                              ? "On · enabled"
                              : "Off · paused"}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-500">
                            Last sync
                          </dt>
                          <dd className="mt-1 text-black">
                            {formatDate(
                              connection.lastSyncedAt
                            )}
                          </dd>
                        </div>
                      </dl>

                      {connection.lastSyncError ? (
                        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          {connection.lastSyncError}
                        </p>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={
                            connection.syncEnabled
                              ? "rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-black hover:bg-amber-300 disabled:opacity-50"
                              : "rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-black hover:border-amber-400 disabled:opacity-50"
                          }
                          disabled={
                            Boolean(working)
                          }
                          onClick={() =>
                            void toggleSync(
                              connection
                            )
                          }
                        >
                          Sync{" "}
                          {connection.syncEnabled
                            ? "ON"
                            : "OFF"}
                        </button>

                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-black hover:border-amber-400 disabled:opacity-50"
                          disabled={
                            Boolean(working)
                          }
                          onClick={() =>
                            void connect(
                              connection.provider
                            )
                          }
                        >
                          <Link2
                            size={15}
                          />
                          Reconnect
                        </button>

                        <button
                          type="button"
                          className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          disabled={
                            Boolean(working)
                          }
                          onClick={() =>
                            void disconnect(
                              connection
                            )
                          }
                        >
                          Disconnect
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 disabled:opacity-50"
                      disabled={
                        Boolean(working)
                      }
                      onClick={() =>
                        void connect(
                          connection.provider
                        )
                      }
                    >
                      <Link2
                        size={16}
                      />
                      Connect{" "}
                      {provider?.label}
                    </button>
                  )}
                </article>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}
