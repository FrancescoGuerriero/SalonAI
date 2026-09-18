import {
  AlertTriangle,
  Boxes,
  PackagePlus,
  PoundSterling,
  RefreshCw,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import commerceService from "../Services/commerceService.js";
import useAuth from "../hooks/useAuth.js";
import {
  formatCurrency,
} from "../utils/currency.js";
import {
  hasPermission,
} from "../utils/permissions.js";

export default function InventoryManagement() {
  const {
    user,
  } = useAuth();

  const canAdjust =
    hasPermission(
      user,
      "product:inventory:update"
    );

  const canReadCost =
    hasPermission(
      user,
      "product:cost:read"
    );

  const [
    products,
    setProducts,
  ] = useState([]);
  const [
    summary,
    setSummary,
  ] = useState(null);
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    error,
    setError,
  ] = useState("");
  const [
    message,
    setMessage,
  ] = useState("");

  const load =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError("");

          const [
            productResult,
            summaryResult,
          ] =
            await Promise.all([
              commerceService.listInventoryProducts({
                limit: 250,
                sort: "name",
              }),
              commerceService.inventorySummary(),
            ]);

          setProducts(
            productResult.items ||
              []
          );
          setSummary(
            summaryResult
          );
        } catch (
          requestError
        ) {
          setError(
            requestError
              .response?.data
              ?.message ||
              "Inventory could not be loaded."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    void load();
  }, [load]);

  const lowStockIds =
    useMemo(
      () =>
        new Set(
          (
            summary?.lowStockProducts ||
            []
          ).map(
            (product) =>
              product._id
          )
        ),
      [summary]
    );

  async function adjust(
    product,
    direction
  ) {
    if (!canAdjust) {
      return;
    }

    const raw =
      window.prompt(
        direction > 0
          ? "How many units are being received?"
          : "How many units should be removed?",
        "1"
      );

    if (raw === null) {
      return;
    }

    const quantity =
      Number.parseInt(
        raw,
        10
      );

    if (
      !Number.isInteger(
        quantity
      ) ||
      quantity <= 0
    ) {
      setError(
        "Enter a positive whole number."
      );
      return;
    }

    const reason =
      window.prompt(
        "Reason for this stock adjustment:",
        direction > 0
          ? "Stock delivery"
          : "Damaged or corrected stock"
      );

    if (!reason) {
      return;
    }

    try {
      setError("");
      setMessage("");

      await commerceService.adjustStock(
        product._id,
        {
          delta:
            direction *
            quantity,
          reason,
        }
      );

      setMessage(
        `${product.name} stock updated and the adjustment was recorded.`
      );

      await load();
    } catch (
      requestError
    ) {
      setError(
        requestError
          .response?.data
          ?.message ||
          "Stock could not be adjusted."
      );
    }
  }

  return (
    <main
      className="space-y-6 p-4 sm:p-6 lg:p-8"
      id="main-content"
      tabIndex="-1"
    >
      <header className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Inventory & purchasing
            </p>
            <h1 className="mt-2 text-2xl font-bold text-black sm:text-3xl">
              Inventory
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              Maintain stock quantities and auditable movements. Product descriptions, images, pricing and publication belong in Products.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 self-start rounded-xl border border-black bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-50"
            onClick={() =>
              void load()
            }
            disabled={
              loading
            }
          >
            <RefreshCw
              size={17}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        </div>
      </header>

      {summary ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <Boxes />
            <span className="mt-3 block text-sm text-stone-600">
              Published products
            </span>
            <strong className="mt-1 block text-2xl text-black">
              {summary.productCount}
            </strong>
          </article>

          <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <PackagePlus />
            <span className="mt-3 block text-sm text-stone-600">
              Units in stock
            </span>
            <strong className="mt-1 block text-2xl text-black">
              {summary.unitsInStock}
            </strong>
          </article>

          <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <AlertTriangle />
            <span className="mt-3 block text-sm text-stone-600">
              Low stock
            </span>
            <strong className="mt-1 block text-2xl text-black">
              {summary.lowStockCount}
            </strong>
          </article>

          <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <PoundSterling />
            <span className="mt-3 block text-sm text-stone-600">
              {canReadCost &&
              summary.costValue !==
                undefined
                ? "Cost value"
                : "Retail stock value"}
            </span>
            <strong className="mt-1 block text-2xl text-black">
              {formatCurrency(
                canReadCost &&
                  summary.costValue !==
                    undefined
                  ? summary.costValue
                  : summary.retailValue
              )}
            </strong>
          </article>
        </section>
      ) : null}

      {error ? (
        <div
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-black"
          role="status"
        >
          {message}
        </div>
      ) : null}

      <section className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-600">
            <tr>
              <th className="px-5 py-3">
                Product
              </th>
              <th className="px-5 py-3">
                SKU
              </th>
              <th className="px-5 py-3">
                Stock
              </th>
              <th className="px-5 py-3">
                Reorder at
              </th>
              <th className="px-5 py-3">
                Publication
              </th>
              <th className="px-5 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {!loading &&
              products.map(
                (product) => (
                  <tr
                    key={
                      product._id
                    }
                  >
                    <td className="px-5 py-4">
                      <strong className="block text-black">
                        {product.name}
                      </strong>
                      <span className="text-xs text-stone-500">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs">
                      {product.sku}
                    </td>
                    <td
                      className={`px-5 py-4 font-bold ${
                        lowStockIds.has(
                          product._id
                        )
                          ? "text-red-700"
                          : "text-black"
                      }`}
                    >
                      {product.stockQuantity}
                    </td>
                    <td className="px-5 py-4">
                      {product.reorderLevel}
                    </td>
                    <td className="px-5 py-4">
                      {product.active
                        ? "Published"
                        : "Unpublished"}
                    </td>
                    <td className="px-5 py-4">
                      {canAdjust ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-black bg-amber-400 px-3 py-2 text-xs font-bold text-black hover:bg-amber-300"
                            onClick={() =>
                              void adjust(
                                product,
                                1
                              )
                            }
                          >
                            Receive
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-black bg-white px-3 py-2 text-xs font-bold text-black hover:bg-amber-50"
                            onClick={() =>
                              void adjust(
                                product,
                                -1
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-stone-500">
                          Read only
                        </span>
                      )}
                    </td>
                  </tr>
                )
              )}
          </tbody>
        </table>

        {loading ? (
          <div className="p-10 text-center text-sm font-semibold text-stone-600">
            Loading inventory…
          </div>
        ) : products.length ===
          0 ? (
          <div className="p-10 text-center text-sm text-stone-600">
            No products are available.
          </div>
        ) : null}
      </section>
    </main>
  );
}
