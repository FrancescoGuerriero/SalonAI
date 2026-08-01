import {
  useEffect,
  useState,
} from "react";

import {
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";

import {
  getPurchaseOrders,
} from "../services/inventoryPurchasingService.js";


const money = (value) =>
  new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    }
  ).format(
    Number(value) || 0
  );


export default function PurchaseOrdersPage() {
  const [orders, setOrders] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [status, setStatus] =
    useState("");

  const [error, setError] =
    useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data =
        await getPurchaseOrders({
          status:
            status || undefined,
        });

      setOrders(
        data.purchaseOrders ||
        []
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data
          ?.message ||
        requestError.message ||
        "Unable to load purchase orders."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-violet-700">
                Inventory purchasing
              </p>

              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Purchase Orders
              </h1>
            </div>

            <div className="flex gap-3">
              <a
                href="/purchase-orders/new"
                className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Plus size={18} />
                New order
              </a>

              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                <RefreshCw size={18} />
                Refresh
              </button>
            </div>
          </div>

          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value
              )
            }
            className="mt-5 rounded-xl border border-slate-300 px-3 py-2.5"
          >
            <option value="">
              All statuses
            </option>
            <option value="draft">
              Draft
            </option>
            <option value="submitted">
              Submitted
            </option>
            <option value="approved">
              Approved
            </option>
            <option value="partially_received">
              Partially received
            </option>
            <option value="received">
              Received
            </option>
            <option value="cancelled">
              Cancelled
            </option>
          </select>
        </section>

        {error ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
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
              {orders.map(
                (order) => (
                  <a
                    key={order._id}
                    href={`/purchase-orders/${order._id}`}
                    className="flex flex-col gap-3 p-5 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <ClipboardList className="mt-1 text-violet-700" />

                      <div>
                        <h2 className="font-semibold text-slate-900">
                          {order.orderNumber}
                        </h2>

                        <p className="text-sm text-slate-500">
                          {order.supplier?.name ||
                            "Supplier"}{" "}
                          ·{" "}
                          {order.items?.length ||
                            0}{" "}
                          item(s)
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-slate-900">
                        {money(
                          order.total
                        )}
                      </p>

                      <p className="text-sm capitalize text-slate-500">
                        {String(
                          order.status
                        ).replaceAll(
                          "_",
                          " "
                        )}
                      </p>
                    </div>
                  </a>
                )
              )}

              {orders.length === 0 ? (
                <p className="p-12 text-center text-slate-500">
                  No purchase orders found.
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
