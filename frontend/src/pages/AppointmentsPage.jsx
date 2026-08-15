import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  LoaderCircle,
  PoundSterling,
  RefreshCw,
  Search,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";

import appointmentManagementApi from "../Services/appointmentManagementApi.js";
import serviceService from "../Services/serviceService.js";
import stylistService from "../Services/stylistService.js";
import StaffAppointmentCommercePanel from "../components/appointments/StaffAppointmentCommercePanel.jsx";

const STATUS_OPTIONS = [
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
];

const BULK_STATUS_OPTIONS = [
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
];

function isoDate(date) {
  const copy = new Date(date);
  const offset = copy.getTimezoneOffset();
  copy.setMinutes(copy.getMinutes() - offset);
  return copy.toISOString().slice(0, 10);
}

function initialDates() {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);
  start.setDate(start.getDate() - 14);
  end.setDate(end.getDate() + 30);
  return {
    startDate: isoDate(start),
    endDate: isoDate(end),
  };
}

function asArray(value, keys = []) {
  if (Array.isArray(value)) return value;
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
}

function normaliseStatus(value) {
  return String(value || "pending")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}

function statusLabel(value) {
  return normaliseStatus(value)
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function statusStyles(value) {
  switch (normaliseStatus(value)) {
    case "confirmed":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "checked_in":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    case "in_progress":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";
    case "no_show":
      return "border-orange-200 bg-orange-50 text-orange-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function paymentStyles(value) {
  switch (String(value || "pending").toLowerCase()) {
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "partially_paid":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "refunded":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "cancelled":
      return "border-slate-200 bg-slate-100 text-slate-600";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function entityName(entity, fallback) {
  if (!entity || typeof entity !== "object") return fallback;
  return (
    entity.fullName ||
    entity.name ||
    [entity.firstName, entity.lastName].filter(Boolean).join(" ") ||
    fallback
  );
}

function appointmentStart(appointment) {
  if (appointment?.startsAt) return new Date(appointment.startsAt);
  if (!appointment?.appointmentDate) return null;
  const date = new Date(appointment.appointmentDate);
  const [hours = 0, minutes = 0] = String(
    appointment.appointmentTime || "00:00"
  )
    .split(":")
    .map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function formatDateTime(appointment) {
  const value = appointmentStart(appointment);
  if (!value || Number.isNaN(value.getTime())) return "Date not set";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function inputDateTime(appointment) {
  const value = appointmentStart(appointment);
  if (!value || Number.isNaN(value.getTime())) return "";
  const offset = value.getTimezoneOffset();
  value.setMinutes(value.getMinutes() - offset);
  return value.toISOString().slice(0, 16);
}

function currency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function errorText(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "The appointment operation failed."
  );
}

function SummaryCard({ icon: Icon, label, value, detail }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={21} />
        </span>
      </div>
    </article>
  );
}

function StatusBadge({ value }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles(
        value
      )}`}
    >
      {statusLabel(value)}
    </span>
  );
}

function PaymentBadge({ value }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${paymentStyles(
        value
      )}`}
    >
      {statusLabel(value || "pending")}
    </span>
  );
}

function AppointmentModal({
  appointment,
  stylists,
  services,
  busy,
  onClose,
  onStatus,
  onReminder,
  onReschedule,
}) {
  const [nextStatus, setNextStatus] = useState(
    normaliseStatus(appointment.status)
  );
  const [reason, setReason] = useState("");
  const [channel, setChannel] = useState("email");
  const [hoursBefore, setHoursBefore] = useState(24);
  const [startsAt, setStartsAt] = useState(inputDateTime(appointment));
  const [stylist, setStylist] = useState(
    String(appointment.stylist?._id || appointment.stylist || "")
  );
  const [service, setService] = useState(
    String(appointment.service?._id || appointment.service || "")
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Appointment operations
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {entityName(appointment.customer, "Unknown customer")}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {formatDateTime(appointment)} · {entityName(appointment.service, "Service")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close appointment panel"
          >
            <X size={20} />
          </button>
        </header>

        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-900">Status workflow</h3>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              New status
            </label>
            <select
              value={nextStatus}
              onChange={(event) => setNextStatus(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Reason or operational note
            </label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              placeholder="Required for cancellations and no-shows"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus({ status: nextStatus, reason })}
              className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Update appointment status
            </button>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-900">Customer reminder</h3>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Channel
            </label>
            <select
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Hours before appointment
            </label>
            <input
              type="number"
              min="1"
              max="168"
              value={hoursBefore}
              onChange={(event) => setHoursBefore(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => onReminder({ channel, hoursBefore: Number(hoursBefore) })}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              <BellRing size={16} /> Queue reminder
            </button>
          </section>

          <div className="lg:col-span-2">
            <StaffAppointmentCommercePanel appointment={appointment} />
          </div>

          <section className="rounded-xl border border-slate-200 p-4 lg:col-span-2">
            <h3 className="font-bold text-slate-900">Reschedule booking</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-semibold text-slate-700">
                Date and time
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Stylist
                <select
                  value={stylist}
                  onChange={(event) => setStylist(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal"
                >
                  {stylists.map((item) => (
                    <option key={item._id} value={item._id}>
                      {entityName(item, "Stylist")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Service
                <select
                  value={service}
                  onChange={(event) => setService(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal"
                >
                  {services.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              disabled={busy || !startsAt || !stylist || !service}
              onClick={() =>
                onReschedule({
                  startsAt: new Date(startsAt).toISOString(),
                  stylist,
                  service,
                  reason: reason || "Management reschedule",
                })
              }
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <CalendarClock size={16} /> Check availability and reschedule
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const [dates, setDates] = useState(initialDates);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("confirmed");
  const [activeAppointment, setActiveAppointment] = useState(null);
  const [stylists, setStylists] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        startDate: dates.startDate,
        endDate: dates.endDate,
        limit: 2000,
      };
      const [calendarResult, summaryResult, stylistResult, serviceResult] =
        await Promise.all([
          appointmentManagementApi.getCalendar(params),
          appointmentManagementApi.getSummary(params),
          stylistService.getStylists({ limit: 200 }),
          serviceService.getServices(),
        ]);

      setAppointments(calendarResult?.items || []);
      setSummary(summaryResult?.summary || null);
      setStylists(
        asArray(stylistResult, ["stylists", "items"]).filter(
          (item) => item.isActive !== false && item.active !== false
        )
      );
      setServices(asArray(serviceResult, ["services", "items"]));
      setSelectedIds([]);
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setLoading(false);
    }
  }, [dates]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return appointments.filter((appointment) => {
      const statusMatches =
        status === "all" || normaliseStatus(appointment.status) === status;
      const textMatches =
        !query ||
        [
          entityName(appointment.customer, ""),
          appointment.customer?.email,
          entityName(appointment.stylist, ""),
          entityName(appointment.service, ""),
          appointment.invoiceNumber,
          appointment.notes,
        ].some((value) => String(value || "").toLowerCase().includes(query));
      return statusMatches && textMatches;
    });
  }, [appointments, search, status]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((item) => selectedIds.includes(item._id));

  async function runOperation(operation, message) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await operation();
      setSuccess(message);
      setActiveAppointment(null);
      await loadPage();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function applyBulkStatus() {
    if (selectedIds.length === 0) {
      setError("Select at least one appointment.");
      return;
    }
    const reason = ["cancelled", "no_show"].includes(bulkStatus)
      ? window.prompt("Enter the reason for this bulk status change:")
      : "Bulk management update";
    if (["cancelled", "no_show"].includes(bulkStatus) && !reason) return;

    await runOperation(
      () =>
        appointmentManagementApi.bulkUpdateStatus({
          appointmentIds: selectedIds,
          status: bulkStatus,
          reason,
          requireReason: ["cancelled", "no_show"].includes(bulkStatus),
        }),
      `${selectedIds.length} appointment(s) updated.`
    );
  }

  async function queueUpcomingReminders() {
    await runOperation(
      () => appointmentManagementApi.queueUpcomingReminders({ hoursBefore: 24, channel: "email" }),
      "Upcoming appointment reminders queued."
    );
  }

  const byStatus = summary?.byStatus || {};

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            Phase 3 operations
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Appointment operations
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Approve, check in, complete, reschedule and remind customers from one workflow.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={queueUpcomingReminders}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            <BellRing size={17} /> Queue 24-hour reminders
          </button>
          <button
            type="button"
            onClick={loadPage}
            disabled={loading || busy}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> {success}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={CalendarDays}
          label="Appointments"
          value={summary?.total ?? appointments.length}
          detail={`${dates.startDate} to ${dates.endDate}`}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Confirmed"
          value={byStatus.confirmed || 0}
          detail={`${byStatus.checked_in || 0} checked in`}
        />
        <SummaryCard
          icon={UsersRound}
          label="In service"
          value={byStatus.in_progress || 0}
          detail={`${byStatus.completed || 0} completed`}
        />
        <SummaryCard
          icon={PoundSterling}
          label="Outstanding"
          value={currency(summary?.totalOutstanding || 0)}
          detail={`${currency(summary?.totalPaid || 0)} collected`}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-5">
          <label className="text-sm font-semibold text-slate-700">
            From
            <input
              type="date"
              value={dates.startDate}
              onChange={(event) => setDates((current) => ({ ...current, startDate: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            To
            <input
              type="date"
              value={dates.endDate}
              onChange={(event) => setDates((current) => ({ ...current, endDate: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>{statusLabel(item)}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700 lg:col-span-2">
            Search
            <span className="relative mt-2 block">
              <Search className="absolute left-3 top-3 text-slate-400" size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Customer, stylist, service or invoice"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 font-normal"
              />
            </span>
          </label>
        </div>
      </section>

      {selectedIds.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-indigo-900">
            {selectedIds.length} appointment(s) selected
          </p>
          <div className="flex flex-wrap gap-2">
            <select
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value)}
              className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm"
            >
              {BULK_STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>{statusLabel(item)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyBulkStatus}
              disabled={busy}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Apply status
            </button>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm font-semibold text-slate-600">
            <LoaderCircle className="animate-spin" size={20} /> Loading appointments…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No appointments match this period and filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) =>
                        setSelectedIds(
                          event.target.checked ? filtered.map((item) => item._id) : []
                        )
                      }
                      aria-label="Select all visible appointments"
                    />
                  </th>
                  <th className="px-4 py-3">Appointment</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Service and stylist</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((appointment) => {
                  const id = appointment._id;
                  const customerId = appointment.customer?._id;
                  return (
                    <tr key={id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(id)}
                          onChange={(event) =>
                            setSelectedIds((current) =>
                              event.target.checked
                                ? [...new Set([...current, id])]
                                : current.filter((item) => item !== id)
                            )
                          }
                          aria-label={`Select appointment for ${entityName(appointment.customer, "customer")}`}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatDateTime(appointment)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {appointment.duration || appointment.service?.duration || 60} minutes
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                            <UserRound size={17} />
                          </span>
                          <div>
                            {customerId ? (
                              <Link
                                to={`/customers/${customerId}`}
                                className="text-sm font-semibold text-slate-900 hover:text-indigo-600"
                              >
                                {entityName(appointment.customer, "Unknown customer")}
                              </Link>
                            ) : (
                              <p className="text-sm font-semibold text-slate-900">
                                {entityName(appointment.customer, "Unknown customer")}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-slate-500">
                              {appointment.customer?.email || "No email"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {entityName(appointment.service, "Unknown service")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {entityName(appointment.stylist, "Unassigned stylist")}
                        </p>
                      </td>
                      <td className="px-4 py-4"><StatusBadge value={appointment.status} /></td>
                      <td className="px-4 py-4">
                        <PaymentBadge value={appointment.paymentStatus} />
                        <p className="mt-1 text-xs font-semibold text-slate-600">
                          {currency(appointment.balanceDue || 0)} due
                        </p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setActiveAppointment(appointment)}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {activeAppointment && (
        <AppointmentModal
          appointment={activeAppointment}
          stylists={stylists}
          services={services}
          busy={busy}
          onClose={() => setActiveAppointment(null)}
          onStatus={(payload) =>
            runOperation(
              () =>
                appointmentManagementApi.updateStatus(activeAppointment._id, {
                  ...payload,
                  requireReason: ["cancelled", "no_show"].includes(payload.status),
                }),
              "Appointment status updated."
            )
          }
          onReminder={(payload) =>
            runOperation(
              () => appointmentManagementApi.queueReminder(activeAppointment._id, payload),
              "Appointment reminder queued."
            )
          }
          onReschedule={(payload) =>
            runOperation(
              async () => {
                const serviceItem = services.find((item) => String(item._id) === payload.service);
                const duration = Number(serviceItem?.duration || activeAppointment.duration || 60);
                const start = new Date(payload.startsAt);
                const end = new Date(start.getTime() + duration * 60000);
                const result = await appointmentManagementApi.checkConflict({
                  stylist: payload.stylist,
                  service: payload.service,
                  start: start.toISOString(),
                  end: end.toISOString(),
                  excludeAppointmentId: activeAppointment._id,
                });
                if (result?.hasConflict) {
                  throw new Error("The selected stylist already has an overlapping appointment.");
                }
                return appointmentManagementApi.reschedule(activeAppointment._id, payload);
              },
              "Appointment rescheduled."
            )
          }
        />
      )}
    </div>
  );
}
