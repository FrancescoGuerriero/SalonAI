import {
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock3,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Search,
  UserRound,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";

import customerFollowUpApi from "../services/customerFollowUpApi.js";

const FOLLOW_UP_STATES = [
  {
    value: "open",
    label: "All open",
  },
  {
    value: "overdue",
    label: "Overdue",
  },
  {
    value: "due_today",
    label: "Due today",
  },
  {
    value: "upcoming",
    label: "Upcoming",
  },
  {
    value: "unscheduled",
    label: "Unscheduled",
  },
  {
    value: "completed",
    label: "Completed",
  },
];

function formatDateTime(value) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

function toDateTimeLocal(value) {
  const date = value
    ? new Date(value)
    : new Date(
        Date.now() +
          24 * 60 * 60 * 1000
      );

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setMinutes(
    date.getMinutes() -
      date.getTimezoneOffset()
  );

  return date
    .toISOString()
    .slice(0, 16);
}

function formatLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function customerName(customer) {
  if (!customer) {
    return "Unknown customer";
  }

  return (
    customer.preferredName ||
    [
      customer.firstName,
      customer.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    customer.email ||
    "Unknown customer"
  );
}

function authorName(author) {
  return (
    author?.name ||
    author?.email ||
    "Salon team"
  );
}

function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "The follow-up request failed."
  );
}

