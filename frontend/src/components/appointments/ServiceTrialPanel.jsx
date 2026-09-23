import {
  BadgePoundSterling,
  CalendarPlus,
  CheckCircle2,
  FlaskConical,
  LoaderCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import appointmentManagementApi from "../../Services/appointmentManagementApi.js";
import serviceTrialService from "../../Services/serviceTrialService.js";
import { AuthContext } from "../../context/AuthContext.jsx";
import { hasPermission } from "../../utils/permissions.js";

function entityName(entity, fallback = "Unknown") {
  if (!entity || typeof entity !== "object") return fallback;
  return (
    entity.fullName ||
    entity.preferredName ||
    entity.name ||
    [entity.firstName, entity.lastName].filter(Boolean).join(" ") ||
    fallback
  );
}

function currency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  date.setMinutes(date.getMinutes() - offset);
  return date.toISOString().slice(0, 16);
}

function iso(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function errorText(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "The service trial operation failed."
  );
}

function blankDefinition() {
  return {
    id: "",
    service: "",
    name: "",
    description: "",
    trialPrice: "",
    trialDuration: 30,
    maxUsesPerCustomer: 1,
    cooldownDays: 0,
    conversionWindowDays: 90,
    validFrom: "",
    validUntil: "",
    active: true,
    published: false,
  };
}

