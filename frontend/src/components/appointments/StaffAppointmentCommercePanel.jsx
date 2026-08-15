import {
  BellRing,
  CheckCircle2,
  CreditCard,
  History,
  LoaderCircle,
  MessageCircle,
  PoundSterling,
  RefreshCw,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import appointmentManagementApi from "../../Services/appointmentManagementApi.js";

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

function notificationStyles(value) {
  switch (String(value || "processing").toLowerCase()) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "failed":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

function currency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function outstandingBalance(appointment) {
  const explicit = Number(appointment?.balanceDue);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;

  const total = Number(
    appointment?.finalPrice ??
      appointment?.totalPrice ??
      appointment?.service?.price ??
      0
  );
  const paid = Number(appointment?.amountPaid ?? 0);
  return Math.max(0, total - paid);
}

function formatEventDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function errorText(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "The appointment communication operation failed."
  );
}

export default function StaffAppointmentCommercePanel({
  appointment,
  onChanged,
}) {
  const [hoursBefore, setHoursBefore] = useState(24);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const appointmentId = appointment?._id || appointment?.id;
  const paid = Number(appointment?.amountPaid || 0);
  const balance = outstandingBalance(appointment);
  const paymentComplete =
    balance <= 0 || normaliseStatus(appointment?.paymentStatus) === "paid";

  const loadHistory = useCallback(async () => {
    if (!appointmentId) return;

    setLoadingHistory(true);
    try {
      const result = await appointmentManagementApi.getCommunicationHistory(
        appointmentId,
        { limit: 25 }
      );
      setHistory(Array.isArray(result?.items) ? result.items : []);
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setLoadingHistory(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function runAction(name, operation, message) {
    setBusyAction(name);
    setError("");
    setSuccess("");

    try {
      const result = await operation();
      setSuccess(message);
      await loadHistory();
      if (typeof onChanged === "function") {
        await onChanged(result);
      }
      return result;
    } catch (requestError) {
      setError(errorText(requestError));
      return null;
    } finally {
      setBusyAction("");
    }
  }

  async function requestPayment(purpose) {
    const result = await runAction(
      `payment-${purpose}`,
      () =>
        appointmentManagementApi.createPaymentCheckout(appointmentId, {
          purpose,
        }),
      purpose === "deposit"
        ? "Deposit payment request created and sent."
        : "Balance payment request created and sent."
    );

    const checkoutUrl = result?.payment?.checkoutUrl;
    if (checkoutUrl) {
      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">Customer communication</h3>
            <p className="mt-1 text-xs text-slate-500">
              Sends through the customer&apos;s saved email, SMS or WhatsApp preference.
            </p>
          </div>
          <MessageCircle size={20} className="text-indigo-600" />
        </div>

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Reminder timing label
          <input
            type="number"
            min="1"
            max="168"
            value={hoursBefore}
            onChange={(event) => setHoursBefore(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal"
          />
        </label>

        <button
          type="button"
          disabled={Boolean(busyAction)}
          onClick={() =>
            runAction(
              "reminder",
              () =>
                appointmentManagementApi.sendReminderNow(appointmentId, {
                  hoursBefore: Number(hoursBefore),
                }),
              "Appointment reminder sent."
            )
          }
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
        >
          {busyAction === "reminder" ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          Send reminder now
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">Payment controls</h3>
            <p className="mt-1 text-xs text-slate-500">
              Checkout creation automatically sends the secure payment link.
            </p>
          </div>
          <CreditCard size={20} className="text-indigo-600" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center">
          <div>
            <span className="block text-xs text-slate-500">Status</span>
            <span className="mt-1 block text-sm font-semibold text-slate-900">
              {statusLabel(appointment?.paymentStatus || "pending")}
            </span>
          </div>
          <div>
            <span className="block text-xs text-slate-500">Paid</span>
            <span className="mt-1 block text-sm font-semibold text-slate-900">
              {currency(paid)}
            </span>
          </div>
          <div>
            <span className="block text-xs text-slate-500">Due</span>
            <span className="mt-1 block text-sm font-semibold text-slate-900">
              {currency(balance)}
            </span>
          </div>
        </div>

        {paymentComplete ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={17} /> No payment is currently outstanding.
          </div>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={Boolean(busyAction) || paid > 0}
              onClick={() => requestPayment("deposit")}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {busyAction === "payment-deposit" ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <CreditCard size={16} />
              )}
              Request deposit
            </button>
            <button
              type="button"
              disabled={Boolean(busyAction)}
              onClick={() => requestPayment("balance")}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {busyAction === "payment-balance" ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <PoundSterling size={16} />
              )}
              Request balance
            </button>
          </div>
        )}
      </section>

      {(error || success) && (
        <section className="lg:col-span-2">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
              {success}
            </div>
          ) : null}
        </section>
      )}

      <section className="rounded-xl border border-slate-200 p-4 lg:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History size={19} className="text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-900">Communication history</h3>
              <p className="mt-1 text-xs text-slate-500">
                Transactional email, SMS and WhatsApp events recorded for this appointment.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadHistory}
            disabled={loadingHistory}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={loadingHistory ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {loadingHistory ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
            <LoaderCircle size={16} className="animate-spin" /> Loading communication history…
          </div>
        ) : history.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">
            No transactional communications are recorded for this appointment yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {history.map((item) => (
              <article
                key={item._id || item.eventKey}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm text-slate-900">
                    {String(item.event || "notification").replaceAll(".", " · ")}
                  </strong>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${notificationStyles(
                      item.status
                    )}`}
                  >
                    {statusLabel(item.status || "processing")}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {formatEventDate(item.createdAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(item.requestedChannels || []).map((channel) => (
                    <span
                      key={channel}
                      className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600"
                    >
                      {statusLabel(channel)}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  {Number(item.successful || 0)} successful · {Number(item.skipped || 0)} skipped · {Number(item.failed || 0)} failed
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
