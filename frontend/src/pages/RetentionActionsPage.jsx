import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Mail,
  MessageSquareText,
  Phone,
  RefreshCw,
  Search,
  Send,
  Sparkles,
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

import {
  useNavigate,
} from "react-router-dom";

import {
  getCustomerContact,
  getCustomerIdentifier,
  getCustomerName,
  getDormantCustomers,
  queueDormantOutreach,
  queuePostAppointmentFollowUps,
} from "../Services/retentionActionService.js";

const DEFAULT_DORMANT_FORM = {
  dormantDays: 60,
  channel: "email",
  scheduledFor: "",
  subject:
    "We miss you, {{customer.firstName}}",
  message:
    "Hi {{customer.firstName}}, we would love to welcome you back to {{salon.name}}. Reply to arrange your next appointment.",
};

const DEFAULT_FOLLOW_UP_FORM = {
  daysAfter: 1,
  channel: "email",
};

function normaliseText(value) {
  return String(value ?? "").trim();
}

function getErrorMessage(error) {
  return (
    error?.message ||
    "The retention action could not be completed."
  );
}

function formatNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? new Intl.NumberFormat(
        "en-GB"
      ).format(number)
    : "0";
}

function toDateTimeLocal(value) {
  const date = value
    ? new Date(value)
    : new Date();

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const localDate =
    new Date(
      date.getTime() -
        date.getTimezoneOffset() *
          60000
    );

  return localDate
    .toISOString()
    .slice(0, 16);
}

