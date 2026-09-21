import {
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getPremiumFeatureData,
} from "../../Services/premiumFeaturesService.js";

function recordTitle(
  item,
  index
) {
  return (
    item?.name ||
    item?.code ||
    item?.recipient ||
    `Record ${index + 1}`
  );
}

function recordStatus(
  item
) {
  return (
    item?.status ||
    item?.tier ||
    item?.channel ||
    "Active"
  );
}

export default function PremiumFeatureListPage({
  endpoint,
  recordsKey,
  title,
  emptyMessage =
    "No records found.",
}) {
  const [
    rows,
    setRows,
  ] = useState([]);
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    error,
    setError,
  ] = useState("");

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const result =
            await getPremiumFeatureData(
              endpoint
            );

          setRows(
            Array.isArray(
              result?.[
                recordsKey
              ]
            )
              ? result[
                  recordsKey
                ]
              : []
          );
        } catch (
          requestError
        ) {
          setError(
            requestError
              ?.response
              ?.data
              ?.message ||
              requestError
                ?.message ||
              "Unable to load feature data."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        endpoint,
        recordsKey,
      ]
    );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
                <Sparkles
                  size={18}
                />
                Premium features
              </div>

              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                {title}
              </h1>
            </div>

            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 font-semibold"
            >
              <RefreshCw
                size={18}
              />
              Refresh
            </button>
          </div>
        </section>

        {error ? (
          <section
            className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800"
            role="alert"
          >
            {error}
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-16 text-center">
              <Loader2 className="mx-auto animate-spin text-violet-700" />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map(
                (
                  item,
                  index
                ) => (
                  <article
                    key={
                      item?._id ||
                      index
                    }
                    className="p-5"
                  >
                    <h2 className="font-semibold text-slate-900">
                      {recordTitle(
                        item,
                        index
                      )}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {recordStatus(
                        item
                      )}
                    </p>
                  </article>
                )
              )}

              {rows.length ===
              0 ? (
                <p className="p-12 text-center text-slate-500">
                  {emptyMessage}
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
