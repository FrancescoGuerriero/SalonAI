import {
  CalendarOff,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createPortal,
} from "react-dom";

import {
  staffApi,
} from "../../Services/futureFeaturesApi.js";
import useModalFocusTrap from "../../hooks/useModalFocusTrap.js";

const BLOCK_TYPES = [
  {
    value: "meeting",
    label: "Meeting",
  },
  {
    value: "training",
    label: "Training",
  },
  {
    value: "time_off",
    label: "Time off",
  },
  {
    value: "personal",
    label: "Personal",
  },
  {
    value: "other",
    label: "Other blocked time",
  },
];

function dateInput(
  value
) {
  const date =
    value
      ? new Date(value)
      : new Date();

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

  return `${year}-${month}-${day}`;
}

function timeInput(
  value
) {
  const date =
    value
      ? new Date(value)
      : new Date();

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

function localIso(
  date,
  time
) {
  const value =
    new Date(
      `${date}T${time}:00`
    );

  if (
    Number.isNaN(
      value.getTime()
    )
  ) {
    return "";
  }

  return value.toISOString();
}

export default function ScheduleBlockDialog({
  open,
  block = null,
  staffOptions = [],
  initialStart = null,
  canManage = false,
  onClose,
  onSaved,
}) {
  const modalPanelRef =
    useRef(null);
  const editing =
    Boolean(
      block?._id
    );

  const initialEnd =
    useMemo(() => {
      const start =
        initialStart
          ? new Date(
              initialStart
            )
          : new Date();

      return new Date(
        start.getTime() +
          60 * 60_000
      );
    }, [initialStart]);

  const [
    form,
    setForm,
  ] = useState({
    staff: "",
    blockType:
      "meeting",
    title: "",
    date: "",
    startTime: "",
    endTime: "",
    reason: "",
  });
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
      return;
    }

    const start =
      block?.startsAt ||
      initialStart ||
      new Date();
    const end =
      block?.endsAt ||
      initialEnd;

    setForm({
      staff:
        String(
          block?.staff?._id ||
            block?.staff ||
            staffOptions[0]
              ?.id ||
            ""
        ),
      blockType:
        block?.blockType ||
        "meeting",
      title:
        editing
          ? block?.title ||
            ""
          : "",
      date:
        dateInput(start),
      startTime:
        timeInput(start),
      endTime:
        timeInput(end),
      reason: "",
    });
    setError("");
  }, [
    block,
    editing,
    initialEnd,
    initialStart,
    open,
    staffOptions,
  ]);

  const closeDialog =
    useCallback(() => {
      if (!saving) {
        onClose?.();
      }
    }, [
      onClose,
      saving,
    ]);

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
      .overflow =
      "hidden";

    return () => {
      document.body.style
        .overflow =
        prior;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function update(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]:
          value,
      })
    );
    setError("");
  }

  async function submit(
    event
  ) {
    event.preventDefault();

    if (
      editing ||
      !canManage
    ) {
      return;
    }

    const startsAt =
      localIso(
        form.date,
        form.startTime
      );
    const endsAt =
      localIso(
        form.date,
        form.endTime
      );

    if (
      !form.staff ||
      !startsAt ||
      !endsAt
    ) {
      setError(
        "Employee, date and start/end times are required."
      );
      return;
    }

    if (
      new Date(endsAt) <=
      new Date(startsAt)
    ) {
      setError(
        "End time must be after start time."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      await staffApi.createCalendarBlock(
        form.staff,
        {
          startsAt,
          endsAt,
          blockType:
            form.blockType,
          title:
            form.title.trim(),
          reason:
            form.reason.trim(),
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
          "The schedule block could not be created."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function cancelBlock() {
    if (
      !editing ||
      !canManage
    ) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await staffApi.cancelCalendarBlock(
        block._id
      );

      await onSaved?.();
      onClose?.();
    } catch (
      requestError
    ) {
      setError(
        errorMessage(
          requestError,
          "The schedule block could not be cancelled."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedStaff =
    staffOptions.find(
      (staff) =>
        staff.id ===
        form.staff
    );

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center overflow-hidden bg-black/50 p-2 sm:p-4"
      role="presentation"
      onMouseDown={(
        event
      ) => {
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
        aria-labelledby="schedule-block-title"
        className="flex max-h-[calc(100dvh-1rem)] min-w-0 w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)]"
      >
        <header className="shrink-0 flex items-start justify-between gap-4 border-b border-stone-200 bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-black">
              <CalendarOff
                size={20}
              />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                Internal calendar
              </p>
              <h2
                id="schedule-block-title"
                className="mt-1 text-xl font-bold text-black"
              >
                {editing
                  ? "Schedule block"
                  : "Add schedule block"}
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Reserve staff availability without creating a customer appointment.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close schedule block"
            disabled={saving}
            onClick={
              closeDialog
            }
            className="min-h-11 min-w-11 rounded-lg p-2 text-black hover:bg-stone-100 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </header>

        <form
          className="min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto p-4 sm:p-5"
          onSubmit={submit}
        >
          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
            >
              {error}
            </div>
          ) : null}

          {editing ? (
            <div className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm">
              <p>
                <span className="font-bold">
                  Employee:
                </span>{" "}
                {block?.staff
                  ?.firstName ||
                block?.staff
                  ?.lastName
                  ? [
                      block.staff
                        .firstName,
                      block.staff
                        .lastName,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(" ")
                  : selectedStaff
                      ?.name ||
                    "Employee"}
              </p>
              <p>
                <span className="font-bold">
                  Type:
                </span>{" "}
                {String(
                  block?.blockType ||
                    "time_off"
                ).replaceAll(
                  "_",
                  " "
                )}
              </p>
              <p>
                <span className="font-bold">
                  Time:
                </span>{" "}
                {new Date(
                  block.startsAt
                ).toLocaleString(
                  "en-GB"
                )}{" "}
                –{" "}
                {new Date(
                  block.endsAt
                ).toLocaleString(
                  "en-GB"
                )}
              </p>
            </div>
          ) : (
            <>
              <label className="grid gap-2 text-sm font-bold text-black">
                Employee
                <select
                  required
                  value={
                    form.staff
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "staff",
                      event.target
                        .value
                    )
                  }
                  className="rounded-xl border border-stone-300 bg-white px-3 py-3 font-normal"
                >
                  <option value="">
                    Choose employee
                  </option>
                  {staffOptions.map(
                    (
                      staff
                    ) => (
                      <option
                        key={
                          staff.id
                        }
                        value={
                          staff.id
                        }
                      >
                        {
                          staff.name
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-black">
                  Block type
                  <select
                    value={
                      form.blockType
                    }
                    onChange={(
                      event
                    ) =>
                      update(
                        "blockType",
                        event.target
                          .value
                      )
                    }
                    className="rounded-xl border border-stone-300 bg-white px-3 py-3 font-normal"
                  >
                    {BLOCK_TYPES.map(
                      (
                        option
                      ) => (
                        <option
                          key={
                            option.value
                          }
                          value={
                            option.value
                          }
                        >
                          {
                            option.label
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-bold text-black">
                  Title
                  <input
                    maxLength={120}
                    value={
                      form.title
                    }
                    onChange={(
                      event
                    ) =>
                      update(
                        "title",
                        event.target
                          .value
                      )
                    }
                    placeholder="e.g. Training session"
                    className="rounded-xl border border-stone-300 px-3 py-3 font-normal"
                  />
                </label>

                <label className="grid gap-2 text-sm font-bold text-black">
                  Date
                  <input
                    required
                    type="date"
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
                    className="rounded-xl border border-stone-300 px-3 py-3 font-normal"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2 text-sm font-bold text-black">
                    Start
                    <input
                      required
                      type="time"
                      step="300"
                      value={
                        form.startTime
                      }
                      onChange={(
                        event
                      ) =>
                        update(
                          "startTime",
                          event.target
                            .value
                        )
                      }
                      className="rounded-xl border border-stone-300 px-3 py-3 font-normal"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-bold text-black">
                    End
                    <input
                      required
                      type="time"
                      step="300"
                      value={
                        form.endTime
                      }
                      onChange={(
                        event
                      ) =>
                        update(
                          "endTime",
                          event.target
                            .value
                        )
                      }
                      className="rounded-xl border border-stone-300 px-3 py-3 font-normal"
                    />
                  </label>
                </div>
              </div>

              <label className="grid gap-2 text-sm font-bold text-black">
                Internal reason / note
                <textarea
                  rows="3"
                  maxLength={500}
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
                  className="rounded-xl border border-stone-300 px-3 py-3 font-normal"
                />
              </label>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-stone-700">
                Personal and time-off blocks are displayed to calendar users simply as “Unavailable”; private reasons are not exposed in the calendar feed.
              </div>
            </>
          )}
        </form>

        <footer className="shrink-0 flex flex-col-reverse gap-3 border-t border-stone-200 bg-white p-4 sm:flex-row sm:justify-end sm:p-5">
          <button
            type="button"
            disabled={saving}
            onClick={
              closeDialog
            }
            className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-black hover:border-amber-400 disabled:opacity-50"
          >
            Close
          </button>

          {editing ? (
            canManage ? (
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void cancelBlock()
                }
                className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-800 hover:border-red-400 disabled:opacity-50"
              >
                {saving
                  ? "Cancelling…"
                  : "Cancel block"}
              </button>
            ) : null
          ) : (
            <button
              type="submit"
              form={undefined}
              disabled={
                saving ||
                !canManage
              }
              onClick={(
                event
              ) => {
                const form =
                  event.currentTarget
                    .closest(
                      "section"
                    )
                    ?.querySelector(
                      "form"
                    );

                form?.requestSubmit();
              }}
              className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-black hover:bg-amber-300 disabled:opacity-50"
            >
              {saving
                ? "Saving…"
                : "Add block"}
            </button>
          )}
        </footer>
      </section>
    </div>,
    document.body
  );
}
