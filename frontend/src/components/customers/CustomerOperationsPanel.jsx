import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  Mail,
  MessageSquareText,
  Phone,
  PoundSterling,
  RefreshCcw,
  StickyNote,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  getCustomerOperations,
} from "../../services/customerProfileService.js";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function appointmentDate(appointment) {
  if (appointment?.startsAt) {
    return appointment.startsAt;
  }

  if (!appointment?.appointmentDate) {
    return null;
  }

  const date = new Date(appointment.appointmentDate);
  const [hours = 0, minutes = 0] = String(
    appointment.appointmentTime || "00:00"
  )
    .split(":")
    .map(Number);

  date.setHours(hours, minutes, 0, 0);

  return date;
}

function statusClasses(status) {
  const classes = {
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    confirmed: "border-blue-200 bg-blue-50 text-blue-700",
    checked_in: "border-cyan-200 bg-cyan-50 text-cyan-700",
    in_progress: "border-violet-200 bg-violet-50 text-violet-700",
    completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cancelled: "border-slate-200 bg-slate-100 text-slate-600",
    no_show: "border-red-200 bg-red-50 text-red-700",
  };

  return classes[status] || classes.pending;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  warning = false,
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {label}
          </p>

          <p
            className={`mt-2 text-2xl font-bold ${
              warning ? "text-red-700" : "text-slate-900"
            }`}
          >
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {detail}
          </p>
        </div>

        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            warning
              ? "bg-red-50 text-red-600"
              : "bg-indigo-50 text-indigo-600"
          }`}
        >
          <Icon size={19} />
        </span>
      </div>
    </article>
  );
}

function AppointmentItem({ appointment }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-900">
            {appointment.service?.name || "Salon service"}
          </p>

          <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
            <Clock3 size={14} />
            {formatDateTime(appointmentDate(appointment))}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Stylist: {appointment.stylist?.name || "Not assigned"}
          </p>
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses(
            appointment.status
          )}`}
        >
          {formatLabel(appointment.status)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-600">
        <span>
          Value: {formatCurrency(
            appointment.finalPrice ?? appointment.totalPrice
          )}
        </span>
        <span>Paid: {formatCurrency(appointment.amountPaid)}</span>
        <span>Due: {formatCurrency(appointment.balanceDue)}</span>
      </div>
    </article>
  );
}

export default function CustomerOperationsPanel({ customerId }) {
  const [operations, setOperations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOperations = useCallback(async () => {
    if (!customerId) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await getCustomerOperations(customerId);
      setOperations(response);
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Unable to load customer operations."
      );
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  if (loading && !operations) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
          <Loader2 size={20} className="animate-spin" />
          Loading Customer 360…
        </div>
      </div>
    );
  }

  if (error && !operations) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle size={21} className="mt-0.5 text-red-600" />
          <div>
            <p className="font-bold text-red-800">
              Customer 360 unavailable
            </p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={loadOperations}
              className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const customer = operations?.customer || {};
  const appointments = operations?.appointments || {};
  const notes = operations?.notes || {};
  const communications = operations?.communications || {};

  const upcoming = Array.isArray(appointments.upcoming)
    ? appointments.upcoming
    : [];
  const recent = Array.isArray(appointments.recent)
    ? appointments.recent
    : [];
  const recentNotes = Array.isArray(notes.recent) ? notes.recent : [];
  const recentContacts = Array.isArray(communications.recent)
    ? communications.recent
    : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            Customer 360
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            Operational overview
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Appointments, payments, notes and customer contact activity.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {customer.email ? (
            <a
              href={`mailto:${customer.email}`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Mail size={16} />
              Email
            </a>
          ) : null}

          {customer.phone ? (
            <a
              href={`tel:${customer.phone}`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Phone size={16} />
              Call
            </a>
          ) : null}

          <button
            type="button"
            onClick={loadOperations}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <RefreshCcw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          icon={CalendarDays}
          label="Appointments"
          value={appointments.total || 0}
          detail={`${appointments.completed || 0} completed`}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Completion"
          value={`${appointments.completionRate || 0}%`}
          detail={`${appointments.noShows || 0} no-shows`}
        />
        <SummaryCard
          icon={PoundSterling}
          label="Booked value"
          value={formatCurrency(appointments.totalBookedValue)}
          detail={`${formatCurrency(appointments.totalPaid)} collected`}
        />
        <SummaryCard
          icon={CreditCard}
          label="Outstanding"
          value={formatCurrency(appointments.outstandingBalance)}
          detail="Unpaid appointment balance"
          warning={Number(appointments.outstandingBalance) > 0}
        />
        <SummaryCard
          icon={StickyNote}
          label="Follow-ups"
          value={notes.openFollowUps || 0}
          detail={`${notes.overdueFollowUps || 0} overdue`}
          warning={Number(notes.overdueFollowUps) > 0}
        />
        <SummaryCard
          icon={MessageSquareText}
          label="Contacts"
          value={communications.total || 0}
          detail="Logged communications"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                Upcoming appointments
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                The next active bookings for this customer.
              </p>
            </div>
            <Link
              to="/appointments"
              className="text-sm font-bold text-indigo-600 hover:text-indigo-700"
            >
              Manage
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {upcoming.length > 0 ? (
              upcoming.map((appointment) => (
                <AppointmentItem
                  key={appointment.id}
                  appointment={appointment}
                />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No upcoming appointments.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="font-bold text-slate-900">
            Recent appointments
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            The latest appointment history.
          </p>

          <div className="mt-4 space-y-3">
            {recent.length > 0 ? (
              recent.slice(0, 5).map((appointment) => (
                <AppointmentItem
                  key={appointment.id}
                  appointment={appointment}
                />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No appointment history.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-900">
            Notes and follow-ups
          </h3>

          <div className="mt-4 space-y-3">
            {recentNotes.length > 0 ? (
              recentNotes.map((note) => (
                <article
                  key={note._id || note.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-900">
                      {note.title || formatLabel(note.type)}
                    </p>
                    {note.pinned ? (
                      <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">
                        Pinned
                      </span>
                    ) : null}
                    {note.requiresFollowUp && !note.followUpCompleted ? (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                        Follow-up required
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-600">
                    {note.content}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {formatDate(note.createdAt)}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No customer notes recorded.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-900">
            Recent communications
          </h3>

          <div className="mt-4 space-y-3">
            {recentContacts.length > 0 ? (
              recentContacts.map((contact) => (
                <article
                  key={contact._id || contact.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-slate-900">
                      {formatLabel(contact.channel)}
                    </p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                      {formatLabel(contact.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {contact.subject || formatLabel(contact.campaignType)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                    {contact.message || "No message content."}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {formatDateTime(contact.sentAt || contact.createdAt)}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No communication history.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
