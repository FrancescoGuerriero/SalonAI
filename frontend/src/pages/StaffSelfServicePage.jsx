import {
  CalendarDays,
  CalendarOff,
  Clock3,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  staffApi,
} from "../Services/futureFeaturesApi.js";
import useAuth from "../hooks/useAuth.js";
import {
  hasPermission,
} from "../utils/permissions.js";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

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

function defaultRange() {
  return {
    start: "09:00",
    end: "17:00",
  };
}

function emptyDay(day) {
  return {
    dayOfWeek:
      day.value,
    label:
      day.label,
    active:
      false,
    ranges: [],
  };
}

function scheduleFrom(
  items = []
) {
  return DAYS.map(
    (day) => {
      const matching =
        items.filter(
          (item) =>
            Number(
              item.dayOfWeek
            ) ===
            day.value
        );

      const selected =
        matching.find(
          (item) =>
            !item.effectiveFrom
        ) ||
        matching[0];

      if (!selected) {
        return emptyDay(
          day
        );
      }

      return {
        dayOfWeek:
          day.value,
        label:
          day.label,
        active:
          selected.active !==
            false &&
          Array.isArray(
            selected.ranges
          ) &&
          selected.ranges
            .length >
            0,
        ranges:
          Array.isArray(
            selected.ranges
          )
            ? selected.ranges.map(
                (range) => ({
                  start:
                    range.start ||
                    "09:00",
                  end:
                    range.end ||
                    "17:00",
                })
              )
            : [],
      };
    }
  );
}

function formatDateTime(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(
      value
    );
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle:
        "medium",
      timeStyle:
        "short",
    }
  ).format(date);
}

function statusClasses(
  status
) {
  switch (status) {
    case "approved":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    case "declined":
      return "border-red-300 bg-red-50 text-red-800";
    case "cancelled":
      return "border-stone-300 bg-stone-100 text-stone-700";
    default:
      return "border-amber-300 bg-amber-50 text-black";
  }
}

