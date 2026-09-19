import {
  CalendarClock,
  Search,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import appointmentManagementApi from "../../Services/appointmentManagementApi.js";
import useModalFocusTrap from "../../hooks/useModalFocusTrap.js";

const STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "no_show",
  "cancelled",
];

function idOf(value) {
  if (
    value &&
    typeof value === "object"
  ) {
    return String(
      value._id ||
        value.id ||
        ""
    );
  }

  return String(
    value || ""
  );
}

function nameOf(value) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return "";
  }

  return (
    String(
      value.fullName ||
        value.name ||
        ""
    ).trim() ||
    [
      value.firstName,
      value.lastName,
    ]
      .map(
        (part) =>
          String(
            part || ""
          ).trim()
      )
      .filter(Boolean)
      .join(" ")
  );
}

function dateInput(value) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const year =
    date.getFullYear();
  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");
  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return (
    year +
    "-" +
    month +
    "-" +
    day
  );
}

function timeInput(value) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return (
    String(
      date.getHours()
    ).padStart(2, "0") +
    ":" +
    String(
      date.getMinutes()
    ).padStart(2, "0")
  );
}

function errorMessage(
  error,
  fallback
) {
  return (
    error?.response?.data
      ?.message ||
    error?.message ||
    fallback
  );
}

