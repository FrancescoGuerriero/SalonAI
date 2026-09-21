import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Calendar,
  momentLocalizer,
} from "react-big-calendar";
import moment from "moment";
import {
  Plus,
  RefreshCw,
} from "lucide-react";

import "react-big-calendar/lib/css/react-big-calendar.css";

import adminStaffService from "../../Services/adminStaffService.js";
import appointmentManagementApi from "../../Services/appointmentManagementApi.js";
import {
  staffApi,
} from "../../Services/futureFeaturesApi.js";
import serviceService from "../../Services/serviceService.js";
import useAuth from "../../hooks/useAuth.js";
import {
  hasPermission,
} from "../../utils/permissions.js";
import AppointmentEditorDialog from "./AppointmentEditorDialog.jsx";

const ScheduleBlockDialog =
  lazy(
    () =>
      import(
        "./ScheduleBlockDialog.jsx"
      )
  );

const localizer =
  momentLocalizer(moment);

const STATUS_COLOURS = {
  pending: "#b28a20",
  confirmed: "#111111",
  checked_in: "#6b665b",
  in_progress: "#8a6b16",
  completed: "#555552",
  cancelled: "#a8a29e",
  no_show: "#78716c",
};

function arrayFrom(
  value,
  keys = []
) {
  if (Array.isArray(value)) {
    return value;
  }

  for (const key of keys) {
    if (
      Array.isArray(
        value?.[key]
      )
    ) {
      return value[key];
    }
  }

  return [];
}

