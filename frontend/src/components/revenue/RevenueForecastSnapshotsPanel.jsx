import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  AlertTriangle,
  Eye,
  History,
  LoaderCircle,
  RefreshCcw,
  Save,
  Trash2,
} from "lucide-react";

import {
  createRevenueForecastSnapshot,
  deleteRevenueForecastSnapshot,
  getRevenueForecastSnapshot,
  listRevenueForecastSnapshots,
} from "../../Services/revenueForecastService.js";

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "The forecast snapshot request failed."
  );
}

function getSnapshotId(snapshot) {
  return String(
    snapshot?._id ||
      snapshot?.id ||
      ""
  ).trim();
}

function formatCurrency(
  value,
  currency = "GBP"
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }
  ).format(
    Number(value) || 0
  );
}

function formatDateTime(value) {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

export default function RevenueForecastSnapshotsPanel({
  forecast,
  historyMonths,
  forecastMonths,
  onLoadSnapshot,
}) {
  const [
    snapshots,
    setSnapshots,
  ] = useState([]);

  const [
    name,
    setName,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    activeSnapshotId,
    setActiveSnapshotId,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const loadSnapshots =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await listRevenueForecastSnapshots({
            page: 1,
            limit: 20,
          });

        setSnapshots(
          Array.isArray(
            response?.snapshots
          )
            ? response.snapshots
            : []
        );
      } catch (
        requestError
      ) {
        setError(
          getErrorMessage(
            requestError
          )
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  async function handleSave(event) {
    event.preventDefault();

    if (!forecast) {
      setError(
        "Generate a forecast before saving it."
      );

      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response =
        await createRevenueForecastSnapshot({
          name,
          description,
          months:
            historyMonths,
          forecastMonths,
        });

      setMessage(
        response?.message ||
          "Forecast saved successfully."
      );

      setName("");
      setDescription("");

      await loadSnapshots();
    } catch (
      requestError
    ) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLoad(snapshot) {
    const snapshotId =
      getSnapshotId(
        snapshot
      );

    if (!snapshotId) {
      setError(
        "The selected snapshot has no valid ID."
      );

      return;
    }

    setActiveSnapshotId(
      snapshotId
    );

    setError("");
    setMessage("");

    try {
      const response =
        await getRevenueForecastSnapshot(
          snapshotId
        );

      if (
        !response?.snapshot
      ) {
        throw new Error(
          "The saved forecast response was empty."
        );
      }

      onLoadSnapshot?.(
        response.snapshot
      );

      setMessage(
        `"${response.snapshot.name}" was loaded.`
      );
    } catch (
      requestError
    ) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setActiveSnapshotId("");
    }
  }

  async function handleDelete(snapshot) {
    const snapshotId =
      getSnapshotId(
        snapshot
      );

    if (!snapshotId) {
      setError(
        "The selected snapshot has no valid ID."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${snapshot.name || "this forecast"}"?`
      );

    if (!confirmed) {
      return;
    }

    setActiveSnapshotId(
      snapshotId
    );

    setError("");
    setMessage("");

    try {
      const response =
        await deleteRevenueForecastSnapshot(
          snapshotId
        );

      setSnapshots(
        (current) =>
          current.filter(
            (item) =>
              getSnapshotId(
                item
              ) !== snapshotId
          )
      );

      setMessage(
        response?.message ||
          "Forecast deleted successfully."
      );
    } catch (
      requestError
    ) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setActiveSnapshotId("");
    }
  }

  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Save size={19} />
          </span>

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Save forecast
            </h2>

            <p className="text-sm text-slate-500">
              Store the current forecast for later comparison.
            </p>
          </div>
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-semibold text-slate-700">
            Snapshot name
          </span>

          <input
            type="text"
            value={name}
            onChange={(event) =>
              setName(
                event.target.value
              )
            }
            placeholder="Example: August revenue forecast"
            maxLength={200}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-slate-700">
            Description
          </span>

          <textarea
            value={description}
            onChange={(event) =>
              setDescription(
                event.target.value
              )
            }
            placeholder="Optional forecast notes"
            rows={4}
            maxLength={2000}
            className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
          />
        </label>

        <button
          type="submit"
          disabled={
            saving ||
            !forecast
          }
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <LoaderCircle
              size={17}
              className="animate-spin"
            />
          ) : (
            <Save size={17} />
          )}

          Save current forecast
        </button>
      </form>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <History size={19} />
            </span>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Forecast history
              </h2>

              <p className="text-sm text-slate-500">
                Load or delete saved forecasts.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadSnapshots}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCcw
              size={14}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>
        </header>

        {(error || message) && (
          <div className="space-y-2 border-b border-slate-200 p-4">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle
                  size={17}
                  className="mt-0.5 shrink-0"
                />

                {error}
              </div>
            )}

            {message && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {message}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-60 items-center justify-center">
            <LoaderCircle
              size={30}
              className="animate-spin text-indigo-600"
            />
          </div>
        ) : snapshots.length === 0 ? (
          <div className="flex min-h-60 flex-col items-center justify-center p-6 text-center">
            <History
              size={40}
              className="text-slate-300"
            />

            <p className="mt-3 font-semibold text-slate-800">
              No saved forecasts
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Save the current forecast to create the first snapshot.
            </p>
          </div>
        ) : (
          <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
            {snapshots.map(
              (snapshot) => {
                const snapshotId =
                  getSnapshotId(
                    snapshot
                  );

                const processing =
                  activeSnapshotId ===
                  snapshotId;

                return (
                  <div
                    key={snapshotId}
                    className="p-4 hover:bg-slate-50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {snapshot.name ||
                            "Revenue forecast"}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatDateTime(
                            snapshot.generatedAt
                          )}
                        </p>

                        {snapshot.description && (
                          <p className="mt-2 text-sm text-slate-600">
                            {snapshot.description}
                          </p>
                        )}

                        <p className="mt-2 text-sm text-slate-600">
                          Expected revenue:{" "}
                          <strong className="text-slate-900">
                            {formatCurrency(
                              snapshot.summary
                                ?.forecastTotal,
                              snapshot.currency ||
                                "GBP"
                            )}
                          </strong>
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleLoad(
                              snapshot
                            )
                          }
                          disabled={processing}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                        >
                          {processing ? (
                            <LoaderCircle
                              size={14}
                              className="animate-spin"
                            />
                          ) : (
                            <Eye size={14} />
                          )}

                          Load
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(
                              snapshot
                            )
                          }
                          disabled={processing}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </article>
    </section>
  );
}