export default function ServiceTrialPanel({
  services = [],
  stylists = [],
  appointments = [],
  onChanged,
}) {
  const { user } = useContext(AuthContext) || {};
  const canRead = hasPermission(user, "appointment:read");
  const canBook = hasPermission(user, "appointment:create");
  const canConvert = hasPermission(user, "appointment:update");
  const canManage = hasPermission(user, "service:update");

  const [definitions, setDefinitions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [definitionForm, setDefinitionForm] = useState(blankDefinition);
  const [bookingForm, setBookingForm] = useState({
    trial: "",
    customer: "",
    stylist: "",
    startsAt: "",
    notes: "",
  });
  const [conversionDrafts, setConversionDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeServices = useMemo(
    () =>
      services.filter(
        (item) => item.active !== false && item.bookable !== false
      ),
    [services]
  );

  const activeStylists = useMemo(
    () =>
      stylists.filter(
        (item) =>
          item.isActive !== false &&
          item.active !== false &&
          item.acceptsAppointments !== false
      ),
    [stylists]
  );

  const activeDefinitions = useMemo(
    () => definitions.filter((item) => item.active !== false),
    [definitions]
  );

  const load = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [definitionResult, bookingResult] = await Promise.all([
        serviceTrialService.listDefinitions({ includeInactive: true }),
        serviceTrialService.listBookings({ limit: 200 }),
      ]);
      setDefinitions(
        Array.isArray(definitionResult?.items) ? definitionResult.items : []
      );
      setBookings(
        Array.isArray(bookingResult?.items) ? bookingResult.items : []
      );
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  const searchCustomers = useCallback(async () => {
    if (!canBook) return;
    setError("");
    try {
      const result = await appointmentManagementApi.searchCustomers(
        customerSearch
      );
      setCustomers(
        Array.isArray(result?.customers) ? result.customers : []
      );
    } catch (requestError) {
      setError(errorText(requestError));
    }
  }, [canBook, customerSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (canBook) void searchCustomers();
  }, [canBook]);

  function updateDefinitionField(field, value) {
    setDefinitionForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function editDefinition(definition) {
    setDefinitionForm({
      id: definition._id,
      service: String(definition.service?._id || definition.service || ""),
      name: definition.name || "",
      description: definition.description || "",
      trialPrice: definition.trialPrice ?? "",
      trialDuration: definition.trialDuration ?? 30,
      maxUsesPerCustomer: definition.maxUsesPerCustomer ?? 1,
      cooldownDays: definition.cooldownDays ?? 0,
      conversionWindowDays: definition.conversionWindowDays ?? 90,
      validFrom: definition.validFrom
        ? String(definition.validFrom).slice(0, 10)
        : "",
      validUntil: definition.validUntil
        ? String(definition.validUntil).slice(0, 10)
        : "",
      active: definition.active !== false,
      published: definition.published === true,
    });
  }

  async function saveDefinition() {
    if (!definitionForm.service || !definitionForm.name.trim()) {
      setError("A trial needs a service and name.");
      return;
    }

    const payload = {
      service: definitionForm.service,
      name: definitionForm.name.trim(),
      description: definitionForm.description,
      trialPrice: Number(definitionForm.trialPrice || 0),
      trialDuration: Number(definitionForm.trialDuration || 1),
      maxUsesPerCustomer: Number(definitionForm.maxUsesPerCustomer || 1),
      cooldownDays: Number(definitionForm.cooldownDays || 0),
      conversionWindowDays: Number(definitionForm.conversionWindowDays || 90),
      validFrom: definitionForm.validFrom || null,
      validUntil: definitionForm.validUntil || null,
      active: Boolean(definitionForm.active),
      published: Boolean(definitionForm.published),
    };

    setBusy("definition");
    setError("");
    setSuccess("");
    try {
      if (definitionForm.id) {
        await serviceTrialService.updateDefinition(definitionForm.id, payload);
        setSuccess("Service trial definition updated.");
      } else {
        await serviceTrialService.createDefinition(payload);
        setSuccess("Service trial definition created.");
      }
      setDefinitionForm(blankDefinition());
      await load();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setBusy("");
    }
  }

  async function bookTrial() {
    if (
      !bookingForm.trial ||
      !bookingForm.customer ||
      !bookingForm.stylist ||
      !bookingForm.startsAt
    ) {
      setError("Select a trial, customer, stylist, date and time.");
      return;
    }

    setBusy("booking");
    setError("");
    setSuccess("");
    try {
      await serviceTrialService.book({
        trial: bookingForm.trial,
        customer: bookingForm.customer,
        stylist: bookingForm.stylist,
        startsAt: iso(bookingForm.startsAt),
        notes: bookingForm.notes,
      });
      setSuccess(
        "Trial booked through the canonical appointment engine with server-controlled trial price and duration."
      );
      setBookingForm({
        trial: "",
        customer: "",
        stylist: "",
        startsAt: "",
        notes: "",
      });
      await load();
      await onChanged?.();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setBusy("");
    }
  }

  function conversionCandidates(booking) {
    const customerId = String(
      booking.customer?._id || booking.customer || ""
    );
    const serviceId = String(
      booking.trial?.service?._id ||
        booking.trial?.service ||
        booking.appointment?.service?._id ||
        booking.appointment?.service ||
        ""
    );
    const trialAppointmentId = String(
      booking.appointment?._id || booking.appointment || ""
    );
    const trialStart = new Date(
      booking.appointment?.startsAt ||
        booking.appointment?.appointmentDate ||
        booking.createdAt
    );
    const deadline = new Date(
      trialStart.getTime() +
        Number(booking.conversionWindowDaysSnapshot || 90) * 86_400_000
    );

    return appointments.filter((appointment) => {
      const start = new Date(
        appointment.startsAt || appointment.appointmentDate
      );
      return (
        String(appointment._id) !== trialAppointmentId &&
        String(appointment.customer?._id || appointment.customer || "") ===
          customerId &&
        String(appointment.service?._id || appointment.service || "") ===
          serviceId &&
        !["cancelled", "no_show"].includes(appointment.status) &&
        start > trialStart &&
        start <= deadline
      );
    });
  }

  async function recordConversion(booking) {
    const appointment = conversionDrafts[booking._id];
    if (!appointment) {
      setError(
        "Choose a later normal appointment from the current appointment date range."
      );
      return;
    }

    setBusy(`conversion-${booking._id}`);
    setError("");
    setSuccess("");
    try {
      await serviceTrialService.recordConversion(booking._id, appointment);
      setSuccess("Trial-to-standard-service conversion recorded.");
      await load();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setBusy("");
    }
  }

  if (!canRead) return null;

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-violet-600">
            Stage 2 · Service trials
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            Controlled trial offers and conversion tracking
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Trial price, duration, repeat limits and conversion window live in a
            separate governed definition. The permanent service catalogue is not
            rewritten.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh trials
        </button>
      </header>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          {success}
        </div>
      ) : null}

      {canManage ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
          <div className="flex items-center gap-2">
            <FlaskConical size={17} className="text-violet-700" />
            <h3 className="font-bold text-slate-900">
              {definitionForm.id ? "Edit trial definition" : "Create trial definition"}
            </h3>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-bold text-slate-700">
              Service
              <select
                value={definitionForm.service}
                onChange={(event) => updateDefinitionField("service", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="">Select service</option>
                {activeServices.map((service) => (
                  <option key={service._id} value={service._id}>{service.name}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-bold text-slate-700">
              Trial name
              <input
                value={definitionForm.name}
                onChange={(event) => updateDefinitionField("name", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="text-xs font-bold text-slate-700">
              Trial price (£)
              <input
                type="number"
                min="0"
                step="0.01"
                value={definitionForm.trialPrice}
                onChange={(event) => updateDefinitionField("trialPrice", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="text-xs font-bold text-slate-700">
              Trial duration (minutes)
              <input
                type="number"
                min="1"
                max="1440"
                value={definitionForm.trialDuration}
                onChange={(event) => updateDefinitionField("trialDuration", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="text-xs font-bold text-slate-700">
              Uses per customer
              <input
                type="number"
                min="1"
                max="10"
                value={definitionForm.maxUsesPerCustomer}
                onChange={(event) => updateDefinitionField("maxUsesPerCustomer", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="text-xs font-bold text-slate-700">
              Cooldown days
              <input
                type="number"
                min="0"
                value={definitionForm.cooldownDays}
                onChange={(event) => updateDefinitionField("cooldownDays", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="text-xs font-bold text-slate-700">
              Conversion window days
              <input
                type="number"
                min="1"
                value={definitionForm.conversionWindowDays}
                onChange={(event) => updateDefinitionField("conversionWindowDays", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="text-xs font-bold text-slate-700">
              Description
              <input
                value={definitionForm.description}
                onChange={(event) => updateDefinitionField("description", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="text-xs font-bold text-slate-700">
              Valid from
              <input
                type="date"
                value={definitionForm.validFrom}
                onChange={(event) => updateDefinitionField("validFrom", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="text-xs font-bold text-slate-700">
              Valid until
              <input
                type="date"
                value={definitionForm.validUntil}
                onChange={(event) => updateDefinitionField("validUntil", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="flex items-center gap-2 self-end pb-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={definitionForm.active}
                onChange={(event) => updateDefinitionField("active", event.target.checked)}
              />
              Active
            </label>

            <label className="flex items-center gap-2 self-end pb-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={definitionForm.published}
                onChange={(event) => updateDefinitionField("published", event.target.checked)}
              />
              Published
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy === "definition"}
              onClick={() => void saveDefinition()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              <BadgePoundSterling size={16} />
              {definitionForm.id ? "Save trial" : "Create trial"}
            </button>
            {definitionForm.id ? (
              <button
                type="button"
                onClick={() => setDefinitionForm(blankDefinition())}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700"
              >
                Cancel edit
              </button>
            ) : null}
          </div>

          {definitions.length > 0 ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {definitions.map((definition) => (
                <button
                  type="button"
                  key={definition._id}
                  onClick={() => editDefinition(definition)}
                  className="rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-violet-300"
                >
                  <span className="text-sm font-bold text-slate-900">{definition.name}</span>
                  <span className="mt-1 block text-xs text-slate-600">
                    {entityName(definition.service, "Service")} · {currency(definition.trialPrice)} · {definition.trialDuration} min · {definition.maxUsesPerCustomer} use(s)
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">
                    {definition.active ? "Active" : "Inactive"} · {definition.published ? "Published" : "Internal"}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {canBook ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex-1 text-xs font-bold text-slate-700">
              Find customer
              <span className="relative mt-1 block">
                <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                <input
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void searchCustomers();
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-normal"
                  placeholder="Name, email or phone"
                />
              </span>
            </label>
            <button
              type="button"
              onClick={() => void searchCustomers()}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700"
            >
              Search
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-xs font-bold text-slate-700">
              Trial
              <select
                value={bookingForm.trial}
                onChange={(event) =>
                  setBookingForm((current) => ({ ...current, trial: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="">Select trial</option>
                {activeDefinitions.map((definition) => (
                  <option key={definition._id} value={definition._id}>
                    {definition.name} · {currency(definition.trialPrice)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-bold text-slate-700">
              Customer
              <select
                value={bookingForm.customer}
                onChange={(event) =>
                  setBookingForm((current) => ({ ...current, customer: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>{entityName(customer)}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-bold text-slate-700">
              Stylist
              <select
                value={bookingForm.stylist}
                onChange={(event) =>
                  setBookingForm((current) => ({ ...current, stylist: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="">Select stylist</option>
                {activeStylists.map((stylist) => (
                  <option key={stylist._id} value={stylist._id}>{entityName(stylist)}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-bold text-slate-700">
              Date and time
              <input
                type="datetime-local"
                value={bookingForm.startsAt}
                onChange={(event) =>
                  setBookingForm((current) => ({ ...current, startsAt: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="text-xs font-bold text-slate-700">
              Booking note
              <input
                value={bookingForm.notes}
                onChange={(event) =>
                  setBookingForm((current) => ({ ...current, notes: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={busy === "booking"}
            onClick={() => void bookTrial()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            <CalendarPlus size={16} />
            {busy === "booking" ? "Booking…" : "Book service trial"}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm font-bold text-slate-600">
          <LoaderCircle size={18} className="animate-spin" />
          Loading service trials…
        </div>
      ) : bookings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No service trials have been booked yet.
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const appointment = booking.appointment || {};
            const candidates = conversionCandidates(booking);
            return (
              <article key={booking._id} className="rounded-xl border border-slate-200 p-4">
                <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {entityName(booking.customer)} · {booking.trial?.name || "Service trial"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {entityName(booking.trial?.service || appointment.service, "Service")} · {currency(booking.priceSnapshot)} · {booking.durationSnapshot} min
                    </p>
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="font-bold">Appointment:</span>{" "}
                    {localDateTime(appointment.startsAt || appointment.appointmentDate).replace("T", " ")}
                    <br />
                    <span className="font-bold">Status:</span> {String(appointment.status || "pending").replaceAll("_", " ")}
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="font-bold">Eligibility snapshot:</span>{" "}
                    {booking.maxUsesSnapshot} use(s), {booking.cooldownDaysSnapshot} day cooldown
                    <br />
                    <span className="font-bold">Conversion window:</span>{" "}
                    {booking.conversionWindowDaysSnapshot} days
                  </div>
                  {booking.convertedAppointment ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                      <CheckCircle2 size={14} />
                      Converted
                    </span>
                  ) : null}
                </div>

                {!booking.convertedAppointment && canConvert ? (
                  <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 md:flex-row md:items-end">
                    <label className="flex-1 text-xs font-bold text-slate-700">
                      Later standard appointment
                      <select
                        value={conversionDrafts[booking._id] || ""}
                        onChange={(event) =>
                          setConversionDrafts((current) => ({
                            ...current,
                            [booking._id]: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
                      >
                        <option value="">
                          {candidates.length
                            ? "Select conversion appointment"
                            : "No candidate in the current appointment date range"}
                        </option>
                        {candidates.map((candidate) => (
                          <option key={candidate._id} value={candidate._id}>
                            {localDateTime(candidate.startsAt || candidate.appointmentDate).replace("T", " ")} · {entityName(candidate.stylist, "Stylist")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={
                        busy === `conversion-${booking._id}` ||
                        !conversionDrafts[booking._id]
                      }
                      onClick={() => void recordConversion(booking)}
                      className="min-h-10 rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm font-bold text-emerald-700 disabled:opacity-50"
                    >
                      Record conversion
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
