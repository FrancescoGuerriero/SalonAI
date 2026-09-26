import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

import Appointment from "../src/models/Appointment.js";
import CalendarSyncTask from "../src/models/CalendarSyncTask.js";
import Customer from "../src/models/customer.js";
import ExternalCalendarConnection from "../src/models/ExternalCalendarConnection.js";
import ExternalCalendarEventLink from "../src/models/ExternalCalendarEventLink.js";
import Service from "../src/models/service.js";
import Stylist from "../src/models/Stylist.js";
import User from "../src/models/user.js";

import {
  checkAppointmentConflict,
  createManagedAppointment,
  rescheduleAppointment,
} from "../src/features/appointments/appointmentManagementService.js";
import {
  assertAppointmentWithinStaffAvailability,
  dayAvailability,
} from "../src/features/staff/staffService.js";
import {
  getCalendarProviderContext,
} from "../src/integrations/calendar/calendarConnectionService.js";
import {
  buildAppointmentCalendarEvent,
} from "../src/integrations/calendar/calendarEvent.js";
import {
  deleteProviderEvent,
  getProviderEvent,
  updateProviderEvent,
} from "../src/integrations/calendar/calendarProviderEventApi.js";
import {
  hasUserPermission,
} from "../src/middleware/permissionMiddleware.js";
import {
  addSalonDays,
  combineSalonDateAndTime,
} from "../src/shared/salonTime.js";

const CONFIRMATION =
  "RUN_CALENDAR_APPOINTMENT_SYNC_ACCEPTANCE";
const RESULT_BEGIN =
  "__SALONAI_APPOINTMENT_SYNC_ACCEPTANCE_BEGIN__";
const RESULT_END =
  "__SALONAI_APPOINTMENT_SYNC_ACCEPTANCE_END__";
const POLL_INTERVAL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 150000;
const SLOT_SEARCH_START_DAYS = 35;
const SLOT_SEARCH_END_DAYS = 70;

function text(value) {
  return String(value ?? "").trim();
}

function acceptanceError(
  code,
  message
) {
  const error =
    new Error(message);
  error.code = code;
  return error;
}

function instant(value) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

function sameInstant(
  left,
  right
) {
  const leftDate =
    instant(left);
  const rightDate =
    instant(right);

  return Boolean(
    leftDate &&
    rightDate &&
    Math.abs(
      leftDate.getTime() -
      rightDate.getTime()
    ) < 1000
  );
}

function overlap(
  leftStart,
  leftEnd,
  rightStart,
  rightEnd
) {
  const aStart =
    instant(leftStart);
  const aEnd =
    instant(leftEnd);
  const bStart =
    instant(rightStart);
  const bEnd =
    instant(rightEnd);

  if (
    !aStart ||
    !aEnd ||
    !bStart ||
    !bEnd
  ) {
    return false;
  }

  return (
    aStart < bEnd &&
    aEnd > bStart
  );
}

function minutes(value) {
  const match =
    /^([01]\d|2[0-3]):([0-5]\d)$/
      .exec(
        text(value)
      );

  if (!match) {
    throw acceptanceError(
      "CALENDAR_ACCEPTANCE_INVALID_RANGE",
      "Staff availability returned an invalid HH:mm range."
    );
  }

  return (
    Number(match[1]) * 60 +
    Number(match[2])
  );
}

function timeFromMinutes(
  total
) {
  const hour =
    Math.floor(
      total / 60
    );
  const minute =
    total % 60;

  return (
    String(hour)
      .padStart(2, "0") +
    ":" +
    String(minute)
      .padStart(2, "0")
  );
}