export default function StaffSelfServicePage() {
  const {
    user,
  } = useAuth();

  const canReadSchedule =
    hasPermission(
      user,
      "schedule:own:read"
    );

  const canUpdateSchedule =
    hasPermission(
      user,
      "schedule:own:update"
    );

  const canRequestLeave =
    hasPermission(
      user,
      "leave:own:request"
    );

  const [
    schedule,
    setSchedule,
  ] = useState(
    () =>
      DAYS.map(
        emptyDay
      )
  );

  const [
    timeOff,
    setTimeOff,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    savingDay,
    setSavingDay,
  ] = useState(null);

  const [
    requestingLeave,
    setRequestingLeave,
  ] = useState(false);

  const [
    leaveForm,
    setLeaveForm,
  ] = useState({
    startsAt: "",
    endsAt: "",
    reason: "",
  });

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const staffName =
    useMemo(
      () =>
        String(
          user?.name ||
            "Staff member"
        ),
      [user?.name]
    );

  const load =
    useCallback(
      async () => {
        if (
          !canReadSchedule
        ) {
          setLoading(
            false
          );
          return;
        }

        setLoading(true);
        setError("");

        try {
          const [
            availability,
            leave,
          ] =
            await Promise.all([
              staffApi.myWeek(),
              staffApi.listMyTimeOff(),
            ]);

          setSchedule(
            scheduleFrom(
              availability?.items ||
                []
            )
          );

          setTimeOff(
            Array.isArray(
              leave?.items
            )
              ? leave.items
              : []
          );
        } catch (
          requestError
        ) {
          setError(
            errorMessage(
              requestError,
              "Your availability and leave information could not be loaded."
            )
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        canReadSchedule,
      ]
    );

  useEffect(() => {
    void load();
  }, [load]);

  function updateDay(
    dayOfWeek,
    updater
  ) {
    setSchedule(
      (current) =>
        current.map(
          (day) =>
            day.dayOfWeek ===
            dayOfWeek
              ? updater(
                  day
                )
              : day
        )
    );

    setError("");
    setSuccess("");
  }

  function toggleDay(
    dayOfWeek,
    active
  ) {
    updateDay(
      dayOfWeek,
      (day) => ({
        ...day,
        active,
        ranges:
          active &&
          !day.ranges
            .length
            ? [
                defaultRange(),
              ]
            : active
              ? day.ranges
              : [],
      })
    );
  }

  function updateRange(
    dayOfWeek,
    index,
    field,
    value
  ) {
    updateDay(
      dayOfWeek,
      (day) => ({
        ...day,
        ranges:
          day.ranges.map(
            (
              range,
              rangeIndex
            ) =>
              rangeIndex ===
              index
                ? {
                    ...range,
                    [field]:
                      value,
                  }
                : range
          ),
      })
    );
  }

  function addRange(
    dayOfWeek
  ) {
    updateDay(
      dayOfWeek,
      (day) => ({
        ...day,
        active: true,
        ranges: [
          ...day.ranges,
          defaultRange(),
        ],
      })
    );
  }

  function removeRange(
    dayOfWeek,
    index
  ) {
    updateDay(
      dayOfWeek,
      (day) => {
        const ranges =
          day.ranges.filter(
            (
              _,
              rangeIndex
            ) =>
              rangeIndex !==
              index
          );

        return {
          ...day,
          active:
            ranges.length >
            0,
          ranges,
        };
      }
    );
  }

  async function saveDay(
    day
  ) {
    if (
      !canUpdateSchedule
    ) {
      return;
    }

    setSavingDay(
      day.dayOfWeek
    );
    setError("");
    setSuccess("");

    try {
      await staffApi.setMyAvailability({
        dayOfWeek:
          day.dayOfWeek,
        ranges:
          day.active
            ? day.ranges
            : [],
        active:
          day.active,
      });

      setSuccess(
        `${day.label} availability saved.`
      );

      await load();
    } catch (
      requestError
    ) {
      setError(
        errorMessage(
          requestError,
          `${day.label} availability could not be saved.`
        )
      );
    } finally {
      setSavingDay(
        null
      );
    }
  }

  async function requestLeave(
    event
  ) {
    event.preventDefault();

    if (
      !canRequestLeave
    ) {
      return;
    }

    setRequestingLeave(
      true
    );
    setError("");
    setSuccess("");

    try {
      await staffApi.requestMyTimeOff({
        startsAt:
          leaveForm.startsAt,
        endsAt:
          leaveForm.endsAt,
        reason:
          leaveForm.reason,
      });

      setLeaveForm({
        startsAt: "",
        endsAt: "",
        reason: "",
      });

      setSuccess(
        "Leave request submitted for management review."
      );

      await load();
    } catch (
      requestError
    ) {
      setError(
        errorMessage(
          requestError,
          "Your leave request could not be submitted."
        )
      );
    } finally {
      setRequestingLeave(
        false
      );
    }
  }

  if (
    !canReadSchedule
  ) {
    return (
      <main
        className="p-4 sm:p-6 lg:p-8"
        id="main-content"
        tabIndex="-1"
      >
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-black">
            My availability
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            This workspace is not enabled for your account. A Super Admin can grant access from employee permissions.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main
      className="space-y-6 p-4 sm:p-6 lg:p-8"
      id="main-content"
      tabIndex="-1"
    >
      <header className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
          Employee self-service
        </p>

        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black sm:text-3xl">
              My availability & leave
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
              {staffName}, maintain the availability settings delegated to your account and submit leave requests. Management approval remains separate.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 self-start rounded-xl border border-black bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-50 disabled:opacity-50"
            onClick={() =>
              void load()
            }
            disabled={
              loading
            }
          >
            <RefreshCw
              size={17}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-black"
          role="status"
        >
          {success}
        </div>
      ) : null}

      <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
        <header className="border-b border-stone-200 p-5">
          <div className="flex items-center gap-2">
            <Clock3
              size={20}
            />
            <div>
              <h2 className="font-bold text-black">
                Normal weekly availability
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                These are your normal availability ranges. Temporary management overrides and approved leave still take priority.
              </p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="p-10 text-center text-sm font-semibold text-stone-600">
            Loading your availability…
          </div>
        ) : (
          <div className="divide-y divide-stone-200">
            {schedule.map(
              (day) => (
                <article
                  key={
                    day.dayOfWeek
                  }
                  className="grid gap-4 p-5 xl:grid-cols-[10rem_minmax(0,1fr)_auto]"
                >
                  <div>
                    <strong className="text-black">
                      {day.label}
                    </strong>

                    <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-stone-700">
                      <input
                        type="checkbox"
                        checked={
                          day.active
                        }
                        disabled={
                          !canUpdateSchedule
                        }
                        onChange={(
                          event
                        ) =>
                          toggleDay(
                            day.dayOfWeek,
                            event.target
                              .checked
                          )
                        }
                        className="h-4 w-4 accent-amber-500"
                      />
                      Available
                    </label>
                  </div>

                  <div className="space-y-2">
                    {!day.active ||
                    !day.ranges.length ? (
                      <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                        Not available.
                      </p>
                    ) : (
                      day.ranges.map(
                        (
                          range,
                          index
                        ) => (
                          <div
                            key={`${day.dayOfWeek}-${index}`}
                            className="flex flex-wrap items-end gap-2 rounded-xl border border-stone-200 p-3"
                          >
                            <label className="text-xs font-semibold text-black">
                              From
                              <input
                                type="time"
                                value={
                                  range.start
                                }
                                disabled={
                                  !canUpdateSchedule
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateRange(
                                    day.dayOfWeek,
                                    index,
                                    "start",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                className="mt-1 block rounded-lg border border-stone-300 px-2 py-2 text-sm text-black"
                              />
                            </label>

                            <label className="text-xs font-semibold text-black">
                              To
                              <input
                                type="time"
                                value={
                                  range.end
                                }
                                disabled={
                                  !canUpdateSchedule
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateRange(
                                    day.dayOfWeek,
                                    index,
                                    "end",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                className="mt-1 block rounded-lg border border-stone-300 px-2 py-2 text-sm text-black"
                              />
                            </label>

                            {canUpdateSchedule ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs font-bold text-black hover:bg-stone-50"
                                onClick={() =>
                                  removeRange(
                                    day.dayOfWeek,
                                    index
                                  )
                                }
                              >
                                <Trash2
                                  size={14}
                                />
                                Remove
                              </button>
                            ) : null}
                          </div>
                        )
                      )
                    )}

                    {canUpdateSchedule ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-black bg-white px-3 py-2 text-xs font-bold text-black hover:bg-amber-50"
                        onClick={() =>
                          addRange(
                            day.dayOfWeek
                          )
                        }
                      >
                        <Plus
                          size={14}
                        />
                        Add range
                      </button>
                    ) : null}
                  </div>

                  <div>
                    {canUpdateSchedule ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl border border-black bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 disabled:opacity-50"
                        disabled={
                          savingDay ===
                          day.dayOfWeek
                        }
                        onClick={() =>
                          void saveDay(
                            day
                          )
                        }
                      >
                        <Save
                          size={16}
                        />
                        {savingDay ===
                        day.dayOfWeek
                          ? "Saving…"
                          : "Save day"}
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-stone-500">
                        Read only
                      </span>
                    )}
                  </div>
                </article>
              )
            )}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
          <header className="border-b border-stone-200 p-5">
            <div className="flex items-center gap-2">
              <CalendarOff
                size={20}
              />
              <div>
                <h2 className="font-bold text-black">
                  My leave requests
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  Requests remain visible after management review.
                </p>
              </div>
            </div>
          </header>

          <div className="divide-y divide-stone-200">
            {timeOff.length ? (
              timeOff.map(
                (request) => (
                  <article
                    key={
                      request._id
                    }
                    className="p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-black">
                        {formatDateTime(
                          request.startsAt
                        )}
                        {" – "}
                        {formatDateTime(
                          request.endsAt
                        )}
                      </strong>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusClasses(
                          request.status
                        )}`}
                      >
                        {request.status ||
                          "requested"}
                      </span>
                    </div>

                    {request.reason ? (
                      <p className="mt-2 text-sm text-stone-600">
                        {request.reason}
                      </p>
                    ) : null}
                  </article>
                )
              )
            ) : (
              <div className="p-8 text-center text-sm text-stone-600">
                No leave requests yet.
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarDays
              size={20}
            />
            <h2 className="font-bold text-black">
              Request leave
            </h2>
          </div>

          {canRequestLeave ? (
            <form
              className="mt-4 space-y-4"
              onSubmit={
                requestLeave
              }
            >
              <label className="block text-sm font-semibold text-black">
                Starts
                <input
                  required
                  type="datetime-local"
                  value={
                    leaveForm.startsAt
                  }
                  onChange={(
                    event
                  ) =>
                    setLeaveForm(
                      (current) => ({
                        ...current,
                        startsAt:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-black"
                />
              </label>

              <label className="block text-sm font-semibold text-black">
                Ends
                <input
                  required
                  type="datetime-local"
                  value={
                    leaveForm.endsAt
                  }
                  onChange={(
                    event
                  ) =>
                    setLeaveForm(
                      (current) => ({
                        ...current,
                        endsAt:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-black"
                />
              </label>

              <label className="block text-sm font-semibold text-black">
                Reason
                <textarea
                  rows="4"
                  maxLength="500"
                  value={
                    leaveForm.reason
                  }
                  onChange={(
                    event
                  ) =>
                    setLeaveForm(
                      (current) => ({
                        ...current,
                        reason:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-black"
                  placeholder="Holiday, appointment or other reason"
                />
              </label>

              <button
                type="submit"
                disabled={
                  requestingLeave
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-black bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 disabled:opacity-50"
              >
                <CalendarOff
                  size={16}
                />
                {requestingLeave
                  ? "Submitting…"
                  : "Submit leave request"}
              </button>
            </form>
          ) : (
            <p className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
              You can view your leave history, but leave-request permission has not been delegated to your account.
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}
