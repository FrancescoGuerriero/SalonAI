import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import AiInferenceLog from "./AiInferenceLog.js";
import {
  NO_SHOW_INFERENCE_CAPABILITY,
  normaliseNoShowOutcome,
  observeNoShowOutcomeForAppointment,
} from "./noShowInferenceLedgerService.js";

const DEFAULT_LIMIT =
  500;
const MAX_LIMIT =
  5000;

function safeLimit(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return DEFAULT_LIMIT;
  }

  return Math.max(
    1,
    Math.min(
      MAX_LIMIT,
      Math.trunc(
        number
      )
    )
  );
}

export async function reconcileNoShowInferenceOutcomes({
  limit =
    DEFAULT_LIMIT,
  apply =
    false,
} = {}) {
  const safe =
    safeLimit(
      limit
    );

  const unresolved =
    await AiInferenceLog.find({
      capability:
        NO_SHOW_INFERENCE_CAPABILITY,
      entityType:
        "appointment",
      outcomeObservedAt:
        null,
      entityKey: {
        $ne:
          "",
      },
    })
      .sort({
        requestedAt:
          1,
      })
      .select(
        "entityKey"
      )
      .limit(
        safe
      )
      .lean();

  const appointmentKeys =
    Array.from(
      new Set(
        unresolved
          .map(
            (row) =>
              String(
                row.entityKey ||
                  ""
              ).trim()
          )
          .filter(
            (key) =>
              mongoose.isValidObjectId(
                key
              )
          )
      )
    );

  if (
    appointmentKeys.length ===
    0
  ) {
    return {
      applied:
        Boolean(
          apply
        ),
      scannedInferenceRecords:
        unresolved.length,
      candidateAppointments:
        0,
      terminalAppointments:
        0,
      matchedInferenceRecords:
        0,
      modifiedInferenceRecords:
        0,
    };
  }

  const appointments =
    await Appointment.find({
      _id: {
        $in:
          appointmentKeys,
      },
      status: {
        $in: [
          "completed",
          "cancelled",
          "no_show",
        ],
      },
    })
      .select(
        "_id status completedAt cancelledAt noShowAt updatedAt"
      )
      .lean();

  let matched =
    0;
  let modified =
    0;

  for (
    const appointment of
    appointments
  ) {
    const observation =
      normaliseNoShowOutcome(
        appointment
      );

    if (
      !observation
    ) {
      continue;
    }

    if (
      apply
    ) {
      const result =
        await observeNoShowOutcomeForAppointment(
          appointment
        );

      matched +=
        result.matched;
      modified +=
        result.modified;
    }
  }

  return {
    applied:
      Boolean(
        apply
      ),
    scannedInferenceRecords:
      unresolved.length,
    candidateAppointments:
      appointmentKeys.length,
    terminalAppointments:
      appointments.length,
    matchedInferenceRecords:
      matched,
    modifiedInferenceRecords:
      modified,
  };
}

export default {
  reconcileNoShowInferenceOutcomes,
};