function isDueToday(value) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const today = new Date();

  return (
    date.getFullYear() ===
      today.getFullYear() &&
    date.getMonth() ===
      today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function followUpState(note) {
  if (note.followUpCompleted) {
    return "completed";
  }

  if (!note.followUpAt) {
    return "unscheduled";
  }

  if (note.isOverdue) {
    return "overdue";
  }

  if (isDueToday(note.followUpAt)) {
    return "due_today";
  }

  return "upcoming";
}

function stateClasses(state) {
  const classes = {
    completed:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    overdue:
      "border-red-200 bg-red-50 text-red-700",
    due_today:
      "border-amber-200 bg-amber-50 text-amber-700",
    upcoming:
      "border-blue-200 bg-blue-50 text-blue-700",
    unscheduled:
      "border-slate-200 bg-slate-100 text-slate-600",
  };

  return (
    classes[state] ||
    classes.unscheduled
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  description,
  attention = false,
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {label}
          </p>

          <p
            className={`mt-2 text-3xl font-bold ${
              attention
                ? "text-red-700"
                : "text-slate-900"
            }`}
          >
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {description}
          </p>
        </div>

        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            attention
              ? "bg-red-50 text-red-600"
              : "bg-indigo-50 text-indigo-600"
          }`}
        >
          <Icon size={20} />
        </span>
      </div>
    </article>
  );
}

function FollowUpCard({
  followUp,
  busy,
  onComplete,
  onSchedule,
  onReopen,
}) {
  const state = followUpState(
    followUp
  );

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-bold ${stateClasses(
                state
              )}`}
            >
              {formatLabel(state)}
            </span>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {formatLabel(
                followUp.type
              )}
            </span>

            {followUp.pinned ? (
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                Pinned
              </span>
            ) : null}
          </div>

          <h2 className="mt-3 text-lg font-bold text-slate-900">
            {followUp.title ||
              "Customer follow-up"}
          </h2>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {followUp.content}
          </p>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <UserRound size={14} />

              {customerName(
                followUp.customer
              )}
            </span>

            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={14} />

              {formatDateTime(
                followUp.followUpAt
              )}
            </span>

            <span>
              Created by {" "}
              {authorName(
                followUp.createdBy
              )}
            </span>
          </div>

          {followUp.tags?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {followUp.tags.map(
                (tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600"
                  >
                    #{tag}
                  </span>
                )
              )}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-64 lg:justify-end">
          {followUp.customer?._id ||
          followUp.customer?.id ? (
            <Link
              to={`/customers/${
                followUp.customer._id ||
                followUp.customer.id
              }`}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Customer profile
            </Link>
          ) : null}

          {followUp.followUpCompleted ? (
            <button
              type="button"
              onClick={() =>
                onReopen(followUp)
              }
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <RotateCcw size={15} />
              Reopen
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() =>
                  onSchedule(followUp)
                }
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              >
                <CalendarClock
                  size={15}
                />

                {followUp.followUpAt
                  ? "Reschedule"
                  : "Schedule"}
              </button>

              <button
                type="button"
                onClick={() =>
                  onComplete(followUp)
                }
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <CheckCircle2
                    size={15}
                  />
                )}

                Complete
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export default function CustomerFollowUpsPage() {
  const [summary, setSummary] =
    useState(null);

  const [followUps, setFollowUps] =
    useState([]);

  const [pagination, setPagination] =
    useState({
      page: 1,
      pages: 1,
      total: 0,
    });

  const [filters, setFilters] =
    useState({
      state: "open",
      search: "",
      page: 1,
      limit: 20,
    });

  const [searchDraft, setSearchDraft] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [busyId, setBusyId] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [dialog, setDialog] =
    useState(null);

  const [scheduledAt, setScheduledAt] =
    useState("");

  const loadData = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const [
          summaryResult,
          listResult,
        ] = await Promise.all([
          customerFollowUpApi.getSummary(),
          customerFollowUpApi.list(
            filters
          ),
        ]);

        setSummary(
          summaryResult.summary || {}
        );

        setFollowUps(
          Array.isArray(
            listResult.followUps
          )
            ? listResult.followUps
            : []
        );

        setPagination(
          listResult.pagination || {
            page: 1,
            pages: 1,
            total: 0,
          }
        );
      } catch (requestError) {
        setError(
          errorMessage(requestError)
        );
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeStateLabel =
    useMemo(
      () =>
        FOLLOW_UP_STATES.find(
          (item) =>
            item.value ===
            filters.state
        )?.label || "Follow-ups",
      [filters.state]
    );

  function changeState(state) {
    setFilters((current) => ({
      ...current,
      state,
      page: 1,
    }));
  }

  function submitSearch(event) {
    event.preventDefault();

    setFilters((current) => ({
      ...current,
      search: searchDraft.trim(),
      page: 1,
    }));
  }

  function openScheduleDialog(
    followUp,
    mode = "schedule"
  ) {
    setDialog({
      followUp,
      mode,
    });

    setScheduledAt(
      toDateTimeLocal(
        followUp.followUpAt
      )
    );
  }

  function closeDialog() {
    setDialog(null);
    setScheduledAt("");
  }

  async function completeFollowUp(
    followUp
  ) {
    setBusyId(followUp.id);
    setError("");
    setSuccess("");

    try {
      await customerFollowUpApi.complete(
        followUp.id
      );

      setSuccess(
        "Customer follow-up completed."
      );

      await loadData();
    } catch (requestError) {
      setError(
        errorMessage(requestError)
      );
    } finally {
      setBusyId("");
    }
  }

  async function submitSchedule(
    event
  ) {
    event.preventDefault();

    if (!dialog?.followUp) {
      return;
    }

    if (!scheduledAt) {
      setError(
        "Choose a follow-up date and time."
      );
      return;
    }

    const noteId =
      dialog.followUp.id;

    setBusyId(noteId);
    setError("");
    setSuccess("");

    try {
      if (dialog.mode === "reopen") {
        await customerFollowUpApi.reopen(
          noteId,
          new Date(
            scheduledAt
          ).toISOString()
        );

        setSuccess(
          "Customer follow-up reopened."
        );
      } else {
        await customerFollowUpApi.schedule(
          noteId,
          new Date(
            scheduledAt
          ).toISOString()
        );

        setSuccess(
          "Customer follow-up scheduled."
        );
      }

      closeDialog();
      await loadData();
    } catch (requestError) {
      setError(
        errorMessage(requestError)
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            Customer operations
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Follow-up queue
          </h1>

          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Manage customer callbacks,
            consultation actions,
            complaint resolutions and
            rebooking reminders in one
            operational queue.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCcw
            size={17}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          icon={CircleDashed}
          label="Open"
          value={summary?.open || 0}
          description="Incomplete follow-ups"
        />

        <SummaryCard
          icon={AlertTriangle}
          label="Overdue"
          value={summary?.overdue || 0}
          description="Past their due time"
          attention={
            Number(summary?.overdue) >
            0
          }
        />

        <SummaryCard
          icon={CalendarCheck2}
          label="Due today"
          value={summary?.dueToday || 0}
          description="Required before closing"
        />

        <SummaryCard
          icon={CalendarClock}
          label="Upcoming"
          value={summary?.upcoming || 0}
          description="Scheduled after today"
        />

        <SummaryCard
          icon={Clock3}
          label="Unscheduled"
          value={
            summary?.unscheduled || 0
          }
          description="Need a target date"
          attention={
            Number(
              summary?.unscheduled
            ) > 0
          }
        />

        <SummaryCard
          icon={CheckCircle2}
          label="Completed"
          value={
            summary?.completedLast30Days ||
            0
          }
          description="Completed in 30 days"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {FOLLOW_UP_STATES.map(
              (item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() =>
                    changeState(
                      item.value
                    )
                  }
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                    filters.state ===
                    item.value
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </button>
              )
            )}
          </div>

          <form
            onSubmit={submitSearch}
            className="flex w-full gap-2 xl:max-w-md"
          >
            <label className="relative flex-1">
              <span className="sr-only">
                Search follow-ups
              </span>

              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={searchDraft}
                onChange={(event) =>
                  setSearchDraft(
                    event.target.value
                  )
                }
                placeholder="Search notes or tags"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {activeStateLabel}
            </h2>

            <p className="text-sm text-slate-500">
              {pagination.total || 0}{" "}
              matching follow-up
              {Number(
                pagination.total
              ) === 1
                ? ""
                : "s"}
            </p>
          </div>

          {loading ? (
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Loader2
                size={17}
                className="animate-spin"
              />

              Loading
            </span>
          ) : null}
        </div>

        {!loading &&
        followUps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <CalendarCheck2
              size={34}
              className="mx-auto text-slate-400"
            />

            <p className="mt-3 font-bold text-slate-800">
              No matching follow-ups
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Change the queue filter or
              create a follow-up from a
              customer note.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {followUps.map(
              (followUp) => (
                <FollowUpCard
                  key={followUp.id}
                  followUp={followUp}
                  busy={
                    busyId ===
                    followUp.id
                  }
                  onComplete={
                    completeFollowUp
                  }
                  onSchedule={(
                    item
                  ) =>
                    openScheduleDialog(
                      item,
                      "schedule"
                    )
                  }
                  onReopen={(item) =>
                    openScheduleDialog(
                      item,
                      "reopen"
                    )
                  }
                />
              )
            )}
          </div>
        )}
      </section>

      <nav className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() =>
            setFilters((current) => ({
              ...current,
              page: Math.max(
                1,
                current.page - 1
              ),
            }))
          }
          disabled={
            loading ||
            !pagination.hasPreviousPage
          }
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
        >
          <ChevronLeft size={16} />
          Previous
        </button>

        <p className="text-sm font-semibold text-slate-600">
          Page {pagination.page || 1}{" "}
          of {pagination.pages || 1}
        </p>

        <button
          type="button"
          onClick={() =>
            setFilters((current) => ({
              ...current,
              page:
                current.page + 1,
            }))
          }
          disabled={
            loading ||
            !pagination.hasNextPage
          }
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </nav>

      {dialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900">
              {dialog.mode === "reopen"
                ? "Reopen follow-up"
                : "Schedule follow-up"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {dialog.followUp.title ||
                "Customer follow-up"}
            </p>

            <form
              onSubmit={submitSchedule}
              className="mt-5 space-y-5"
            >
              <label className="block text-sm font-semibold text-slate-700">
                Follow-up date and time

                <input
                  type="datetime-local"
                  required
                  value={scheduledAt}
                  onChange={(event) =>
                    setScheduledAt(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={Boolean(
                    busyId
                  )}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={Boolean(
                    busyId
                  )}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busyId ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <CalendarClock
                      size={16}
                    />
                  )}

                  Save follow-up
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
