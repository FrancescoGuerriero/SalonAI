import {
  useEffect,
  useState,
} from "react";

import {
  AlertTriangle,
  Loader2,
  PackagePlus,
  RefreshCw,
} from "lucide-react";

import {
  getReorderRecommendations,
} from "../services/inventoryPurchasingService.js";


export default function ReorderRecommendationsPage() {
  const [items, setItems] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data =
        await getReorderRecommendations();

      setItems(
        data.recommendations ||
        []
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data
          ?.message ||
        requestError.message ||
        "Unable to load reorder recommendations."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-violet-700">
                Inventory purchasing
              </p>

              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Reorder Recommendations
              </h1>

              <p className="mt-2 text-slate-600">
                Products below their reorder level after accounting for incoming stock.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            {error}
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-16 text-center">
            <Loader2 className="mx-auto animate-spin text-violet-700" />
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map(
              (item) => (
                <article
                  key={
                    item.product._id
                  }
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <PackagePlus className="text-violet-700" />

                    <AlertTriangle className="text-amber-600" />
                  </div>

                  <h2 className="mt-4 font-semibold text-slate-900">
                    {item.product.name}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {item.product.sku ||
                      "No SKU"}
                  </p>

                  <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500">
                        Current
                      </dt>
                      <dd className="font-semibold">
                        {item.currentStock}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-slate-500">
                        Incoming
                      </dt>
                      <dd className="font-semibold">
                        {item.incomingStock}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-slate-500">
                        Reorder level
                      </dt>
                      <dd className="font-semibold">
                        {item.reorderLevel}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-slate-500">
                        Recommended
                      </dt>
                      <dd className="font-semibold text-violet-700">
                        {item.recommendedQuantity}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-4 text-sm text-slate-600">
                    Supplier:{" "}
                    {item.preferredSupplier
                      ?.name ||
                      "Not assigned"}
                  </p>
                </article>
              )
            )}

            {items.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 md:col-span-2 xl:col-span-3">
                No products currently require reordering.
              </p>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
