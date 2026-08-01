import {
  useEffect,
  useState,
} from "react";

import {
  Check,
  Loader2,
  PackageCheck,
  Send,
  X,
} from "lucide-react";

import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  getPurchaseOrder,
  receivePurchaseOrder,
  submitPurchaseOrder,
} from "../Services/inventoryPurchasingService.js";


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


export default function PurchaseOrderDetailsPage() {
  const purchaseOrderId =
    window.location.pathname
      .split("/")
      .filter(Boolean)
      .at(-1);

  const [order, setOrder] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data =
        await getPurchaseOrder(
          purchaseOrderId
        );

      setOrder(
        data.purchaseOrder
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data
          ?.message ||
        requestError.message
      );
    } finally {
      setLoading(false);
    }
  }

  async function action(callback) {
    setError("");

    try {
      await callback();
      await load();
    } catch (requestError) {
      setError(
        requestError?.response?.data
          ?.message ||
        requestError.message
      );
    }
  }

  async function receiveAll() {
    const items =
      order.items.map(
        (item) => ({
          purchaseOrderItem:
            item._id,
          receivedQuantity:
            Math.max(
              0,
              item.orderedQuantity -
              item.receivedQuantity -
              item.damagedQuantity
            ),
          damagedQuantity: 0,
        })
      );

    await action(() =>
      receivePurchaseOrder(
        order._id,
        {
          receivedAt:
            new Date().toISOString(),
          items,
        }
      )
    );
  }

  useEffect(() => {
    load();
  }, [purchaseOrderId]);

  if (loading) {
    return (
      <div className="p-16 text-center">
        <Loader2 className="mx-auto animate-spin text-violet-700" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-rose-700">
        {error ||
          "Purchase order not found."}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-violet-700">
                {order.status.replaceAll(
                  "_",
                  " "
                )}
              </p>

              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                {order.orderNumber}
              </h1>

              <p className="mt-2 text-slate-600">
                {order.supplier?.name}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {order.status ===
              "draft" ? (
                <button
                  type="button"
                  onClick={() =>
                    action(() =>
                      submitPurchaseOrder(
                        order._id
                      )
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <Send size={17} />
                  Submit
                </button>
              ) : null}

              {[
                "draft",
                "submitted",
              ].includes(
                order.status
              ) ? (
                <button
                  type="button"
                  onClick={() =>
                    action(() =>
                      approvePurchaseOrder(
                        order._id
                      )
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <Check size={17} />
                  Approve
                </button>
              ) : null}

              {[
                "approved",
                "partially_received",
              ].includes(
                order.status
              ) ? (
                <button
                  type="button"
                  onClick={receiveAll}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <PackageCheck size={17} />
                  Receive outstanding
                </button>
              ) : null}

              {![
                "received",
                "cancelled",
              ].includes(
                order.status
              ) ? (
                <button
                  type="button"
                  onClick={() =>
                    action(() =>
                      cancelPurchaseOrder(
                        order._id,
                        "Cancelled from management page"
                      )
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700"
                >
                  <X size={17} />
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            {error}
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left">
                    Product
                  </th>
                  <th className="px-5 py-3 text-right">
                    Ordered
                  </th>
                  <th className="px-5 py-3 text-right">
                    Received
                  </th>
                  <th className="px-5 py-3 text-right">
                    Damaged
                  </th>
                  <th className="px-5 py-3 text-right">
                    Unit cost
                  </th>
                  <th className="px-5 py-3 text-right">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {order.items.map(
                  (item) => (
                    <tr key={item._id}>
                      <td className="px-5 py-4 font-medium text-slate-900">
                        {item.productName}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {item.orderedQuantity}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {item.receivedQuantity}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {item.damagedQuantity}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {money(
                          item.unitCost
                        )}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold">
                        {money(
                          item.lineTotal
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200 p-5 text-right">
            <p className="text-sm text-slate-500">
              Total including VAT
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {money(order.total)}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
