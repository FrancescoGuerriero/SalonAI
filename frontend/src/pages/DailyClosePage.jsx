import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CreditCard,
  FileWarning,
  History,
  LoaderCircle,
  LockKeyhole,
  PackageCheck,
  PoundSterling,
  RefreshCw,
  RotateCcw,
  Save,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  UsersRound,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import useAuth from "../hooks/useAuth.js";
import dailyCloseApi from "../services/dailyCloseApi.js";

const CHECKLIST_ITEMS = [
  {
    key: "appointmentsReviewed",
    label: "Appointments reviewed",
    description: "All appointment statuses and unresolved bookings have been checked.",
    icon: CalendarDays,
  },
  {
    key: "paymentsReconciled",
    label: "Payments reconciled",
    description: "Collected amounts, outstanding balances and payment methods agree.",
    icon: CreditCard,
  },
  {
    key: "cashCounted",
    label: "Cash counted",
    description: "The physical cash count has been entered and reviewed.",
    icon: Banknote,
  },
  {
    key: "ordersReviewed",
    label: "Product orders reviewed",
    description: "Paid, pending, ready and completed product orders have been checked.",
    icon: PackageCheck,
  },
  {
    key: "followUpsReviewed",
    label: "Follow-ups reviewed",
    description: "Customer callbacks, rebooking actions and overdue notes have been reviewed.",
    icon: ClipboardCheck,
  },
  {
    key: "premisesSecured",
    label: "Premises secured",
    description: "Equipment, doors, alarms and end-of-day safety checks are complete.",
    icon: ShieldCheck,
  },
];

function todayKey() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
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

function errorText(error) {
  const message =
    error?.response?.data?.message ||
    error?.message ||
    "The daily closing request failed.";

  const details = error?.response?.data?.details;

  if (details?.missing?.length) {
    return `${message} Missing: ${details.missing.map(formatLabel).join(", ")}.`;
  }

  return message;
}

function defaultChecklist() {
  return Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item.key, false]));
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

function SummaryCard({ icon: Icon, label, value, detail, warning = false }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className={`mt-2 text-2xl font-bold ${warning ? "text-red-700" : "text-slate-900"}`}>
            {value}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${warning ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600"}`}>
          <Icon size={19} />
        </span>
      </div>
    </article>
  );
}

function PersonLabel({ person, fallback }) {
  return <span>{person?.name || person?.email || fallback}</span>;
}