function formatDateTime(value) {
  if (!value) {
    return "Queue immediately";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Queue immediately";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

function getInitials(customer) {
  return getCustomerName(customer)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part
        .charAt(0)
        .toUpperCase()
    )
    .join("");
}

function Notice({
  type = "error",
  message,
  onClose,
}) {
  if (!message) {
    return null;
  }

  const successful =
    type === "success";

  return (
    <div
      className={[
        "flex items-start justify-between gap-4 rounded-xl border p-4",
        successful
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        {successful ? (
          <CheckCircle2
            size={20}
            className="mt-0.5 shrink-0"
          />
        ) : (
          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0"
          />
        )}

        <p className="text-sm font-medium">
          {message}
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-1 transition hover:bg-black/5"
        aria-label="Close notification"
      >
        <X size={17} />
      </button>
    </div>
  );
}

function LoadingButton({
  loading = false,
  disabled = false,
  children,
  className = "",
  ...props
}) {
  return (
    <button
      {...props}
      disabled={
        loading || disabled
      }
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {loading ? (
        <Loader2
          size={17}
          className="animate-spin"
        />
      ) : null}

      {children}
    </button>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  description,
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={21} />
        </div>
      </div>
    </article>
  );
}

function CustomerCard({
  customer,
  channel,
  onOpenProfile,
}) {
  const identifier =
    getCustomerIdentifier(
      customer
    );

  const contact =
    getCustomerContact(
      customer,
      channel
    );

  const ContactIcon =
    channel === "sms"
      ? Phone
      : Mail;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
          {getInitials(
            customer
          ) || (
            <UserRound
              size={18}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-slate-900">
            {getCustomerName(
              customer
            )}
          </h3>

          <div className="mt-2 flex min-w-0 items-center gap-2 text-sm text-slate-600">
            <ContactIcon
              size={15}
              className="shrink-0 text-slate-400"
            />

            <span className="truncate">
              {contact}
            </span>
          </div>

          {identifier ? (
            <button
              type="button"
              onClick={() =>
                onOpenProfile(
                  customer
                )
              }
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
            >
              View profile
              <ChevronRight
                size={15}
              />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function DormantOutreachForm({
  form,
  candidateCount,
  loading,
  onChange,
  onSubmit,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <MessageSquareText
            size={21}
          />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Dormant-customer
            outreach
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Queue a personalised
            return invitation for
            customers who have not
            visited recently.
          </p>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-6 space-y-5"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label
              htmlFor="retention-dormant-days"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Inactive for
            </label>

            <div className="relative">
              <input
                id="retention-dormant-days"
                type="number"
                min="1"
                max="3650"
                required
                value={
                  form.dormantDays
                }
                onChange={(event) =>
                  onChange(
                    "dormantDays",
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 pr-14 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />

              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">
                days
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="retention-channel"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Delivery channel
            </label>

            <select
              id="retention-channel"
              value={form.channel}
              onChange={(event) =>
                onChange(
                  "channel",
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="email">
                Email
              </option>

              <option value="sms">
                SMS
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="retention-scheduled-for"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Schedule
            </label>

            <input
              id="retention-scheduled-for"
              type="datetime-local"
              value={
                form.scheduledFor
              }
              onChange={(event) =>
                onChange(
                  "scheduledFor",
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {form.channel ===
        "email" ? (
          <div>
            <label
              htmlFor="retention-subject"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Email subject
            </label>

            <input
              id="retention-subject"
              type="text"
              required
              value={form.subject}
              onChange={(event) =>
                onChange(
                  "subject",
                  event.target.value
                )
              }
              maxLength={250}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        ) : null}

        <div>
          <label
            htmlFor="retention-message"
            className="mb-1.5 block text-sm font-semibold text-slate-700"
          >
            Message
          </label>

          <textarea
            id="retention-message"
            rows={6}
            required
            value={form.message}
            onChange={(event) =>
              onChange(
                "message",
                event.target.value
              )
            }
            maxLength={5000}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm leading-6 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <div className="mt-2 flex flex-col justify-between gap-2 text-xs text-slate-500 sm:flex-row">
            <p>
              Supported variables
              include{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                {"{{customer.firstName}}"}
              </code>{" "}
              and{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                {"{{salon.name}}"}
              </code>
              .
            </p>

            <p>
              {form.message.length}
              /5,000
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
          <div className="flex items-start gap-3">
            <UsersRound
              size={19}
              className="mt-0.5 shrink-0 text-indigo-600"
            />

            <div>
              <p className="text-sm font-semibold text-indigo-900">
                Current eligible
                audience
              </p>

              <p className="mt-1 text-sm text-indigo-700">
                {formatNumber(
                  candidateCount
                )}{" "}
                dormant customer
                {candidateCount === 1
                  ? ""
                  : "s"}{" "}
                match this rule.
                Customers without the
                selected contact method
                will be skipped.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <LoadingButton
            type="submit"
            loading={loading}
            disabled={
              candidateCount === 0 ||
              !normaliseText(
                form.message
              ) ||
              (
                form.channel ===
                  "email" &&
                !normaliseText(
                  form.subject
                )
              )
            }
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Send size={17} />
            Queue dormant outreach
          </LoadingButton>
        </div>
      </form>
    </section>
  );
}

function FollowUpForm({
  form,
  loading,
  onChange,
  onSubmit,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <CalendarClock
            size={21}
          />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Post-appointment
            follow-ups
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Queue a feedback and
            service-care message for
            appointments completed on
            a previous day.
          </p>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-6 space-y-5"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="retention-days-after"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Completed
            </label>

            <div className="relative">
              <input
                id="retention-days-after"
                type="number"
                min="0"
                max="365"
                required
                value={
                  form.daysAfter
                }
                onChange={(event) =>
                  onChange(
                    "daysAfter",
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 pr-24 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />

              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">
                days ago
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="follow-up-channel"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Delivery channel
            </label>

            <select
              id="follow-up-channel"
              value={form.channel}
              onChange={(event) =>
                onChange(
                  "channel",
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="email">
                Email
              </option>

              <option value="sms">
                SMS
              </option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <Sparkles
              size={19}
              className="mt-0.5 shrink-0 text-emerald-600"
            />

            <p className="text-sm leading-6 text-emerald-800">
              The backend prevents
              duplicate follow-up
              records for the same
              appointment and channel
              by using an upsert
              operation.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <LoadingButton
            type="submit"
            loading={loading}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Send size={17} />
            Queue appointment
            follow-ups
          </LoadingButton>
        </div>
      </form>
    </section>
  );
}

export default function RetentionActionsPage() {
  const navigate =
    useNavigate();

  const [
    dormantForm,
    setDormantForm,
  ] = useState(() => ({
    ...DEFAULT_DORMANT_FORM,

    scheduledFor:
      toDateTimeLocal(
        new Date()
      ),
  }));

  const [
    followUpForm,
    setFollowUpForm,
  ] = useState(
    DEFAULT_FOLLOW_UP_FORM
  );

  const [
    dormantCustomers,
    setDormantCustomers,
  ] = useState([]);

  const [
    dormantSearch,
    setDormantSearch,
  ] = useState("");

  const [
    customerPage,
    setCustomerPage,
  ] = useState(1);

  const customerPageSize = 12;

  const [
    loadingCustomers,
    setLoadingCustomers,
  ] = useState(true);

  const [
    queuingDormant,
    setQueuingDormant,
  ] = useState(false);

  const [
    queuingFollowUps,
    setQueuingFollowUps,
  ] = useState(false);

  const [
    lastDormantQueued,
    setLastDormantQueued,
  ] = useState(0);

  const [
    lastFollowUpsQueued,
    setLastFollowUpsQueued,
  ] = useState(0);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  const loadDormantCustomers =
    useCallback(async () => {
      setLoadingCustomers(true);
      setError("");

      try {
        const response =
          await getDormantCustomers({
            dormantDays:
              dormantForm.dormantDays,

            limit: 1000,
          });

        setDormantCustomers(
          response.items
        );
      } catch (requestError) {
        setDormantCustomers([]);

        setError(
          getErrorMessage(
            requestError
          )
        );
      } finally {
        setLoadingCustomers(false);
      }
    }, [
      dormantForm.dormantDays,
    ]);

  useEffect(() => {
    const timeout =
      window.setTimeout(() => {
        void loadDormantCustomers();
      }, 350);

    return () =>
      window.clearTimeout(
        timeout
      );
  }, [loadDormantCustomers]);

  useEffect(() => {
    setCustomerPage(1);
  }, [
    dormantSearch,
    dormantForm.channel,
    dormantForm.dormantDays,
  ]);

  function updateDormantForm(
    field,
    value
  ) {
    setDormantForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  function updateFollowUpForm(
    field,
    value
  ) {
    setFollowUpForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  async function handleQueueDormant(
    event
  ) {
    event.preventDefault();
    clearMessages();
    setQueuingDormant(true);

    try {
      const response =
        await queueDormantOutreach(
          dormantForm
        );

      setLastDormantQueued(
        response.queued
      );

      setSuccess(
        `${formatNumber(
          response.queued
        )} dormant-customer message${
          response.queued === 1
            ? ""
            : "s"
        } queued successfully.`
      );
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setQueuingDormant(false);
    }
  }

  async function handleQueueFollowUps(
    event
  ) {
    event.preventDefault();
    clearMessages();
    setQueuingFollowUps(true);

    try {
      const response =
        await queuePostAppointmentFollowUps(
          followUpForm
        );

      setLastFollowUpsQueued(
        response.queued
      );

      setSuccess(
        `${formatNumber(
          response.queued
        )} post-appointment follow-up${
          response.queued === 1
            ? ""
            : "s"
        } queued successfully.`
      );
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setQueuingFollowUps(false);
    }
  }

  function openCustomerProfile(
    customer
  ) {
    const identifier =
      getCustomerIdentifier(
        customer
      );

    if (!identifier) {
      setError(
        "This customer does not have a valid profile identifier."
      );

      return;
    }

    navigate(
      `/customers/${encodeURIComponent(
        identifier
      )}`
    );
  }

  const contactableCustomers =
    useMemo(
      () =>
        dormantCustomers.filter(
          (customer) => {
            if (
              dormantForm.channel ===
              "sms"
            ) {
              return Boolean(
                normaliseText(
                  customer?.phone ||
                    customer?.phoneNumber ||
                    customer?.mobile
                )
              );
            }

            return Boolean(
              normaliseText(
                customer?.email
              )
            );
          }
        ),
      [
        dormantCustomers,
        dormantForm.channel,
      ]
    );

  const filteredCustomers =
    useMemo(() => {
      const query =
        dormantSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return dormantCustomers;
      }

      return dormantCustomers.filter(
        (customer) =>
          [
            getCustomerName(
              customer
            ),
            customer?.email,
            customer?.phone,
            customer?.phoneNumber,
            customer?.mobile,
            getCustomerIdentifier(
              customer
            ),
          ].some((value) =>
            normaliseText(value)
              .toLowerCase()
              .includes(query)
          )
      );
    }, [
      dormantCustomers,
      dormantSearch,
    ]);

  const totalCustomerPages =
    Math.max(
      1,
      Math.ceil(
        filteredCustomers.length /
          customerPageSize
      )
    );

  const safeCustomerPage =
    Math.min(
      customerPage,
      totalCustomerPages
    );

  const paginatedCustomers =
    filteredCustomers.slice(
      (safeCustomerPage - 1) *
        customerPageSize,

      safeCustomerPage *
        customerPageSize
    );

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
                <Sparkles size={23} />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  Customer retention
                  actions
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Identify inactive
                  customers and queue
                  targeted return or
                  follow-up messages.
                </p>
              </div>
            </div>
          </div>

          <LoadingButton
            type="button"
            loading={loadingCustomers}
            onClick={() =>
              void loadDormantCustomers()
            }
            className="border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-100"
          >
            <RefreshCw size={17} />
            Refresh audience
          </LoadingButton>
        </header>

        <div className="mt-6 space-y-3">
          <Notice
            type="error"
            message={error}
            onClose={() =>
              setError("")
            }
          />

          <Notice
            type="success"
            message={success}
            onClose={() =>
              setSuccess("")
            }
          />
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={UsersRound}
            label="Dormant customers"
            value={formatNumber(
              dormantCustomers.length
            )}
            description={`No qualifying visit in ${dormantForm.dormantDays || 60} days`}
          />

          <SummaryCard
            icon={
              dormantForm.channel ===
              "sms"
                ? Phone
                : Mail
            }
            label="Contactable"
            value={formatNumber(
              contactableCustomers.length
            )}
            description={`Customers with a valid ${dormantForm.channel} destination`}
          />

          <SummaryCard
            icon={Send}
            label="Last outreach queue"
            value={formatNumber(
              lastDormantQueued
            )}
            description="Dormant-customer messages queued"
          />

          <SummaryCard
            icon={Clock3}
            label="Last follow-up queue"
            value={formatNumber(
              lastFollowUpsQueued
            )}
            description="Post-appointment messages queued"
          />
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <DormantOutreachForm
            form={dormantForm}
            candidateCount={
              contactableCustomers.length
            }
            loading={
              queuingDormant
            }
            onChange={
              updateDormantForm
            }
            onSubmit={
              handleQueueDormant
            }
          />

          <FollowUpForm
            form={followUpForm}
            loading={
              queuingFollowUps
            }
            onChange={
              updateFollowUpForm
            }
            onSubmit={
              handleQueueFollowUps
            }
          />
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Dormant customer
                audience
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Review the customers
                currently selected by
                the inactive-days rule.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
              <Search
                size={17}
                className="shrink-0 text-slate-400"
              />

              <input
                type="search"
                value={
                  dormantSearch
                }
                onChange={(event) =>
                  setDormantSearch(
                    event.target.value
                  )
                }
                placeholder="Search dormant customers"
                className="w-full min-w-0 border-0 bg-transparent py-2.5 text-sm outline-none sm:w-72"
              />
            </div>
          </div>

          <div className="p-5">
            {loadingCustomers ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({
                  length: 6,
                }).map(
                  (_, index) => (
                    <div
                      key={index}
                      className="h-32 animate-pulse rounded-2xl bg-slate-100"
                    />
                  )
                )}
              </div>
            ) : paginatedCustomers.length >
              0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {paginatedCustomers.map(
                  (customer) => (
                    <CustomerCard
                      key={
                        getCustomerIdentifier(
                          customer
                        ) ||
                        `${customer.email}-${customer.phone}`
                      }
                      customer={
                        customer
                      }
                      channel={
                        dormantForm.channel
                      }
                      onOpenProfile={
                        openCustomerProfile
                      }
                    />
                  )
                )}
              </div>
            ) : (
              <div className="py-14 text-center">
                <UsersRound
                  size={42}
                  className="mx-auto text-slate-300"
                />

                <h3 className="mt-4 font-bold text-slate-900">
                  No dormant customers
                  found
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  {dormantSearch
                    ? "No dormant customers match the current search."
                    : "No customers currently match the selected dormant-days rule."}
                </p>
              </div>
            )}
          </div>

          {filteredCustomers.length >
          customerPageSize ? (
            <div className="flex flex-col justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
              <p className="text-sm text-slate-500">
                Page{" "}
                <span className="font-semibold text-slate-700">
                  {safeCustomerPage}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700">
                  {totalCustomerPages}
                </span>
                {" · "}
                {filteredCustomers.length}{" "}
                customers
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={
                    safeCustomerPage <=
                    1
                  }
                  onClick={() =>
                    setCustomerPage(
                      (current) =>
                        Math.max(
                          1,
                          current - 1
                        )
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft
                    size={16}
                  />
                  Previous
                </button>

                <button
                  type="button"
                  disabled={
                    safeCustomerPage >=
                    totalCustomerPages
                  }
                  onClick={() =>
                    setCustomerPage(
                      (current) =>
                        current + 1
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight
                    size={16}
                  />
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <CalendarClock
              size={20}
              className="mt-0.5 shrink-0 text-blue-600"
            />

            <div>
              <h2 className="font-bold text-blue-900">
                Queue information
              </h2>

              <p className="mt-1 text-sm leading-6 text-blue-800">
                Dormant outreach is
                currently scheduled
                for{" "}
                <strong>
                  {formatDateTime(
                    dormantForm.scheduledFor
                  )}
                </strong>
                . Queued records are
                processed by the
                existing scheduled
                communication and
                message-delivery
                services.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}