async function sleep(
  milliseconds
) {
  await new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

async function waitFor(
  probe,
  {
    timeoutMs =
      DEFAULT_TIMEOUT_MS,
    label =
      "acceptance condition",
  } = {}
) {
  const started =
    Date.now();

  while (
    Date.now() -
      started <
    timeoutMs
  ) {
    const result =
      await probe();

    if (result) {
      return result;
    }

    await sleep(
      POLL_INTERVAL_MS
    );
  }

  throw acceptanceError(
    "CALENDAR_ACCEPTANCE_TIMEOUT",
    "Timed out waiting for " +
      label +
      "."
  );
}

function serviceIsBookable(
  service
) {
  if (!service) {
    return false;
  }

  return (
    typeof service.bookable ===
      "boolean"
  )
    ? service.bookable
    : service.onlineBookable !==
        false;
}

async function findConnection(
  provider
) {
  const requestedId =
    text(
      process.env
        .CALENDAR_APPOINTMENT_ACCEPTANCE_CONNECTION_ID
    );

  if (requestedId) {
    const selected =
      await ExternalCalendarConnection
        .findById(
          requestedId
        )
        .select(
          "_id user provider calendarId status syncEnabled lastWebhookAt"
        )
        .lean();

    if (
      !selected ||
      selected.provider !==
        provider ||
      selected.status !==
        "connected" ||
      selected.syncEnabled !==
        true
    ) {
      throw acceptanceError(
        "CALENDAR_ACCEPTANCE_CONNECTION_INVALID",
        "The selected calendar connection is not a connected, sync-enabled candidate for the requested provider."
      );
    }

    return selected;
  }

  const matches =
    await ExternalCalendarConnection
      .find({
        provider,
        status:
          "connected",
        syncEnabled:
          true,
      })
      .select(
        "_id user provider calendarId status syncEnabled lastWebhookAt"
      )
      .limit(2)
      .lean();

  if (
    matches.length !==
      1
  ) {
    throw acceptanceError(
      "CALENDAR_ACCEPTANCE_CONNECTION_AMBIGUOUS",
      matches.length === 0
        ? "No connected, sync-enabled calendar connection exists for the requested provider."
        : "More than one connected, sync-enabled calendar connection exists; acceptance requires an explicit connection identifier."
    );
  }

  return matches[0];
}

async function findMappedStylist(
  connection
) {
  const actor =
    await User.findById(
      connection.user
    )
      .select(
        "_id role permissions rolePermissions isActive"
      )
      .lean();

  if (!actor) {
    throw acceptanceError(
      "CALENDAR_ACCEPTANCE_USER_MISSING",
      "The calendar connection does not map to an active SalonAI user record."
    );
  }

  const stylist =
    await Stylist.findOne({
      userAccount:
        actor._id,
      isActive:
        true,
      acceptsAppointments:
        true,
    })
      .select(
        "_id userAccount firstName lastName isActive acceptsAppointments"
      )
      .lean();

  if (!stylist) {
    throw acceptanceError(
      "CALENDAR_ACCEPTANCE_STYLIST_MAPPING_MISSING",
      "The connected calendar user is not mapped to an active, appointment-accepting stylist profile."
    );
  }

  const permissions = {
    update:
      hasUserPermission(
        actor,
        "appointment:update"
      ),
    cancel:
      hasUserPermission(
        actor,
        "appointment:cancel"
      ),
  };

  if (
    !permissions.update ||
    !permissions.cancel
  ) {
    throw acceptanceError(
      "CALENDAR_ACCEPTANCE_PERMISSION_GAP",
      "The connected staff account must have appointment:update and appointment:cancel permissions for two-way calendar acceptance."
    );
  }

  return {
    actor,
    stylist,
    permissions,
  };
}

async function findService() {
  const candidates =
    await Service.find({
      active: {
        $ne: false,
      },
    })
      .select(
        "_id name duration active bookable +onlineBookable"
      )
      .sort({
        duration: 1,
        _id: 1,
      })
      .lean();

  const service =
    candidates.find(
      serviceIsBookable
    );

  if (!service) {
    throw acceptanceError(
      "CALENDAR_ACCEPTANCE_SERVICE_MISSING",
      "No active globally bookable service is available for the appointment-sync acceptance."
    );
  }

  return service;
}

async function findAcceptanceSlots({
  stylistId,
  duration,
  count = 3,
}) {
  const slots = [];

  for (
    let dayOffset =
      SLOT_SEARCH_START_DAYS;
    dayOffset <=
      SLOT_SEARCH_END_DAYS &&
    slots.length < count;
    dayOffset += 1
  ) {
    const day =
      addSalonDays(
        new Date(),
        dayOffset
      );

    const availability =
      await dayAvailability(
        stylistId,
        day
      );

    const ranges =
      availability
        ?.availability
        ?.ranges || [];

    for (
      const range of ranges
    ) {
      const rangeStart =
        minutes(
          range.start
        );
      const rangeEnd =
        minutes(
          range.end
        );

      for (
        let startMinutes =
          rangeStart;
        startMinutes +
          duration <=
        rangeEnd;
        startMinutes += 15
      ) {
        const start =
          combineSalonDateAndTime(
            day,
            timeFromMinutes(
              startMinutes
            )
          );
        const end =
          new Date(
            start.getTime() +
              duration *
                60 *
                1000
          );

        if (
          slots.some(
            (slot) =>
              overlap(
                start,
                end,
                slot.start,
                slot.end
              )
          )
        ) {
          continue;
        }

        const knownConflict = [
          ...(
            availability
              ?.appointments ||
            []
          ),
          ...(
            availability
              ?.timeOff ||
            []
          ),
        ].some(
          (entry) =>
            overlap(
              start,
              end,
              entry.startsAt,
              entry.endsAt
            )
        );

        if (knownConflict) {
          continue;
        }

        try {
          await assertAppointmentWithinStaffAvailability(
            stylistId,
            start,
            end
          );

          const conflict =
            await checkAppointmentConflict({
              stylist:
                stylistId,
              startsAt:
                start,
              endsAt:
                end,
              duration,
            });

          if (
            conflict
              .hasConflict
          ) {
            continue;
          }
        } catch {
          continue;
        }

        slots.push({
          start,
          end,
        });

        if (
          slots.length >=
            count
        ) {
          return slots;
        }
      }
    }
  }

  throw acceptanceError(
    "CALENDAR_ACCEPTANCE_SLOT_MISSING",
    "Could not find three conflict-free staff appointment windows for the controlled acceptance run."
  );
}

async function waitForLink(
  connectionId,
  appointmentId
) {
  return waitFor(
    async () =>
      ExternalCalendarEventLink
        .findOne({
          connection:
            connectionId,
          appointment:
            appointmentId,
          status:
            "synced",
        })
        .lean(),
    {
      label:
        "SalonAI outbound calendar event link creation",
    }
  );
}

async function waitForTaskConvergence(
  appointmentId
) {
  return waitFor(
    async () => {
      const task =
        await CalendarSyncTask
          .findOne({
            appointment:
              appointmentId,
          })
          .lean();

      if (!task) {
        return null;
      }

      if (
        task.state ===
          "dead"
      ) {
        throw acceptanceError(
          "CALENDAR_ACCEPTANCE_OUTBOX_DEAD",
          "The calendar synchronization outbox task entered the dead state."
        );
      }

      return (
        task.state ===
          "completed" &&
        Number(
          task.processedRevision ||
            0
        ) >=
          Number(
            task.requestedRevision ||
              0
          )
      )
        ? task
        : null;
    },
    {
      label:
        "calendar synchronization outbox convergence",
    }
  );
}

async function waitForProviderWindow({
  provider,
  calendarId,
  accessToken,
  providerEventId,
  start,
  end,
}) {
  return waitFor(
    async () => {
      try {
        const event =
          await getProviderEvent({
            provider,
            calendarId,
            accessToken,
            providerEventId,
          });

        return (
          !event.deleted &&
          sameInstant(
            event.start,
            start
          ) &&
          sameInstant(
            event.end,
            end
          )
        )
          ? event
          : null;
      } catch {
        return null;
      }
    },
    {
      label:
        "provider event window synchronization",
    }
  );
}

async function waitForAppointmentWindow({
  appointmentId,
  start,
  end,
}) {
  return waitFor(
    async () => {
      const appointment =
        await Appointment
          .findById(
            appointmentId
          )
          .select(
            "_id startsAt endsAt status"
          )
          .lean();

      return (
        appointment &&
        sameInstant(
          appointment.startsAt,
          start
        ) &&
        sameInstant(
          appointment.endsAt,
          end
        )
      )
        ? appointment
        : null;
    },
    {
      label:
        "Google-to-SalonAI appointment reschedule",
    }
  );
}

async function waitForAppointmentCancelled(
  appointmentId
) {
  return waitFor(
    async () => {
      const appointment =
        await Appointment
          .findById(
            appointmentId
          )
          .select(
            "_id status"
          )
          .lean();

      return (
        appointment
          ?.status ===
        "cancelled"
      )
        ? appointment
        : null;
    },
    {
      label:
        "Google-to-SalonAI appointment cancellation",
    }
  );
}

async function waitForWebhookAfter(
  connectionId,
  baseline
) {
  const baselineMs =
    instant(
      baseline
    )?.getTime() ||
    0;

  return waitFor(
    async () => {
      const connection =
        await ExternalCalendarConnection
          .findById(
            connectionId
          )
          .select(
            "lastWebhookAt"
          )
          .lean();

      const observed =
        instant(
          connection
            ?.lastWebhookAt
        );

      return (
        observed &&
        observed.getTime() >
          baselineMs
      )
        ? observed
        : null;
    },
    {
      label:
        "verified provider webhook",
    }
  );
}

async function cleanup({
  appointmentId,
  customerId,
  connectionId,
  provider,
  calendarId,
  accessToken,
  providerEventId,
  providerDeleted,
}) {
  const result = {
    providerEventDeleted:
      Boolean(
        providerDeleted
      ),
    eventLinkDeleted:
      false,
    syncTaskDeleted:
      false,
    appointmentDeleted:
      false,
    customerDeleted:
      false,
  };

  if (
    providerEventId &&
    !providerDeleted &&
    provider &&
    calendarId &&
    accessToken
  ) {
    try {
      await deleteProviderEvent({
        provider,
        calendarId,
        accessToken,
        providerEventId,
      });
      result.providerEventDeleted =
        true;
    } catch {
      result.providerEventDeleted =
        false;
    }
  }

  if (appointmentId) {
    const link =
      await ExternalCalendarEventLink
        .deleteMany({
          appointment:
            appointmentId,
          ...(connectionId
            ? {
                connection:
                  connectionId,
              }
            : {}),
        });
    result.eventLinkDeleted =
      link.deletedCount >
      0;

    const task =
      await CalendarSyncTask
        .deleteMany({
          appointment:
            appointmentId,
        });
    result.syncTaskDeleted =
      task.deletedCount >
      0;

    const appointment =
      await Appointment.deleteOne({
        _id:
          appointmentId,
      });
    result.appointmentDeleted =
      appointment.deletedCount ===
      1;
  }

  if (customerId) {
    const customer =
      await Customer.deleteOne({
        _id:
          customerId,
      });
    result.customerDeleted =
      customer.deletedCount ===
      1;
  }

  return result;
}

async function runAcceptance() {
  if (
    text(
      process.env
        .CALENDAR_APPOINTMENT_ACCEPTANCE_CONFIRM
    ) !==
    CONFIRMATION
  ) {
    throw acceptanceError(
      "CALENDAR_ACCEPTANCE_CONFIRMATION_REQUIRED",
      "Refusing to create a production appointment. Explicit calendar appointment acceptance confirmation is missing."
    );
  }

  const provider =
    text(
      process.env
        .CALENDAR_APPOINTMENT_ACCEPTANCE_PROVIDER ||
      "google"
    )
      .toLowerCase();

  if (
    ![
      "google",
      "outlook",
    ].includes(
      provider
    )
  ) {
    throw acceptanceError(
      "CALENDAR_ACCEPTANCE_PROVIDER_INVALID",
      "Calendar appointment acceptance provider must be google or outlook."
    );
  }

  const mongoUri =
    text(
      process.env.MONGODB_URI ||
      process.env.MONGO_URI
    );

  if (!mongoUri) {
    throw acceptanceError(
      "CALENDAR_ACCEPTANCE_MONGO_MISSING",
      "MONGODB_URI is required for calendar appointment acceptance."
    );
  }

  await mongoose.connect(
    mongoUri,
    {
      serverSelectionTimeoutMS:
        15000,
    }
  );

  const state = {
    appointmentId:
      null,
    customerId:
      null,
    connectionId:
      null,
    provider,
    calendarId:
      "",
    accessToken:
      "",
    providerEventId:
      "",
    providerDeleted:
      false,
  };

  let primaryError =
    null;
  let acceptance =
    null;
  let cleanupResult =
    null;

  try {
    const connection =
      await findConnection(
        provider
      );
    state.connectionId =
      connection._id;

    const {
      actor,
      stylist,
      permissions,
    } =
      await findMappedStylist(
        connection
      );

    const service =
      await findService();

    const duration =
      Math.max(
        1,
        Number(
          service.duration
        ) || 30
      );

    const slots =
      await findAcceptanceSlots({
        stylistId:
          stylist._id,
        duration,
        count: 3,
      });

    const unique =
      randomUUID();

    const customer =
      await Customer.create({
        firstName:
          "Calendar",
        lastName:
          "Acceptance",
        email:
          "calendar-acceptance-" +
          unique +
          "@example.invalid",
        source:
          "manual",
        status:
          "active",
        createdBy:
          actor._id,
        updatedBy:
          actor._id,
      });
    state.customerId =
      customer._id;

    const appointment =
      await createManagedAppointment(
        {
          customer:
            customer._id,
          stylist:
            stylist._id,
          service:
            service._id,
          startsAt:
            slots[0].start,
          endsAt:
            slots[0].end,
          duration,
          totalPrice: 0,
          status:
            "confirmed",
          notes: "",
          internalNotes:
            "Temporary automated calendar appointment-sync acceptance.",
        },
        {
          actor,
          bookingSource:
            "management",
          returnPopulated:
            false,
        }
      );
    state.appointmentId =
      appointment._id;

    const link =
      await waitForLink(
        connection._id,
        appointment._id
      );
    state.providerEventId =
      text(
        link.providerEventId
      );

    await waitForTaskConvergence(
      appointment._id
    );

    const context =
      await getCalendarProviderContext({
        connectionId:
          connection._id,
      });
    state.calendarId =
      context.connection
        .calendarId;
    state.accessToken =
      context.accessToken;

    await waitForProviderWindow({
      provider,
      calendarId:
        state.calendarId,
      accessToken:
        state.accessToken,
      providerEventId:
        state.providerEventId,
      start:
        slots[0].start,
      end:
        slots[0].end,
    });

    await rescheduleAppointment(
      appointment._id,
      {
        startsAt:
          slots[1].start,
        endsAt:
          slots[1].end,
        reason:
          "Calendar appointment-sync acceptance outbound reschedule.",
      },
      {
        actor,
      }
    );

    await waitForTaskConvergence(
      appointment._id
    );

    await waitForProviderWindow({
      provider,
      calendarId:
        state.calendarId,
      accessToken:
        state.accessToken,
      providerEventId:
        state.providerEventId,
      start:
        slots[1].start,
      end:
        slots[1].end,
    });

    const outboundAppointment =
      await Appointment
        .findById(
          appointment._id
        )
        .populate(
          "service",
          "name"
        )
        .populate(
          "stylist",
          "firstName lastName"
        )
        .lean();

    const providerUpdate =
      {
        ...buildAppointmentCalendarEvent({
          appointment:
            outboundAppointment,
        }),
        start:
          slots[2].start
            .toISOString(),
        end:
          slots[2].end
            .toISOString(),
      };

    const beforeInboundUpdate =
      await ExternalCalendarConnection
        .findById(
          connection._id
        )
        .select(
          "lastWebhookAt"
        )
        .lean();

    await updateProviderEvent({
      provider,
      calendarId:
        state.calendarId,
      accessToken:
        state.accessToken,
      providerEventId:
        state.providerEventId,
      event:
        providerUpdate,
    });

    await Promise.all([
      waitForAppointmentWindow({
        appointmentId:
          appointment._id,
        start:
          slots[2].start,
        end:
          slots[2].end,
      }),
      waitForWebhookAfter(
        connection._id,
        beforeInboundUpdate
          ?.lastWebhookAt
      ),
    ]);

    await waitForTaskConvergence(
      appointment._id
    );

    const beforeDelete =
      await ExternalCalendarConnection
        .findById(
          connection._id
        )
        .select(
          "lastWebhookAt"
        )
        .lean();

    await deleteProviderEvent({
      provider,
      calendarId:
        state.calendarId,
      accessToken:
        state.accessToken,
      providerEventId:
        state.providerEventId,
    });
    state.providerDeleted =
      true;

    await Promise.all([
      waitForAppointmentCancelled(
        appointment._id
      ),
      waitForWebhookAfter(
        connection._id,
        beforeDelete
          ?.lastWebhookAt
      ),
    ]);

    await waitForTaskConvergence(
      appointment._id
    );

    acceptance = {
      success: true,
      provider,
      permissions,
      steps: [
        "preflight",
        "salonai_create_to_provider_create",
        "salonai_reschedule_to_provider_update",
        "provider_reschedule_to_salonai_update",
        "provider_delete_to_salonai_cancel",
        "post_cancel_outbox_converged",
      ],
      outbound: {
        create:
          true,
        reschedule:
          true,
      },
      inbound: {
        reschedule:
          true,
        cancel:
          true,
        verifiedWebhooks:
          2,
      },
    };
  } catch (error) {
    primaryError =
      error;
  }

  try {
    cleanupResult =
      await cleanup(
        state
      );
  } catch (error) {
    cleanupResult = {
      providerEventDeleted:
        Boolean(
          state
            .providerDeleted
        ),
      eventLinkDeleted:
        false,
      syncTaskDeleted:
        false,
      appointmentDeleted:
        false,
      customerDeleted:
        false,
      error:
        text(
          error?.message
        ),
    };

    if (!primaryError) {
      primaryError =
        acceptanceError(
          "CALENDAR_ACCEPTANCE_CLEANUP_FAILED",
          "Calendar appointment acceptance completed but cleanup failed."
        );
    }
  }

  if (primaryError) {
    primaryError.cleanup =
      cleanupResult;
    throw primaryError;
  }

  return {
    ...acceptance,
    cleanup:
      cleanupResult,
  };
}

try {
  const result =
    await runAcceptance();

  console.log(
    RESULT_BEGIN
  );
  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
  console.log(
    RESULT_END
  );
} catch (error) {
  console.error(
    RESULT_BEGIN
  );
  console.error(
    JSON.stringify(
      {
        success: false,
        code:
          error?.code ||
          "CALENDAR_APPOINTMENT_ACCEPTANCE_FAILED",
        message:
          text(
            error?.message ||
            "Calendar appointment synchronization acceptance failed."
          ),
        cleanup:
          error?.cleanup ||
          null,
      },
      null,
      2
    )
  );
  console.error(
    RESULT_END
  );
  process.exitCode = 1;
} finally {
  await mongoose
    .disconnect()
    .catch(
      () => undefined
    );
}