export default function DailyClosePage() {
  const { user } = useAuth();
  const canManage = ["admin", "manager"].includes(user?.role);

  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [checklist, setChecklist] = useState(defaultChecklist);
  const [countedCash, setCountedCash] = useState("0.00");
  const [notes, setNotes] = useState("");
  const [issueNotes, setIssueNotes] = useState("");
  const [forceClose, setForceClose] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [snapshot, historyRows] = await Promise.all([
        dailyCloseApi.get(selectedDate),
        dailyCloseApi.history({ to: selectedDate }),
      ]);

      setData(snapshot);
      setHistory(Array.isArray(historyRows) ? historyRows.slice(0, 8) : []);

      const close = snapshot?.close;

      setChecklist({
        ...defaultChecklist(),
        ...(close?.checklist || {}),
      });
      setCountedCash(String(close?.countedCash ?? snapshot?.summary?.expectedCash ?? 0));
      setNotes(close?.notes || "");
      setIssueNotes(close?.issueNotes || "");
      setForceClose(Boolean(close?.overrideReason));
      setOverrideReason(close?.overrideReason || "");
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const summary = data?.summary || {};
  const close = data?.close || null;
  const appointments = summary.appointments || {};
  const orders = summary.orders || {};
  const isClosed = close?.status === "closed";
  const allChecklistComplete = useMemo(
    () => CHECKLIST_ITEMS.every((item) => checklist[item.key] === true),
    [checklist]
  );
  const expectedCash = Number(summary.expectedCash || 0);
  const countedCashNumber = Math.max(Number(countedCash) || 0, 0);
  const cashVariance = countedCashNumber - expectedCash;
  const unresolvedItems = Array.isArray(appointments.unresolvedItems)
    ? appointments.unresolvedItems
    : [];

  function updateChecklist(key) {
    if (!canManage || isClosed) {
      return;
    }

    setChecklist((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function operationPayload() {
    return {
      date: selectedDate,
      checklist,
      countedCash: countedCashNumber,
      notes,
      issueNotes,
      forceClose,
      overrideReason,
    };
  }

  async function runOperation(operation, message) {
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const result = await operation();
      setData(result);
      setSuccess(message);
      await loadPage();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    await runOperation(
      () => dailyCloseApi.saveDraft(operationPayload()),
      "Daily closing draft saved."
    );
  }

  async function closeDay() {
    if (!allChecklistComplete) {
      setError("Complete every checklist item before closing the business day.");
      return;
    }

    if (appointments.unresolved > 0 && !forceClose) {
      setError("Resolve remaining appointments or enable the management override.");
      return;
    }

    const confirmed = window.confirm(
      `Close ${selectedDate}? This stores an audited snapshot of today's operations.`
    );

    if (!confirmed) {
      return;
    }

    await runOperation(
      () => dailyCloseApi.close(operationPayload()),
      "Business day closed successfully."
    );
  }

  async function reopenDay() {
    const reason = window.prompt(
      "Enter the audit reason for reopening this business day (at least 10 characters):"
    );

    if (!reason) {
      return;
    }

    await runOperation(
      () => dailyCloseApi.reopen({ date: selectedDate, reason }),
      "Business day reopened."
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            Phase 3 operations
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            End-of-day salon closing
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Reconcile appointments, revenue, product orders, cash and operational checks before closing the business day.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Business date
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800"
            />
          </label>

          <button
            type="button"
            onClick={loadPage}
            disabled={loading || busy}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {success}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
            <LoaderCircle size={20} className="animate-spin" />
            Loading daily operations…
          </div>
        </div>
      ) : (
        <>
          <section className={`rounded-2xl border p-5 ${isClosed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                {isClosed ? (
                  <LockKeyhole className="mt-0.5 text-emerald-700" size={22} />
                ) : (
                  <Clock3 className="mt-0.5 text-amber-700" size={22} />
                )}
                <div>
                  <p className={`font-bold ${isClosed ? "text-emerald-900" : "text-amber-900"}`}>
                    {isClosed ? "Business day closed" : "Business day open"}
                  </p>
                  <p className={`mt-1 text-sm ${isClosed ? "text-emerald-700" : "text-amber-700"}`}>
                    {isClosed
                      ? `Closed ${formatDateTime(close.closedAt)} by ${close.closedBy?.name || "management"}.`
                      : "Review the live totals and complete every checklist item before closing."}
                  </p>
                  {close?.reopenedAt ? (
                    <p className="mt-1 text-xs text-amber-700">
                      Last reopened {formatDateTime(close.reopenedAt)} by <PersonLabel person={close.reopenedBy} fallback="management" />: {close.reopenReason}
                    </p>
                  ) : null}
                </div>
              </div>

              {isClosed && canManage ? (
                <button
                  type="button"
                  onClick={reopenDay}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                >
                  <RotateCcw size={16} />
                  Reopen day
                </button>
              ) : null}
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <SummaryCard
              icon={CalendarDays}
              label="Appointments"
              value={appointments.total || 0}
              detail={`${appointments.completed || 0} completed`}
            />
            <SummaryCard
              icon={AlertTriangle}
              label="Unresolved"
              value={appointments.unresolved || 0}
              detail="Pending or active appointments"
              warning={Number(appointments.unresolved) > 0}
            />
            <SummaryCard
              icon={PoundSterling}
              label="Service revenue"
              value={formatCurrency(appointments.completedRevenue)}
              detail={`${formatCurrency(appointments.collected)} collected`}
            />
            <SummaryCard
              icon={CreditCard}
              label="Outstanding"
              value={formatCurrency(appointments.outstandingBalance)}
              detail="Appointment balance due"
              warning={Number(appointments.outstandingBalance) > 0}
            />
            <SummaryCard
              icon={ShoppingBag}
              label="Product revenue"
              value={formatCurrency(orders.revenue)}
              detail={`${orders.paid || 0} paid orders`}
            />
            <SummaryCard
              icon={UsersRound}
              label="Active stylists"
              value={summary.activeStylists || 0}
              detail={`${formatCurrency(summary.totalCollected)} total collected`}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Closing checklist</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Every item is required before the day can be closed.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {CHECKLIST_ITEMS.filter((item) => checklist[item.key]).length}/{CHECKLIST_ITEMS.length}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {CHECKLIST_ITEMS.map(({ key, label, description, icon: Icon }) => {
                    const checked = checklist[key] === true;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => updateChecklist(key)}
                        disabled={!canManage || isClosed}
                        className={`flex items-start gap-3 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed ${checked ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-indigo-300"}`}
                      >
                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${checked ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                          {checked ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                        </span>
                        <span>
                          <span className="block font-bold text-slate-900">{label}</span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Unresolved appointments</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Pending, confirmed, checked-in or in-progress bookings still open for this date.
                    </p>
                  </div>
                  <AlertTriangle size={20} className={unresolvedItems.length ? "text-amber-500" : "text-emerald-500"} />
                </div>

                <div className="mt-4 space-y-3">
                  {unresolvedItems.length ? (
                    unresolvedItems.map((appointment) => (
                      <article key={appointment.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">{appointment.customer}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {appointment.service} with {appointment.stylist} at {appointment.appointmentTime || "unscheduled"}
                            </p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses(appointment.status)}`}>
                            {formatLabel(appointment.status)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-600">
                          <span>Value: {formatCurrency(appointment.value)}</span>
                          <span>Paid: {formatCurrency(appointment.amountPaid)}</span>
                          <span>Due: {formatCurrency(appointment.balanceDue)}</span>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                      <BadgeCheck size={24} className="mx-auto text-emerald-600" />
                      <p className="mt-2 text-sm font-bold text-emerald-800">All appointments resolved</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Cash reconciliation</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase text-slate-500">Expected cash</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(expectedCash)}</p>
                  </div>
                  <label className="rounded-xl bg-slate-50 p-4">
                    <span className="text-xs font-bold uppercase text-slate-500">Counted cash</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={countedCash}
                      onChange={(event) => setCountedCash(event.target.value)}
                      disabled={!canManage || isClosed}
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-lg font-bold text-slate-900 disabled:bg-slate-100"
                    />
                  </label>
                  <div className={`rounded-xl p-4 ${Math.abs(cashVariance) < 0.005 ? "bg-emerald-50" : "bg-red-50"}`}>
                    <p className="text-xs font-bold uppercase text-slate-500">Variance</p>
                    <p className={`mt-1 text-xl font-bold ${Math.abs(cashVariance) < 0.005 ? "text-emerald-700" : "text-red-700"}`}>
                      {formatCurrency(cashVariance)}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Closing notes</h2>
                <label className="mt-4 block text-sm font-semibold text-slate-700">
                  Management notes
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    disabled={!canManage || isClosed}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                    placeholder="Summary of the trading day…"
                  />
                </label>
                <label className="mt-4 block text-sm font-semibold text-slate-700">
                  Issues or discrepancies
                  <textarea
                    rows={4}
                    value={issueNotes}
                    onChange={(event) => setIssueNotes(event.target.value)}
                    disabled={!canManage || isClosed}
                    className="mt-2 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 disabled:bg-slate-100"
                    placeholder="Cash differences, unresolved payments, incidents…"
                  />
                </label>
              </section>

              {appointments.unresolved > 0 && !isClosed ? (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={forceClose}
                      onChange={(event) => setForceClose(event.target.checked)}
                      disabled={!canManage}
                      className="mt-1 h-4 w-4"
                    />
                    <span>
                      <span className="block font-bold text-amber-900">Authorise closing override</span>
                      <span className="mt-1 block text-xs leading-5 text-amber-800">
                        Close the day while unresolved appointments remain. The reason is stored in the audit record.
                      </span>
                    </span>
                  </label>
                  {forceClose ? (
                    <textarea
                      rows={3}
                      value={overrideReason}
                      onChange={(event) => setOverrideReason(event.target.value)}
                      disabled={!canManage}
                      className="mt-4 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                      placeholder="Explain why management is closing with unresolved appointments…"
                    />
                  ) : null}
                </section>
              ) : null}

              {!isClosed && canManage ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Save size={17} />
                    Save draft
                  </button>
                  <button
                    type="button"
                    onClick={closeDay}
                    disabled={busy || !allChecklistComplete}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <LockKeyhole size={17} />
                    Close business day
                  </button>
                </div>
              ) : null}

              {!canManage ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  Daily closing can be viewed by salon staff, but only managers and administrators can save, close or reopen a day.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <History size={20} className="text-indigo-600" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">Recent closing history</h2>
                <p className="text-sm text-slate-500">The latest audited closing records up to the selected date.</p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Collected</th>
                    <th className="px-3 py-3">Cash variance</th>
                    <th className="px-3 py-3">Closed by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.length ? (
                    history.map((row) => (
                      <tr key={row._id || row.dateKey}>
                        <td className="px-3 py-3 font-semibold text-slate-900">{row.dateKey}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.status === "closed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {formatLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{formatCurrency(row.snapshot?.totalCollected)}</td>
                        <td className={`px-3 py-3 font-semibold ${Math.abs(Number(row.cashVariance || 0)) < 0.005 ? "text-emerald-700" : "text-red-700"}`}>
                          {formatCurrency(row.cashVariance)}
                        </td>
                        <td className="px-3 py-3 text-slate-600">{row.closedBy?.name || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-3 py-8 text-center text-slate-500">
                        No daily closing records are available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
