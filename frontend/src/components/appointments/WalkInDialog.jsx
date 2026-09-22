import {
  LoaderCircle,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createPortal,
} from "react-dom";

import appointmentManagementApi from "../../Services/appointmentManagementApi.js";
import serviceService from "../../Services/serviceService.js";

function asArray(value, keys = []) {
  if (Array.isArray(value)) {
    return value;
  }

  for (const key of keys) {
    if (Array.isArray(value?.[key])) {
      return value[key];
    }
  }

  return [];
}

function entityName(entity, fallback = "") {
  if (!entity || typeof entity !== "object") {
    return fallback;
  }

  return (
    entity.fullName ||
    entity.name ||
    [
      entity.firstName,
      entity.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    fallback
  );
}

function errorText(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "The walk-in could not be created."
  );
}

function defaultLocalDateTime() {
  const value = new Date();
  value.setSeconds(0, 0);
  const roundedMinutes =
    Math.ceil(
      value.getMinutes() / 5
    ) * 5;
  value.setMinutes(roundedMinutes);

  const offset =
    value.getTimezoneOffset();
  value.setMinutes(
    value.getMinutes() - offset
  );

  return value
    .toISOString()
    .slice(0, 16);
}

export default function WalkInDialog({
  open,
  onClose,
  onCreated,
}) {
  const [
    customerSearch,
    setCustomerSearch,
  ] = useState("");
  const [
    customers,
    setCustomers,
  ] = useState([]);
  const [
    stylists,
    setStylists,
  ] = useState([]);
  const [
    services,
    setServices,
  ] = useState([]);
  const [
    form,
    setForm,
  ] = useState({
    customer: "",
    stylist: "",
    service: "",
    startsAt:
      defaultLocalDateTime(),
    notes: "",
  });
  const [
    loading,
    setLoading,
  ] = useState(false);
  const [
    searching,
    setSearching,
  ] = useState(false);
  const [
    saving,
    setSaving,
  ] = useState(false);
  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let active = true;
    const previousOverflow =
      document.body.style.overflow;
    document.body.style.overflow =
      "hidden";

    async function loadOptions() {
      setLoading(true);
      setError("");

      try {
        const [
          stylistResult,
          serviceResult,
        ] = await Promise.all([
          appointmentManagementApi.stylists(),
          serviceService.getServices(),
        ]);

        if (!active) {
          return;
        }

        const nextStylists =
          asArray(
            stylistResult,
            ["stylists", "items"]
          );
        const nextServices =
          asArray(
            serviceResult,
            ["services", "items"]
          );

        setStylists(nextStylists);
        setServices(nextServices);
        setForm((current) => ({
          ...current,
          stylist:
            current.stylist ||
            String(
              nextStylists[0]?._id ||
                ""
            ),
          service:
            current.service ||
            String(
              nextServices[0]?._id ||
                ""
            ),
        }));
      } catch (requestError) {
        if (active) {
          setError(
            errorText(requestError)
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadOptions();

    return () => {
      active = false;
      document.body.style.overflow =
        previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const query =
      customerSearch.trim();

    if (query.length < 2) {
      setCustomers([]);
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(
      async () => {
        setSearching(true);
        setError("");

        try {
          const result =
            await appointmentManagementApi.searchCustomers(
              query
            );

          if (active) {
            setCustomers(
              asArray(
                result,
                [
                  "customers",
                  "items",
                ]
              )
            );
          }
        } catch (requestError) {
          if (active) {
            setError(
              errorText(requestError)
            );
          }
        } finally {
          if (active) {
            setSearching(false);
          }
        }
      },
      250
    );

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [customerSearch, open]);

  const selectedCustomer =
    useMemo(
      () =>
        customers.find(
          (item) =>
            String(item._id) ===
            form.customer
        ) || null,
      [customers, form.customer]
    );

  if (!open) {
    return null;
  }

  function update(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();

    if (
      !form.customer ||
      !form.stylist ||
      !form.service ||
      !form.startsAt
    ) {
      setError(
        "Customer, stylist, service and arrival time are required."
      );
      return;
    }

    const startsAt =
      new Date(form.startsAt);

    if (
      Number.isNaN(
        startsAt.getTime()
      )
    ) {
      setError(
        "Arrival time is invalid."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response =
        await appointmentManagementApi.createWalkIn(
          {
            customer:
              form.customer,
            stylist:
              form.stylist,
            service:
              form.service,
            startsAt:
              startsAt.toISOString(),
            notes:
              form.notes.trim(),
          }
        );

      await onCreated?.(
        response
      );
      onClose?.();
    } catch (requestError) {
      setError(
        errorText(requestError)
      );
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center overflow-hidden bg-black/50 p-2 sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !saving
        ) {
          onClose?.();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="walk-in-dialog-title"
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-200 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-black">
              <UserPlus size={20} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-stone-700">
                Reception
              </p>
              <h2
                id="walk-in-dialog-title"
                className="mt-1 text-xl font-bold text-black"
              >
                Add walk-in
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Creates a normal appointment with walk-in as its booking source.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close walk-in dialog"
            className="grid min-h-11 min-w-11 place-items-center rounded-lg text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </header>

        <form
          id="walk-in-form"
          onSubmit={submit}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5"
        >
          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
            >
              {error}
            </div>
          ) : null}

          <div>
            <label className="text-sm font-bold text-black">
              Find customer
            </label>
            <div className="relative mt-2">
              <Search
                size={17}
                className="absolute left-3 top-3 text-stone-500"
              />
              <input
                value={customerSearch}
                onChange={(event) =>
                  setCustomerSearch(
                    event.target.value
                  )
                }
                placeholder="Search by name, email or phone"
                className="w-full rounded-xl border border-stone-300 py-3 pl-10 pr-10 text-sm"
              />
              {searching ? (
                <LoaderCircle
                  size={17}
                  className="absolute right-3 top-3 animate-spin text-stone-500"
                />
              ) : null}
            </div>

            {customerSearch.trim().length >=
              2 ? (
              <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-2">
                {customers.length === 0 &&
                !searching ? (
                  <p className="px-2 py-3 text-sm text-stone-600">
                    No matching customer found. Add the customer first from the Customers workflow.
                  </p>
                ) : (
                  customers.map(
                    (customer) => (
                      <button
                        type="button"
                        key={customer._id}
                        onClick={() =>
                          update(
                            "customer",
                            String(
                              customer._id
                            )
                          )
                        }
                        className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white ${
                          form.customer ===
                          String(
                            customer._id
                          )
                            ? "border border-amber-400 bg-white"
                            : "border border-transparent"
                        }`}
                      >
                        <span className="block font-bold text-black">
                          {entityName(
                            customer,
                            "Customer"
                          )}
                        </span>
                        <span className="block text-xs text-stone-600">
                          {customer.email ||
                            customer.phone ||
                            "No contact detail"}
                        </span>
                      </button>
                    )
                  )
                )}
              </div>
            ) : null}

            {selectedCustomer ? (
              <p className="mt-2 text-sm font-semibold text-stone-700">
                Selected: {entityName(
                  selectedCustomer,
                  "Customer"
                )}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-black">
              Stylist
              <select
                required
                value={form.stylist}
                onChange={(event) =>
                  update(
                    "stylist",
                    event.target.value
                  )
                }
                disabled={loading}
                className="rounded-xl border border-stone-300 bg-white px-3 py-3 font-normal"
              >
                <option value="">
                  Choose stylist
                </option>
                {stylists.map(
                  (stylist) => (
                    <option
                      key={stylist._id}
                      value={stylist._id}
                    >
                      {entityName(
                        stylist,
                        "Stylist"
                      )}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-bold text-black">
              Service
              <select
                required
                value={form.service}
                onChange={(event) =>
                  update(
                    "service",
                    event.target.value
                  )
                }
                disabled={loading}
                className="rounded-xl border border-stone-300 bg-white px-3 py-3 font-normal"
              >
                <option value="">
                  Choose service
                </option>
                {services.map(
                  (service) => (
                    <option
                      key={service._id}
                      value={service._id}
                    >
                      {service.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-bold text-black sm:col-span-2">
              Arrival / expected start
              <input
                required
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) =>
                  update(
                    "startsAt",
                    event.target.value
                  )
                }
                className="rounded-xl border border-stone-300 px-3 py-3 font-normal"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-bold text-black">
            Reception note
            <textarea
              rows="3"
              maxLength={1000}
              value={form.notes}
              onChange={(event) =>
                update(
                  "notes",
                  event.target.value
                )
              }
              placeholder="Optional operational note"
              className="rounded-xl border border-stone-300 px-3 py-3 font-normal"
            />
          </label>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-stone-700">
            Availability, service eligibility, working hours, schedule blocks and appointment conflicts are validated by the same booking engine used for scheduled appointments.
          </div>
        </form>

        <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-stone-200 p-4 sm:flex-row sm:justify-end sm:p-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-black hover:border-amber-400 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="walk-in-form"
            disabled={
              saving || loading
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-black hover:bg-amber-300 disabled:opacity-50"
          >
            {saving ? (
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
            ) : (
              <UserPlus size={17} />
            )}
            {saving
              ? "Adding walk-in…"
              : "Add walk-in"}
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}
