import {
  useEffect,
  useState,
} from "react";

import {
  Building2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";

import {
  createSupplier,
  getSuppliers,
} from "../services/inventoryPurchasingService.js";


export default function SupplierManagementPage() {
  const [suppliers, setSuppliers] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [form, setForm] =
    useState({
      name: "",
      code: "",
      paymentTermsDays: 30,
      standardLeadTimeDays: 7,
      minimumOrderValue: 0,
      preferred: false,
    });

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data =
        await getSuppliers({
          search:
            search || undefined,
          active: true,
        });

      setSuppliers(
        data.suppliers || []
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data
          ?.message ||
        requestError.message ||
        "Unable to load suppliers."
      );
    } finally {
      setLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");

    try {
      await createSupplier({
        ...form,
        paymentTermsDays:
          Number(
            form.paymentTermsDays
          ),
        standardLeadTimeDays:
          Number(
            form.standardLeadTimeDays
          ),
        minimumOrderValue:
          Number(
            form.minimumOrderValue
          ),
      });

      setForm({
        name: "",
        code: "",
        paymentTermsDays: 30,
        standardLeadTimeDays: 7,
        minimumOrderValue: 0,
        preferred: false,
      });

      await load();
    } catch (requestError) {
      setError(
        requestError?.response?.data
          ?.message ||
        requestError.message ||
        "Unable to create supplier."
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

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
                Supplier Management
              </h1>

              <p className="mt-2 text-slate-600">
                Manage supplier accounts, lead times and purchasing terms.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
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

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={submit}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Plus
                size={19}
                className="text-violet-700"
              />
              <h2 className="font-semibold text-slate-900">
                Add supplier
              </h2>
            </div>

            <div className="mt-5 space-y-4">
              {[
                ["name", "Supplier name", "text"],
                ["code", "Supplier code", "text"],
                ["paymentTermsDays", "Payment terms days", "number"],
                ["standardLeadTimeDays", "Lead time days", "number"],
                ["minimumOrderValue", "Minimum order value", "number"],
              ].map(
                ([
                  key,
                  label,
                  type,
                ]) => (
                  <label
                    key={key}
                    className="block space-y-2"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {label}
                    </span>

                    <input
                      type={type}
                      value={form[key]}
                      required={[
                        "name",
                        "code",
                      ].includes(key)}
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            [key]:
                              event.target
                                .value,
                          })
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                    />
                  </label>
                )
              )}

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={
                    form.preferred
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        preferred:
                          event.target
                            .checked,
                      })
                    )
                  }
                />
                Preferred supplier
              </label>

              <button
                type="submit"
                className="w-full rounded-xl bg-violet-700 px-4 py-2.5 font-semibold text-white"
              >
                Create supplier
              </button>
            </div>
          </form>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-3 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      load();
                    }
                  }}
                  placeholder="Search suppliers"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-16 text-center">
                <Loader2 className="mx-auto animate-spin text-violet-700" />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {suppliers.map(
                  (supplier) => (
                    <article
                      key={
                        supplier._id
                      }
                      className="flex items-center justify-between gap-4 p-5"
                    >
                      <div className="flex items-start gap-3">
                        <Building2 className="mt-1 text-violet-700" />

                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {supplier.name}
                          </h3>

                          <p className="text-sm text-slate-500">
                            {supplier.code} ·{" "}
                            {
                              supplier.standardLeadTimeDays
                            }{" "}
                            day lead time
                          </p>
                        </div>
                      </div>

                      {supplier.preferred ? (
                        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                          Preferred
                        </span>
                      ) : null}
                    </article>
                  )
                )}

                {suppliers.length ===
                0 ? (
                  <p className="p-10 text-center text-slate-500">
                    No suppliers found.
                  </p>
                ) : null}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