function appointmentStart(
  appointment
) {
  const direct =
    appointment?.startsAt;

  if (direct) {
    const parsed =
      new Date(direct);

    if (
      !Number.isNaN(
        parsed.getTime()
      )
    ) {
      return parsed;
    }
  }

  if (
    !appointment
      ?.appointmentDate
  ) {
    return null;
  }

  const date =
    new Date(
      appointment
        .appointmentDate
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  const [
    hours = 0,
    minutes = 0,
  ] = String(
    appointment
      .appointmentTime ||
      "00:00"
  )
    .split(":")
    .map(Number);

  date.setHours(
    hours || 0,
    minutes || 0,
    0,
    0
  );

  return date;
}

function appointmentEnd(
  appointment,
  start
) {
  if (
    appointment?.endsAt
  ) {
    const parsed =
      new Date(
        appointment.endsAt
      );

    if (
      !Number.isNaN(
        parsed.getTime()
      )
    ) {
      return parsed;
    }
  }

  if (!start) {
    return null;
  }

  const duration =
    Math.max(
      1,
      Number(
        appointment
          ?.duration ||
          appointment
            ?.service
            ?.duration ||
          60
      ) || 60
    );

  return new Date(
    start.getTime() +
      duration * 60_000
  );
}

function personName(
  value
) {
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

function calendarRange(
  value
) {
  if (
    Array.isArray(value) &&
    value.length
  ) {
    return {
      start:
        value[0],
      end:
        value[
          value.length - 1
        ],
    };
  }

  if (
    value?.start &&
    value?.end
  ) {
    return value;
  }

  const now =
    new Date();

  return {
    start:
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 7
      ),
    end:
      new Date(
        now.getFullYear(),
        now.getMonth() + 2,
        now.getDate()
      ),
  };
}

function isoDay(value) {
  const date =
    new Date(value);

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

export default function AppointmentCalendar() {
  const {
    user,
  } = useAuth();

  const canRead =
    hasPermission(
      user,
      "appointment:read"
    );
  const canCreate =
    hasPermission(
      user,
      "appointment:create"
    );
  const canUpdate =
    hasPermission(
      user,
      "appointment:update"
    );
  const canCancel =
    hasPermission(
      user,
      "appointment:cancel"
    );
  const canManageSchedule =
    hasPermission(
      user,
      "employee:read"
    ) &&
    hasPermission(
      user,
      "employee:schedule:update"
    );

  const [
    appointments,
    setAppointments,
  ] = useState([]);
  const [
    scheduleBlocks,
    setScheduleBlocks,
  ] = useState([]);
  const [
    blockStaff,
    setBlockStaff,
  ] = useState([]);
  const [
    services,
    setServices,
  ] = useState([]);
  const [
    stylists,
    setStylists,
  ] = useState([]);
  const [
    range,
    setRange,
  ] = useState(
    calendarRange()
  );
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    error,
    setError,
  ] = useState("");
  const [
    editor,
    setEditor,
  ] = useState({
    open: false,
    appointment: null,
    initialStart: null,
  });
  const [
    blockEditor,
    setBlockEditor,
  ] = useState({
    open: false,
    block: null,
    initialStart: null,
  });

  const loadOptions =
    useCallback(
      async () => {
        try {
          const [
            serviceItems,
            stylistResult,
          ] =
            await Promise.all([
              serviceService.getServices(),
              appointmentManagementApi.stylists(),
            ]);

          setServices(
            arrayFrom(
              serviceItems,
              ["services"]
            )
          );
          setStylists(
            arrayFrom(
              stylistResult,
              [
                "stylists",
                "items",
                "data",
              ]
            )
          );
        } catch (
          requestError
        ) {
          setError(
            requestError
              ?.response?.data
              ?.message ||
              requestError
                ?.message ||
              "Calendar resources could not be loaded."
          );
        }
      },
      []
    );

  const loadBlockStaff =
    useCallback(
      async () => {
        if (!canManageSchedule) {
          setBlockStaff([]);
          return;
        }

        try {
          const result =
            await adminStaffService.list({
              limit: 500,
            });
          const workforce =
            arrayFrom(
              result,
              [
                "users",
                "items",
              ]
            );
          const byProfile =
            new Map();

          for (
            const employee
            of workforce
          ) {
            const profile =
              employee?.stylistProfile;
            const id =
              String(
                profile?.id ||
                  profile?._id ||
                  ""
              );

            if (!id) {
              continue;
            }

            byProfile.set(
              id,
              {
                id,
                name:
                  employee?.name ||
                  personName(
                    profile
                  ) ||
                  "Employee",
              }
            );
          }

          setBlockStaff(
            [
              ...byProfile.values(),
            ].sort(
              (
                left,
                right
              ) =>
                left.name.localeCompare(
                  right.name,
                  "en",
                  {
                    sensitivity:
                      "base",
                  }
                )
            )
          );
        } catch (
          requestError
        ) {
          setError(
            requestError
              ?.response?.data
              ?.message ||
              requestError
                ?.message ||
              "Employee schedule resources could not be loaded."
          );
        }
      },
      [
        canManageSchedule,
      ]
    );

  const loadAppointments =
    useCallback(
      async (
        selectedRange =
          range
      ) => {
        if (!canRead) {
          setAppointments([]);
          setScheduleBlocks([]);
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setError("");

          const startDate =
            isoDay(
              selectedRange.start
            );
          const endDate =
            isoDay(
              selectedRange.end
            );
          const [
            result,
            blockResult,
          ] =
            await Promise.all([
              appointmentManagementApi.getCalendar(
                {
                  startDate,
                  endDate,
                  limit: 5000,
                }
              ),
              staffApi.listCalendarBlocks({
                startDate,
                endDate,
              }),
            ]);

          setAppointments(
            arrayFrom(
              result,
              [
                "items",
                "appointments",
              ]
            )
          );
          setScheduleBlocks(
            arrayFrom(
              blockResult,
              [
                "items",
                "blocks",
              ]
            )
          );
        } catch (
          requestError
        ) {
          setAppointments([]);
          setScheduleBlocks([]);
          setError(
            requestError
              ?.response?.data
              ?.message ||
              requestError
                ?.message ||
              "Appointments could not be loaded."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        canRead,
        range,
      ]
    );

  useEffect(() => {
    if (
      canCreate ||
      canUpdate
    ) {
      void loadOptions();
    }
  }, [
    canCreate,
    canUpdate,
    loadOptions,
  ]);

  useEffect(() => {
    void loadAppointments(
      range
    );
  }, [
    loadAppointments,
    range,
  ]);

  useEffect(() => {
    void loadBlockStaff();
  }, [
    loadBlockStaff,
  ]);

  const events =
    useMemo(
      () => [
        ...appointments.flatMap(
          (appointment) => {
            const start =
              appointmentStart(
                appointment
              );
            const end =
              appointmentEnd(
                appointment,
                start
              );

            if (
              !start ||
              !end
            ) {
              return [];
            }

            const customer =
              personName(
                appointment.customer
              ) ||
              "Customer";
            const service =
              appointment
                .service?.name ||
              "Service";

            return [
              {
                id:
                  appointment._id,
                kind:
                  "appointment",
                title:
                  customer +
                  " — " +
                  service,
                start,
                end,
                resource:
                  appointment,
              },
            ];
          }
        ),
        ...scheduleBlocks.flatMap(
          (block) => {
            const start =
              new Date(
                block.startsAt
              );
            const end =
              new Date(
                block.endsAt
              );

            if (
              Number.isNaN(
                start.getTime()
              ) ||
              Number.isNaN(
                end.getTime()
              )
            ) {
              return [];
            }

            return [
              {
                id:
                  `block:${block._id}`,
                kind:
                  "schedule_block",
                title:
                  (personName(
                    block.staff
                  ) ||
                    "Employee") +
                  " — " +
                  (block.title ||
                    "Unavailable"),
                start,
                end,
                resource:
                  block,
              },
            ];
          }
        ),
      ],
      [
        appointments,
        scheduleBlocks,
      ]
    );

  function onRangeChange(
    nextRange
  ) {
    setRange(
      calendarRange(
        nextRange
      )
    );
  }

  function openExisting(
    event
  ) {
    if (
      event.kind ===
      "schedule_block"
    ) {
      setBlockEditor({
        open: true,
        block:
          event.resource,
        initialStart: null,
      });
      return;
    }

    setEditor({
      open: true,
      appointment:
        event.resource,
      initialStart: null,
    });
  }

  function openSlot(
    slot
  ) {
    if (!canCreate) {
      return;
    }

    setEditor({
      open: true,
      appointment: null,
      initialStart:
        slot.start,
    });
  }

  if (!canRead) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-black">
          Appointment calendar
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          Your account does not currently have permission to view salon appointments.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-black">
              Appointment calendar
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              SalonAI is the source of truth. Select an appointment or schedule block to view or manage it.
              {canCreate
                ? " Select an empty time slot to add a booking."
                : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void loadAppointments(
                  range
                )
              }
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-bold text-black hover:border-amber-400 disabled:opacity-50"
            >
              <RefreshCw
                size={15}
              />
              Refresh
            </button>

            {canManageSchedule ? (
              <button
                type="button"
                onClick={() =>
                  setBlockEditor({
                    open: true,
                    block: null,
                    initialStart:
                      new Date(),
                  })
                }
                className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-bold text-black hover:border-amber-400"
              >
                <Plus
                  size={16}
                />
                Add schedule block
              </button>
            ) : null}

            {canCreate ? (
              <button
                type="button"
                onClick={() =>
                  setEditor({
                    open: true,
                    appointment:
                      null,
                    initialStart:
                      new Date(),
                  })
                }
                className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-sm font-black text-black hover:bg-amber-300"
              >
                <Plus
                  size={16}
                />
                Add appointment
              </button>
            ) : null}
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800"
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <div
            role="status"
            className="mb-4 rounded-xl bg-stone-100 p-3 text-sm font-semibold text-stone-700"
          >
            Loading calendar…
          </div>
        ) : null}

        <div className="min-h-[650px] overflow-x-auto">
          <div className="min-w-[760px]">
            <Calendar
              localizer={
                localizer
              }
              events={events}
              startAccessor="start"
              endAccessor="end"
              selectable={
                canCreate
              }
              popup
              defaultView="week"
              views={[
                "day",
                "week",
                "month",
                "agenda",
              ]}
              style={{
                height: 760,
              }}
              onRangeChange={
                onRangeChange
              }
              onSelectEvent={
                openExisting
              }
              onSelectSlot={
                openSlot
              }
              eventPropGetter={(
                event
              ) => ({
                style: {
                  backgroundColor:
                    event.kind ===
                    "schedule_block"
                      ? "#78716c"
                      : STATUS_COLOURS[
                          event
                            .resource
                            ?.status
                        ] ||
                        "#555552",
                  border: "0",
                  borderRadius:
                    "7px",
                  color: "#ffffff",
                  padding:
                    "2px 4px",
                },
              })}
            />
          </div>
        </div>
      </section>

      {blockEditor.open ? (
        <Suspense
          fallback={null}
        >
          <ScheduleBlockDialog
            open
            block={
              blockEditor.block
            }
            initialStart={
              blockEditor.initialStart
            }
            staffOptions={
              blockStaff
            }
            canManage={
              canManageSchedule
            }
            onClose={() =>
              setBlockEditor({
                open: false,
                block: null,
                initialStart:
                  null,
              })
            }
            onSaved={() =>
              loadAppointments(
                range
              )
            }
          />
        </Suspense>
      ) : null}

      <AppointmentEditorDialog
        open={editor.open}
        appointment={
          editor.appointment
        }
        initialStart={
          editor.initialStart
        }
        services={services}
        stylists={stylists}
        canCreate={
          canCreate
        }
        canUpdate={
          canUpdate
        }
        canCancel={
          canCancel
        }
        onClose={() =>
          setEditor({
            open: false,
            appointment:
              null,
            initialStart:
              null,
          })
        }
        onSaved={() =>
          loadAppointments(
            range
          )
        }
      />
    </>
  );
}