export default function AppointmentEditorDialog({
  open,
  appointment = null,
  initialStart = null,
  services = [],
  stylists = [],
  canCreate = false,
  canUpdate = false,
  canCancel = false,
  onClose,
  onSaved,
}) {
  const modalPanelRef = useRef(null);
  const editing =
    Boolean(
      appointment?._id
    );

  const [form, setForm] =
    useState({
      customer: "",
      stylist: "",
      service: "",
      date: "",
      time: "",
      status: "pending",
      notes: "",
      internalNotes: "",
      reason: "",
    });
  const [
    customerSearch,
    setCustomerSearch,
  ] = useState("");
  const [
    customers,
    setCustomers,
  ] = useState([]);
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
  const [
    notice,
    setNotice,
  ] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const start =
      appointment?.startsAt ||
      appointment
        ?.appointmentDate ||
      initialStart ||
      new Date();

    setForm({
      customer:
        idOf(
          appointment?.customer
        ),
      stylist:
        idOf(
          appointment?.stylist
        ),
      service:
        idOf(
          appointment?.service
        ),
      date:
        dateInput(start),
      time:
        appointment
          ?.appointmentTime ||
        timeInput(start),
      status:
        appointment?.status ||
        "pending",
      notes:
        appointment?.notes ||
        "",
      internalNotes:
        appointment
          ?.internalNotes ||
        "",
      reason: "",
    });

    setCustomerSearch("");
    setCustomers(
      appointment?.customer
        ? [
            appointment
              .customer,
          ]
        : []
    );
    setError("");
    setNotice("");
  }, [
    appointment,
    initialStart,
    open,
  ]);

  useEffect(() => {
    if (
      !open ||
      editing ||
      !canCreate
    ) {
      return;
    }

    const timer =
      window.setTimeout(
        async () => {
          setSearching(true);

          try {
            const result =
              await appointmentManagementApi.searchCustomers(
                customerSearch
              );

            setCustomers(
              result.customers ||
                []
            );
          } catch (
            requestError
          ) {
            setError(
              errorMessage(
                requestError,
                "Customers could not be loaded."
              )
            );
          } finally {
            setSearching(
              false
            );
          }
        },
        250
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [
    canCreate,
    customerSearch,
    editing,
    open,
  ]);

  const selectedCustomer =
    useMemo(
      () =>
        customers.find(
          (customer) =>
            idOf(customer) ===
            form.customer
        ) ||
        appointment?.customer ||
        null,
      [
        appointment,
        customers,
        form.customer,
      ]
    );

  function update(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
    setError("");
    setNotice("");
  }

  async function save(
    event
  ) {
    event.preventDefault();

    if (
      editing &&
      !canUpdate
    ) {
      setError(
        "You do not have permission to change this appointment."
      );
      return;
    }

    if (
      !editing &&
      !canCreate
    ) {
      setError(
        "You do not have permission to create appointments."
      );
      return;
    }

    if (
      !editing &&
      !form.customer
    ) {
      setError(
        "Choose a customer."
      );
      return;
    }

    if (
      !form.stylist ||
      !form.service ||
      !form.date ||
      !form.time
    ) {
      setError(
        "Customer, stylist, service, date and time are required."
      );
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (editing) {
        await appointmentManagementApi.reschedule(
          appointment._id,
          {
            stylist:
              form.stylist,
            service:
              form.service,
            appointmentDate:
              form.date,
            appointmentTime:
              form.time,
            reason:
              form.reason,
          }
        );

        setNotice(
          "Appointment updated."
        );
      } else {
        await appointmentManagementApi.create(
          {
            customer:
              form.customer,
            stylist:
              form.stylist,
            service:
              form.service,
            appointmentDate:
              form.date,
            appointmentTime:
              form.time,
            status:
              form.status,
            notes:
              form.notes,
            internalNotes:
              form.internalNotes,
          }
        );

        setNotice(
          "Appointment created."
        );
      }

      await onSaved?.();
      onClose?.();
    } catch (
      requestError
    ) {
      setError(
        errorMessage(
          requestError,
          editing
            ? "The appointment could not be updated."
            : "The appointment could not be created."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus() {
    if (!editing) {
      return;
    }

    const cancelling =
      form.status ===
      "cancelled";

    if (
      cancelling &&
      !canCancel
    ) {
      setError(
        "You do not have permission to cancel appointments."
      );
      return;
    }

    if (
      !cancelling &&
      !canUpdate
    ) {
      setError(
        "You do not have permission to change appointment status."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      await appointmentManagementApi.updateStatus(
        appointment._id,
        {
          status:
            form.status,
          reason:
            form.reason,
          requireReason:
            [
              "cancelled",
              "no_show",
            ].includes(
              form.status
            ),
        }
      );

      await onSaved?.();
      onClose?.();
    } catch (
      requestError
    ) {
      setError(
        errorMessage(
          requestError,
          "The appointment status could not be changed."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  const closeDialog =
    useCallback(() => {
      if (!saving) {
        onClose?.();
      }
    }, [onClose, saving]);

  const setDialogOpen =
    useCallback(
      (nextOpen) => {
        if (!nextOpen) {
          closeDialog();
        }
      },
      [closeDialog]
    );

  useModalFocusTrap({
    open,
    containerRef:
      modalPanelRef,
    setOpen:
      setDialogOpen,
  });

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const prior =
      document.body.style
        .overflow;
    document.body.style
      .overflow = "hidden";

    return () => {
      document.body.style
        .overflow = prior;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-2 sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget &&
          !saving
        ) {
          closeDialog();
        }
      }}
    >
      <section
        ref={modalPanelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="appointment-editor-title"
        className="max-h-[calc(100dvh-1rem)] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-2xl border border-stone-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-200 bg-white px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-black">
              <CalendarClock
                size={20}
              />
            </span>
            <div>
              <h2
                id="appointment-editor-title"
                className="text-xl font-black text-black"
              >
                {editing
                  ? "Manage appointment"
                  : "Add appointment"}
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                {editing
                  ? "SalonAI validates rescheduling and status changes against permissions, availability and conflicts."
                  : "Create an appointment directly in the SalonAI internal calendar."}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close appointment editor"
            disabled={saving}
            onClick={closeDialog}
            className="min-h-11 min-w-11 rounded-xl border border-stone-300 p-2 text-black hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </header>

        <form
          className="grid gap-5 p-4 sm:p-6"
          onSubmit={save}
        >
          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800"
            >
              {error}
            </div>
          ) : null}

          {notice ? (
            <div
              role="status"
              className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-black"
            >
              {notice}
            </div>
          ) : null}

          {editing ? (
            <div className="rounded-2xl bg-stone-100 p-4">
              <span className="text-xs font-black uppercase tracking-wide text-stone-500">
                Customer
              </span>
              <p className="mt-1 font-bold text-black">
                {nameOf(
                  selectedCustomer
                ) ||
                  "Customer"}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {selectedCustomer
                  ?.email ||
                  selectedCustomer
                    ?.phone ||
                  "No contact detail shown"}
              </p>
            </div>
          ) : (
            <div>
              <label
                htmlFor="appointment-customer-search"
                className="text-sm font-bold text-black"
              >
                Customer
              </label>

              <div className="mt-2 flex items-center gap-2 rounded-xl border border-stone-300 px-3 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-200">
                <Search
                  size={17}
                  className="text-stone-500"
                />
                <input
                  id="appointment-customer-search"
                  type="search"
                  value={
                    customerSearch
                  }
                  onChange={(
                    event
                  ) =>
                    setCustomerSearch(
                      event.target
                        .value
                    )
                  }
                  placeholder="Search name, email or phone"
                  className="min-w-0 flex-1 border-0 bg-transparent py-3 outline-none"
                />
              </div>

              <select
                required
                value={
                  form.customer
                }
                onChange={(
                  event
                ) =>
                  update(
                    "customer",
                    event.target
                      .value
                  )
                }
                className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm"
              >
                <option value="">
                  {searching
                    ? "Searching customers…"
                    : "Choose customer"}
                </option>
                {customers.map(
                  (customer) => (
                    <option
                      key={idOf(
                        customer
                      )}
                      value={idOf(
                        customer
                      )}
                    >
                      {nameOf(
                        customer
                      ) ||
                        "Customer"}
                      {customer.email
                        ? " — " +
                          customer.email
                        : ""}
                    </option>
                  )
                )}
              </select>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-black">
              Stylist
              <select
                required
                disabled={
                  editing &&
                  !canUpdate
                }
                value={
                  form.stylist
                }
                onChange={(
                  event
                ) =>
                  update(
                    "stylist",
                    event.target
                      .value
                  )
                }
                className="rounded-xl border border-stone-300 bg-white px-3 py-3 font-normal disabled:bg-stone-100"
              >
                <option value="">
                  Choose stylist
                </option>
                {stylists.map(
                  (stylist) => (
                    <option
                      key={idOf(
                        stylist
                      )}
                      value={idOf(
                        stylist
                      )}
                    >
                      {nameOf(
                        stylist
                      ) ||
                        "Stylist"}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-bold text-black">
              Service
              <select
                required
                disabled={
                  editing &&
                  !canUpdate
                }
                value={
                  form.service
                }
                onChange={(
                  event
                ) =>
                  update(
                    "service",
                    event.target
                      .value
                  )
                }
                className="rounded-xl border border-stone-300 bg-white px-3 py-3 font-normal disabled:bg-stone-100"
              >
                <option value="">
                  Choose service
                </option>
                {services.map(
                  (service) => (
                    <option
                      key={idOf(
                        service
                      )}
                      value={idOf(
                        service
                      )}
                    >
                      {service.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-bold text-black">
              Date
              <input
                required
                type="date"
                disabled={
                  editing &&
                  !canUpdate
                }
                value={
                  form.date
                }
                onChange={(
                  event
                ) =>
                  update(
                    "date",
                    event.target
                      .value
                  )
                }
                className="rounded-xl border border-stone-300 px-3 py-3 font-normal disabled:bg-stone-100"
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-black">
              Time
              <input
                required
                type="time"
                step="300"
                disabled={
                  editing &&
                  !canUpdate
                }
                value={
                  form.time
                }
                onChange={(
                  event
                ) =>
                  update(
                    "time",
                    event.target
                      .value
                  )
                }
                className="rounded-xl border border-stone-300 px-3 py-3 font-normal disabled:bg-stone-100"
              />
            </label>
          </div>

          {!editing ? (
            <>
              <label className="grid gap-2 text-sm font-bold text-black">
                Initial status
                <select
                  value={
                    form.status
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "status",
                      event.target
                        .value
                    )
                  }
                  className="rounded-xl border border-stone-300 bg-white px-3 py-3 font-normal"
                >
                  <option value="pending">
                    Pending
                  </option>
                  <option value="confirmed">
                    Confirmed
                  </option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold text-black">
                Customer notes
                <textarea
                  rows="3"
                  value={
                    form.notes
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "notes",
                      event.target
                        .value
                    )
                  }
                  className="rounded-xl border border-stone-300 px-3 py-3 font-normal"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-black">
                Internal notes
                <textarea
                  rows="3"
                  value={
                    form.internalNotes
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "internalNotes",
                      event.target
                        .value
                    )
                  }
                  className="rounded-xl border border-stone-300 px-3 py-3 font-normal"
                />
              </label>
            </>
          ) : (
            <div className="grid gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <label className="grid gap-2 text-sm font-bold text-black">
                  Status
                  <select
                    value={
                      form.status
                    }
                    onChange={(
                      event
                    ) =>
                      update(
                        "status",
                        event.target
                          .value
                      )
                    }
                    className="rounded-xl border border-stone-300 bg-white px-3 py-3 font-normal"
                  >
                    {STATUSES.map(
                      (status) => (
                        <option
                          key={
                            status
                          }
                          value={
                            status
                          }
                        >
                          {status
                            .replaceAll(
                              "_",
                              " "
                            )
                            .replace(
                              /^./,
                              (
                                letter
                              ) =>
                                letter.toUpperCase()
                            )}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-bold text-black">
                  Change reason
                  <input
                    value={
                      form.reason
                    }
                    onChange={(
                      event
                    ) =>
                      update(
                        "reason",
                        event.target
                          .value
                      )
                    }
                    placeholder="Required for cancellation/no-show"
                    className="rounded-xl border border-stone-300 px-3 py-3 font-normal"
                  />
                </label>

                <button
                  type="button"
                  disabled={
                    saving ||
                    (form.status ===
                      "cancelled"
                      ? !canCancel
                      : !canUpdate)
                  }
                  onClick={() =>
                    void changeStatus()
                  }
                  className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-black text-black hover:border-amber-400 disabled:opacity-50"
                >
                  Update status
                </button>
              </div>
            </div>
          )}

          <footer className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-stone-200 bg-white pt-5 sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={closeDialog}
              className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-black hover:border-amber-400 disabled:opacity-50"
            >
              Close
            </button>

            {(!editing &&
              canCreate) ||
            (editing &&
              canUpdate) ? (
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-black hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50"
              >
                {saving
                  ? "Saving…"
                  : editing
                    ? "Save appointment"
                    : "Create appointment"}
              </button>
            ) : null}
          </footer>
        </form>
      </section>
    </div>
  );
}
