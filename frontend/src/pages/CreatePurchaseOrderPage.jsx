import {
  useEffect,
  useState,
} from "react";

import {
  Minus,
  Plus,
  Save,
} from "lucide-react";

import {
  createPurchaseOrder,
  getSuppliers,
} from "../Services/inventoryPurchasingService.js";


function emptyItem() {
  return {
    product: "",
    productName: "",
    orderedQuantity: 1,
    unitCost: 0,
    vatRate: 20,
  };
}


export default function CreatePurchaseOrderPage() {
  const [suppliers, setSuppliers] =
    useState([]);

  const [supplierId, setSupplierId] =
    useState("");

  const [items, setItems] =
    useState([
      emptyItem(),
    ]);

  const [expectedDeliveryDate, setExpectedDeliveryDate] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [error, setError] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    getSuppliers({
      active: true,
    })
      .then((data) =>
        setSuppliers(
          data.suppliers || []
        )
      )
      .catch((requestError) =>
        setError(
          requestError.message
        )
      );
  }, []);

  function updateItem(
    index,
    field,
    value
  ) {
    setItems((current) =>
      current.map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [field]: value,
              }
            : item
      )
    );
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const result =
        await createPurchaseOrder({
          supplierId,
          expectedDeliveryDate:
            expectedDeliveryDate ||
            undefined,
          notes,
          items: items.map(
            (item) => ({
              product:
                item.product,
              orderedQuantity:
                Number(
                  item.orderedQuantity
                ),
              unitCost:
                Number(
                  item.unitCost
                ),
              vatRate:
                Number(
                  item.vatRate
                ),
            })
          ),
        });

      window.location.assign(
        `/purchase-orders/${result.purchaseOrder._id}`
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data
          ?.message ||
        requestError.message ||
        "Unable to create purchase order."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <form
        onSubmit={submit}
        className="mx-auto max-w-5xl space-y-6"
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">
            Create Purchase Order
          </h1>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Supplier
              </span>

              <select
                required
                value={supplierId}
                onChange={(event) =>
                  setSupplierId(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
              >
                <option value="">
                  Select supplier
                </option>

                {suppliers.map(
                  (supplier) => (
                    <option
                      key={supplier._id}
                      value={supplier._id}
                    >
                      {supplier.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Expected delivery
              </span>

              <input
                type="date"
                value={
                  expectedDeliveryDate
                }
                onChange={(event) =>
                  setExpectedDeliveryDate(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
              />
            </label>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            {error}
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Order items
            </h2>

            <button
              type="button"
              onClick={() =>
                setItems(
                  (current) => [
                    ...current,
                    emptyItem(),
                  ]
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
            >
              <Plus size={17} />
              Add item
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {items.map(
              (item, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-5"
                >
                  <input
                    required
                    placeholder="Product MongoDB ID"
                    value={
                      item.product
                    }
                    onChange={(event) =>
                      updateItem(
                        index,
                        "product",
                        event.target
                          .value
                      )
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 sm:col-span-2"
                  />

                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="Quantity"
                    value={
                      item.orderedQuantity
                    }
                    onChange={(event) =>
                      updateItem(
                        index,
                        "orderedQuantity",
                        event.target
                          .value
                      )
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2"
                  />

                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Unit cost"
                    value={
                      item.unitCost
                    }
                    onChange={(event) =>
                      updateItem(
                        index,
                        "unitCost",
                        event.target
                          .value
                      )
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2"
                  />

                  <button
                    type="button"
                    disabled={
                      items.length === 1
                    }
                    onClick={() =>
                      setItems(
                        (current) =>
                          current.filter(
                            (
                              _,
                              itemIndex
                            ) =>
                              itemIndex !==
                              index
                          )
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-rose-700 disabled:opacity-40"
                  >
                    <Minus size={17} />
                    Remove
                  </button>
                </div>
              )
            )}
          </div>

          <label className="mt-5 block space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Notes
            </span>

            <textarea
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value
                )
              }
              rows="4"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
            />
          </label>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          <Save size={18} />
          {saving
            ? "Saving..."
            : "Save draft order"}
        </button>
      </form>
    </main>
  );
}
