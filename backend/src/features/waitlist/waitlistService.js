import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import Customer from "../../models/Customer.js";
import Service from "../../models/Service.js";
import Stylist from "../../models/Stylist.js";
import WaitlistEntry, {
  WAITLIST_STATUSES,
  WAITLIST_TIME_PREFERENCES,
} from "./WaitlistEntry.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import {
  paginationFromQuery,
  paginationResult,
} from "../../shared/pagination.js";
import { userId } from "../../shared/modelHelpers.js";

const ACTIVE_WAITLIST_STATUSES = [
  "waiting",
  "notified",
  "accepted",
];

const CONVERTIBLE_WAITLIST_STATUSES = [
  "waiting",
  "notified",
  "accepted",
];

const ACTIVE_APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
];

const ALLOWED_STATUS_TRANSITIONS = {
  waiting: [
    "notified",
    "accepted",
    "cancelled",
    "expired",
  ],

  notified: [
    "waiting",
    "accepted",
    "declined",
    "cancelled",
    "expired",
  ],

  accepted: [
    "waiting",
    "booked",
    "declined",
    "cancelled",
    "expired",
  ],

  declined: [
    "waiting",
    "cancelled",
  ],

  expired: [
    "waiting",
    "cancelled",
  ],

  cancelled: [
    "waiting",
  ],

  booked: [],
};

function serviceError(
  message,
  statusCode = 500,
  details = null
) {
  const error =
    createServiceError(
      message,
      statusCode
    );

  if (details) {
    error.details =
      details;
  }

  return error;
}

function text(value) {
  return String(
    value ?? ""
  )
    .trim()
    .replace(/\s+/g, " ");
}

function objectId(
  value,
  fieldName
) {
  const id =
    value?._id
      ? String(value._id)
      : text(value);

  if (
    !mongoose.isValidObjectId(
      id
    )
  ) {
    throw serviceError(
      `${fieldName} must be a valid identifier.`,
      400,
      {
        field:
          fieldName,
      }
    );
  }

  return id;
}

function asBoolean(value) {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  return [
    "1",
    "true",
    "yes",
    "on",
  ].includes(
    text(value)
      .toLowerCase()
  );
}

function numberBetween(
  value,
  minimum,
  maximum,
  fallback
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      parsed
    )
  );
}

function parseDate(
  value,
  fieldName,
  {
    allowNull = true,
    endOfDay = false,
  } = {}
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    if (allowNull) {
      return null;
    }

    throw serviceError(
      `${fieldName} is required.`,
      400,
      {
        field:
          fieldName,
      }
    );
  }

  let date;

  if (
    typeof value ===
      "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    const [
      year,
      month,
      day,
    ] = value
      .split("-")
      .map(Number);

    date =
      new Date(
        year,
        month - 1,
        day,
        endOfDay ? 23 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 999 : 0
      );
  } else {
    date =
      new Date(value);

    if (
      !Number.isNaN(
        date.getTime()
      ) &&
      endOfDay
    ) {
      date.setHours(
        23,
        59,
        59,
        999
      );
    }
  }

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw serviceError(
      `${fieldName} is invalid.`,
      400,
      {
        field:
          fieldName,
      }
    );
  }

  return date;
}

function dateKey(value) {
  const date =
    new Date(value);

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
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function preferredDates(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return [];
  }

  const values =
    Array.isArray(value)
      ? value
      : [value];

  const unique =
    new Map();

  values.forEach(
    (
      item,
      index
    ) => {
      const date =
        parseDate(
          item,
          `preferredDates[${index}]`,
          {
            allowNull:
              false,
          }
        );

      unique.set(
        dateKey(date),
        date
      );
    }
  );

  return [
    ...unique.values(),
  ].sort(
    (
      left,
      right
    ) =>
      left.getTime() -
      right.getTime()
  );
}

function normaliseTime(
  value,
  fieldName,
  allowEmpty = true
) {
  const result =
    text(value);

  if (
    !result &&
    allowEmpty
  ) {
    return "";
  }

  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(
      result
    )
  ) {
    throw serviceError(
      `${fieldName} must use HH:mm format.`,
      400,
      {
        field:
          fieldName,
      }
    );
  }

  return result;
}

function timeMinutes(
  value
) {
  const [
    hours,
    minutes,
  ] = normaliseTime(
    value,
    "time",
    false
  )
    .split(":")
    .map(Number);

  return (
    hours * 60 +
    minutes
  );
}

function combineDateAndTime(
  dateValue,
  timeValue
) {
  const time =
    normaliseTime(
      timeValue,
      "appointmentTime",
      false
    );

  const [
    hours,
    minutes,
  ] = time
    .split(":")
    .map(Number);

  let date;

  if (
    typeof dateValue ===
      "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      dateValue
    )
  ) {
    const [
      year,
      month,
      day,
    ] = dateValue
      .split("-")
      .map(Number);

    date =
      new Date(
        year,
        month - 1,
        day,
        hours,
        minutes,
        0,
        0
      );
  } else {
    date =
      new Date(
        dateValue
      );

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      date.setHours(
        hours,
        minutes,
        0,
        0
      );
    }
  }

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw serviceError(
      "The appointment date is invalid.",
      400,
      {
        field:
          "appointmentDate",
      }
    );
  }

  return date;
}

function timePreferenceMatches(
  preference,
  appointmentTime
) {
  if (
    !preference ||
    preference === "any"
  ) {
    return true;
  }

  const minutes =
    timeMinutes(
      appointmentTime
    );

  if (
    preference ===
    "morning"
  ) {
    return (
      minutes <
      12 * 60
    );
  }

  if (
    preference ===
    "afternoon"
  ) {
    return (
      minutes >=
        12 * 60 &&
      minutes <
        17 * 60
    );
  }

  if (
    preference ===
    "evening"
  ) {
    return (
      minutes >=
      17 * 60
    );
  }

  return true;
}

function evaluateSlot(
  entry,
  {
    stylist = null,
    date = null,
    time = "",
  } = {}
) {
  let matches =
    true;

  let score =
    Number(
      entry.priority
    ) || 0;

  const reasons = [];

  const preferredStylist =
    entry.stylist?._id
      ? String(
          entry.stylist._id
        )
      : entry.stylist
        ? String(
            entry.stylist
          )
        : "";

  const requestedStylist =
    stylist
      ? String(stylist)
      : "";

  if (
    preferredStylist &&
    requestedStylist &&
    preferredStylist !==
      requestedStylist
  ) {
    matches =
      false;

    reasons.push(
      "Preferred stylist does not match."
    );
  } else if (
    preferredStylist &&
    requestedStylist
  ) {
    score += 30;

    reasons.push(
      "Preferred stylist matches."
    );
  } else if (
    preferredStylist
  ) {
    score += 10;

    reasons.push(
      "Customer requested a specific stylist."
    );
  } else {
    score += 5;

    reasons.push(
      "Customer accepts any stylist."
    );
  }

  if (date) {
    const target =
      new Date(date);

    const targetKey =
      dateKey(target);

    if (
      entry.dateRangeStart &&
      target <
        new Date(
          entry.dateRangeStart
        )
    ) {
      matches =
        false;

      reasons.push(
        "Date is before the requested range."
      );
    }

    if (
      entry.dateRangeEnd &&
      target >
        new Date(
          entry.dateRangeEnd
        )
    ) {
      matches =
        false;

      reasons.push(
        "Date is after the requested range."
      );
    }

    if (
      entry.preferredDates
        ?.length
    ) {
      const exactMatch =
        entry.preferredDates
          .some(
            (
              preferred
            ) =>
              dateKey(
                preferred
              ) ===
              targetKey
          );

      if (exactMatch) {
        score += 30;

        reasons.push(
          "Preferred date matches."
        );
      } else {
        matches =
          false;

        reasons.push(
          "Date is not in the preferred-date list."
        );
      }
    } else {
      score += 5;

      reasons.push(
        "Customer accepts any date in the requested range."
      );
    }
  }

  if (time) {
    const minutes =
      timeMinutes(time);

    if (
      !timePreferenceMatches(
        entry.timePreference,
        time
      )
    ) {
      matches =
        false;

      reasons.push(
        "Time does not match the preferred time of day."
      );
    } else {
      score += 15;

      reasons.push(
        "Preferred time of day matches."
      );
    }

    if (
      entry.earliestTime &&
      minutes <
        timeMinutes(
          entry.earliestTime
        )
    ) {
      matches =
        false;

      reasons.push(
        "Time is earlier than requested."
      );
    }

    if (
      entry.latestTime &&
      minutes >
        timeMinutes(
          entry.latestTime
        )
    ) {
      matches =
        false;

      reasons.push(
        "Time is later than requested."
      );
    }
  }

  return {
    matches,
    score,
    reasons,
  };
}

function populateEntry(
  query
) {
  return query
    .populate(
      "customer",
      "firstName lastName preferredName email phone alternativePhone status communicationPreferences bookingPreferences"
    )
    .populate(
      "service",
      "name category price duration active"
    )
    .populate(
      "stylist",
      "name firstName lastName email phone active"
    )
    .populate(
      "convertedAppointment",
      "appointmentDate appointmentTime startsAt endsAt duration status totalPrice paymentStatus"
    )
    .populate(
      "createdBy",
      "name email role"
    )
    .populate(
      "updatedBy",
      "name email role"
    );
}

async function loadBookableResources({
  serviceId,
  stylistId = null,
  session = null,
}) {
  const serviceQuery =
    Service.findById(
      serviceId
    );

  const stylistQuery =
    stylistId
      ? Stylist.findById(
          stylistId
        )
      : null;

  if (session) {
    serviceQuery.session(
      session
    );

    stylistQuery?.session(
      session
    );
  }

  const [
    service,
    stylist,
  ] = await Promise.all([
    serviceQuery,
    stylistQuery,
  ]);

  if (
    !service ||
    service.active ===
      false
  ) {
    throw serviceError(
      "The selected service was not found or is inactive.",
      404
    );
  }

  if (
    stylistId &&
    (
      !stylist ||
      stylist.active ===
        false
    )
  ) {
    throw serviceError(
      "The selected stylist was not found or is inactive.",
      404
    );
  }

  return {
    service,
    stylist,
  };
}

async function loadRelatedRecords({
  customerId,
  serviceId,
  stylistId = null,
  session = null,
}) {
  const customerQuery =
    Customer.findById(
      customerId
    );

  if (session) {
    customerQuery.session(
      session
    );
  }

  const [
    customer,
    resources,
  ] = await Promise.all([
    customerQuery,

    loadBookableResources({
      serviceId,
      stylistId,
      session,
    }),
  ]);

  if (
    !customer ||
    [
      "archived",
      "deleted",
    ].includes(
      customer.status
    )
  ) {
    throw serviceError(
      "The selected customer was not found or is unavailable.",
      404
    );
  }

  return {
    customer,
    ...resources,
  };
}

async function findAppointmentConflict({
  stylistId,
  startsAt,
  endsAt,
  session = null,
}) {
  const query =
    Appointment.findOne({
      stylist:
        stylistId,

      status: {
        $in:
          ACTIVE_APPOINTMENT_STATUSES,
      },

      startsAt: {
        $lt:
          endsAt,
      },

      endsAt: {
        $gt:
          startsAt,
      },
    })
      .select(
        "customer service stylist appointmentDate appointmentTime startsAt endsAt duration status"
      )
      .populate(
        "customer",
        "firstName lastName preferredName"
      )
      .populate(
        "service",
        "name duration"
      )
      .populate(
        "stylist",
        "name firstName lastName"
      );

  if (session) {
    query.session(
      session
    );
  }

  return query.lean();
}

function assertTransition(
  currentStatus,
  nextStatus
) {
  if (
    !WAITLIST_STATUSES.includes(
      nextStatus
    )
  ) {
    throw serviceError(
      "The waiting-list status is invalid.",
      400
    );
  }

  if (
    currentStatus ===
    nextStatus
  ) {
    return;
  }

  const allowed =
    ALLOWED_STATUS_TRANSITIONS[
      currentStatus
    ] || [];

  if (
    !allowed.includes(
      nextStatus
    )
  ) {
    throw serviceError(
      `A waiting-list entry cannot move from ${currentStatus} to ${nextStatus}.`,
      409,
      {
        currentStatus,
        nextStatus,

        allowedStatuses:
          allowed,
      }
    );
  }
}

export async function expireStaleEntries(
  now = new Date()
) {
  const staleEntries =
    await WaitlistEntry.find({
      status: {
        $in:
          ACTIVE_WAITLIST_STATUSES,
      },

      expiresAt: {
        $ne: null,
        $lte: now,
      },
    })
      .select(
        "_id status"
      )
      .lean();

  if (
    !staleEntries.length
  ) {
    return {
      expired: 0,
    };
  }

  const result =
    await WaitlistEntry.bulkWrite(
      staleEntries.map(
        (
          entry
        ) => ({
          updateOne: {
            filter: {
              _id:
                entry._id,

              status:
                entry.status,
            },

            update: {
              $set: {
                status:
                  "expired",

                expiredAt:
                  now,

                updatedAt:
                  now,
              },

              $push: {
                statusHistory: {
                  previousStatus:
                    entry.status,

                  status:
                    "expired",

                  changedAt:
                    now,

                  changedBy:
                    null,

                  reason:
                    "Waiting-list entry expired automatically.",
                },
              },
            },
          },
        })
      ),
      {
        ordered:
          false,
      }
    );

  return {
    expired:
      result.modifiedCount ||
      0,
  };
}

export async function createEntry(
  payload = {},
  user = null
) {
  const customerId =
    objectId(
      payload.customer ||
        payload.customerId,
      "customer"
    );

  const serviceId =
    objectId(
      payload.service ||
        payload.serviceId,
      "service"
    );

  const stylistValue =
    payload.stylist ||
    payload.stylistId ||
    null;

  const stylistId =
    stylistValue
      ? objectId(
          stylistValue,
          "stylist"
        )
      : null;

  await loadRelatedRecords({
    customerId,
    serviceId,
    stylistId,
  });

  const duplicateFilter = {
    customer:
      customerId,

    service:
      serviceId,

    status: {
      $in:
        ACTIVE_WAITLIST_STATUSES,
    },

    ...(stylistId
      ? {
          stylist:
            stylistId,
        }
      : {
          $or: [
            {
              stylist:
                null,
            },
            {
              stylist: {
                $exists:
                  false,
              },
            },
          ],
        }),
  };

  const duplicate =
    await WaitlistEntry
      .findOne(
        duplicateFilter
      )
      .lean();

  if (duplicate) {
    throw serviceError(
      "This customer already has an active waiting-list entry for the selected service and stylist preference.",
      409,
      {
        existingEntryId:
          String(
            duplicate._id
          ),
      }
    );
  }

  const timePreference =
    text(
      payload.timePreference ||
        "any"
    ).toLowerCase();

  if (
    !WAITLIST_TIME_PREFERENCES
      .includes(
        timePreference
      )
  ) {
    throw serviceError(
      "Time preference must be morning, afternoon, evening or any.",
      400
    );
  }

  const actorId =
    userId(user) ||
    null;

  const entry =
    await WaitlistEntry.create({
      customer:
        customerId,

      service:
        serviceId,

      stylist:
        stylistId,

      preferredDates:
        preferredDates(
          payload.preferredDates
        ),

      dateRangeStart:
        parseDate(
          payload.dateRangeStart,
          "dateRangeStart"
        ),

      dateRangeEnd:
        parseDate(
          payload.dateRangeEnd,
          "dateRangeEnd",
          {
            endOfDay:
              true,
          }
        ),

      timePreference,

      earliestTime:
        normaliseTime(
          payload.earliestTime,
          "earliestTime"
        ),

      latestTime:
        normaliseTime(
          payload.latestTime,
          "latestTime"
        ),

      priority:
        numberBetween(
          payload.priority,
          -100,
          100,
          0
        ),

      notes:
        text(
          payload.notes
        ),

      preferredContactChannel:
        text(
          payload.preferredContactChannel ||
            "email"
        ).toLowerCase(),

      responseDeadline:
        parseDate(
          payload.responseDeadline,
          "responseDeadline"
        ),

      expiresAt:
        parseDate(
          payload.expiresAt,
          "expiresAt",
          {
            endOfDay:
              true,
          }
        ),

      createdBy:
        actorId,

      updatedBy:
        actorId,

      statusHistory: [
        {
          previousStatus:
            null,

          status:
            "waiting",

          changedAt:
            new Date(),

          changedBy:
            actorId,

          reason:
            "Waiting-list entry created.",
        },
      ],
    });

  return populateEntry(
    WaitlistEntry.findById(
      entry._id
    )
  ).lean();
}

export async function getEntry(
  id
) {
  const entry =
    await populateEntry(
      WaitlistEntry.findById(
        objectId(
          id,
          "waitlistEntry"
        )
      )
    ).lean();

  return assertFound(
    entry,
    "Waiting-list entry not found."
  );
}

export async function listEntries(
  query = {}
) {
  await expireStaleEntries();

  const {
    page,
    limit,
    skip,
  } = paginationFromQuery(
    query
  );

  const match = {};

  if (query.status) {
    const statuses =
      String(
        query.status
      )
        .split(",")
        .map(
          (
            status
          ) =>
            status.trim()
        )
        .filter(Boolean);

    statuses.forEach(
      (
        status
      ) => {
        if (
          !WAITLIST_STATUSES
            .includes(
              status
            )
        ) {
          throw serviceError(
            `Unknown waiting-list status: ${status}.`,
            400
          );
        }
      }
    );

    match.status =
      statuses.length === 1
        ? statuses[0]
        : {
            $in:
              statuses,
          };
  }

  for (
    const field of [
      "service",
      "stylist",
      "customer",
    ]
  ) {
    if (
      query[field]
    ) {
      match[field] =
        objectId(
          query[field],
          field
        );
    }
  }

  if (
    query.active ===
    "true"
  ) {
    match.status = {
      $in:
        ACTIVE_WAITLIST_STATUSES,
    };
  }

  const search =
    text(
      query.search ||
        query.q
    );

  if (search) {
    const escaped =
      search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    const pattern =
      new RegExp(
        escaped,
        "i"
      );

    const [
      customerIds,
      serviceIds,
      stylistIds,
    ] = await Promise.all([
      Customer.find({
        $or: [
          {
            firstName:
              pattern,
          },
          {
            lastName:
              pattern,
          },
          {
            preferredName:
              pattern,
          },
          {
            email:
              pattern,
          },
          {
            phone:
              pattern,
          },
        ],
      }).distinct("_id"),

      Service.find({
        $or: [
          {
            name:
              pattern,
          },
          {
            category:
              pattern,
          },
        ],
      }).distinct("_id"),

      Stylist.find({
        $or: [
          {
            name:
              pattern,
          },
          {
            firstName:
              pattern,
          },
          {
            lastName:
              pattern,
          },
          {
            email:
              pattern,
          },
        ],
      }).distinct("_id"),
    ]);

    match.$or = [
      {
        customer: {
          $in:
            customerIds,
        },
      },
      {
        service: {
          $in:
            serviceIds,
        },
      },
      {
        stylist: {
          $in:
            stylistIds,
        },
      },
      {
        notes:
          pattern,
      },
    ];
  }

  const sort =
    query.sort ===
    "newest"
      ? {
          createdAt:
            -1,
        }
      : query.sort ===
          "oldest"
        ? {
            createdAt:
              1,
          }
        : {
            priority:
              -1,

            createdAt:
              1,
          };

  const [
    items,
    total,
  ] = await Promise.all([
    populateEntry(
      WaitlistEntry.find(
        match
      )
    )
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),

    WaitlistEntry
      .countDocuments(
        match
      ),
  ]);

  return {
    items,

    pagination:
      paginationResult(
        page,
        limit,
        total
      ),
  };
}

export async function getSummary() {
  await expireStaleEntries();

  const [
    counts,
    overdueResponses,
    expiringSoon,
  ] = await Promise.all([
    WaitlistEntry.aggregate([
      {
        $group: {
          _id:
            "$status",

          count: {
            $sum: 1,
          },
        },
      },
    ]),

    WaitlistEntry
      .countDocuments({
        status:
          "notified",

        responseDeadline: {
          $ne:
            null,

          $lt:
            new Date(),
        },
      }),

    WaitlistEntry
      .countDocuments({
        status: {
          $in:
            ACTIVE_WAITLIST_STATUSES,
        },

        expiresAt: {
          $gt:
            new Date(),

          $lte:
            new Date(
              Date.now() +
                7 *
                  24 *
                  60 *
                  60 *
                  1000
            ),
        },
      }),
  ]);

  const byStatus =
    Object.fromEntries(
      WAITLIST_STATUSES.map(
        (
          status
        ) => [
          status,
          0,
        ]
      )
    );

  counts.forEach(
    (
      item
    ) => {
      byStatus[
        item._id
      ] =
        item.count;
    }
  );

  return {
    total:
      Object.values(
        byStatus
      ).reduce(
        (
          sum,
          count
        ) =>
          sum +
          count,
        0
      ),

    active:
      ACTIVE_WAITLIST_STATUSES
        .reduce(
          (
            sum,
            status
          ) =>
            sum +
            (
              byStatus[
                status
              ] ||
              0
            ),
          0
        ),

    byStatus,
    overdueResponses,
    expiringSoon,
  };
}

export async function updateEntry(
  id,
  payload = {},
  user = null
) {
  const entry =
    assertFound(
      await WaitlistEntry
        .findById(
          objectId(
            id,
            "waitlistEntry"
          )
        ),

      "Waiting-list entry not found."
    );

  if (
    entry.status ===
      "booked" &&
    !asBoolean(
      payload.force
    )
  ) {
    throw serviceError(
      "A booked waiting-list entry cannot be edited without an explicit override.",
      409
    );
  }

  const actorId =
    userId(user) ||
    null;

  let nextServiceId =
    String(
      entry.service
    );

  let nextStylistId =
    entry.stylist
      ? String(
          entry.stylist
        )
      : null;

  if (
    payload.service !==
      undefined ||
    payload.serviceId !==
      undefined
  ) {
    nextServiceId =
      objectId(
        payload.service ||
          payload.serviceId,
        "service"
      );
  }

  if (
    payload.stylist !==
      undefined ||
    payload.stylistId !==
      undefined
  ) {
    const value =
      payload.stylist ??
      payload.stylistId;

    nextStylistId =
      value
        ? objectId(
            value,
            "stylist"
          )
        : null;
  }

  if (
    nextServiceId !==
      String(
        entry.service
      ) ||
    nextStylistId !==
      (
        entry.stylist
          ? String(
              entry.stylist
            )
          : null
      )
  ) {
    await loadRelatedRecords({
      customerId:
        entry.customer,

      serviceId:
        nextServiceId,

      stylistId:
        nextStylistId,
    });

    entry.service =
      nextServiceId;

    entry.stylist =
      nextStylistId;
  }

  if (
    payload.preferredDates !==
    undefined
  ) {
    entry.preferredDates =
      preferredDates(
        payload.preferredDates
      );
  }

  if (
    payload.dateRangeStart !==
    undefined
  ) {
    entry.dateRangeStart =
      parseDate(
        payload.dateRangeStart,
        "dateRangeStart"
      );
  }

  if (
    payload.dateRangeEnd !==
    undefined
  ) {
    entry.dateRangeEnd =
      parseDate(
        payload.dateRangeEnd,
        "dateRangeEnd",
        {
          endOfDay:
            true,
        }
      );
  }

  if (
    payload.timePreference !==
    undefined
  ) {
    const preference =
      text(
        payload.timePreference
      ).toLowerCase();

    if (
      !WAITLIST_TIME_PREFERENCES
        .includes(
          preference
        )
    ) {
      throw serviceError(
        "Time preference must be morning, afternoon, evening or any.",
        400
      );
    }

    entry.timePreference =
      preference;
  }

  if (
    payload.earliestTime !==
    undefined
  ) {
    entry.earliestTime =
      normaliseTime(
        payload.earliestTime,
        "earliestTime"
      );
  }

  if (
    payload.latestTime !==
    undefined
  ) {
    entry.latestTime =
      normaliseTime(
        payload.latestTime,
        "latestTime"
      );
  }

  if (
    payload.priority !==
    undefined
  ) {
    entry.priority =
      numberBetween(
        payload.priority,
        -100,
        100,
        entry.priority
      );
  }

  if (
    payload.notes !==
    undefined
  ) {
    entry.notes =
      text(
        payload.notes
      );
  }

  if (
    payload.preferredContactChannel !==
    undefined
  ) {
    entry.preferredContactChannel =
      text(
        payload.preferredContactChannel
      ).toLowerCase();
  }

  if (
    payload.responseDeadline !==
    undefined
  ) {
    entry.responseDeadline =
      parseDate(
        payload.responseDeadline,
        "responseDeadline"
      );
  }

  if (
    payload.expiresAt !==
    undefined
  ) {
    entry.expiresAt =
      parseDate(
        payload.expiresAt,
        "expiresAt",
        {
          endOfDay:
            true,
        }
      );
  }

  if (
    payload.status !==
    undefined
  ) {
    const nextStatus =
      text(
        payload.status
      ).toLowerCase();

    assertTransition(
      entry.status,
      nextStatus
    );

    entry.changeStatus(
      nextStatus,
      {
        user:
          actorId,

        reason:
          text(
            payload.statusReason ||
              payload.reason
          ),
      }
    );
  }

  entry.updatedBy =
    actorId ||
    entry.updatedBy;

  await entry.save();

  return populateEntry(
    WaitlistEntry.findById(
      entry._id
    )
  ).lean();
}

export async function matchAvailableSlot({
  service,
  serviceId,
  stylist,
  stylistId,
  date,
  appointmentDate,
  time,
  appointmentTime,
  limit = 20,
} = {}) {
  await expireStaleEntries();

  const resolvedServiceId =
    objectId(
      service ||
        serviceId,
      "service"
    );

  const stylistValue =
    stylist ||
    stylistId ||
    null;

  const resolvedStylistId =
    stylistValue
      ? objectId(
          stylistValue,
          "stylist"
        )
      : null;

  const dateValue =
    appointmentDate ||
    date ||
    null;

  const timeValue =
    appointmentTime ||
    time ||
    "";

  const targetDate =
    dateValue
      ? parseDate(
          dateValue,
          "date",
          {
            allowNull:
              false,
          }
        )
      : null;

  const targetTime =
    timeValue
      ? normaliseTime(
          timeValue,
          "time",
          false
        )
      : "";

  await loadBookableResources({
    serviceId:
      resolvedServiceId,

    stylistId:
      resolvedStylistId,
  });

  const match = {
    service:
      resolvedServiceId,

    status: {
      $in:
        ACTIVE_WAITLIST_STATUSES,
    },

    $or: [
      {
        expiresAt:
          null,
      },
      {
        expiresAt: {
          $gt:
            new Date(),
        },
      },
    ],
  };

  if (
    resolvedStylistId
  ) {
    match.$and = [
      {
        $or: [
          {
            stylist:
              resolvedStylistId,
          },
          {
            stylist:
              null,
          },
          {
            stylist: {
              $exists:
                false,
            },
          },
        ],
      },
    ];
  }

  const entries =
    await populateEntry(
      WaitlistEntry.find(
        match
      )
    )
      .sort({
        priority:
          -1,

        createdAt:
          1,
      })
      .limit(
        Math.min(
          Math.max(
            Number(limit) ||
              20,
            1
          ),
          100
        )
      )
      .lean();

  return entries
    .map(
      (
        entry
      ) => {
        const evaluation =
          evaluateSlot(
            entry,
            {
              stylist:
                resolvedStylistId,

              date:
                targetDate,

              time:
                targetTime,
            }
          );

        return {
          ...entry,

          slotMatches:
            evaluation.matches,

          matchScore:
            evaluation.score,

          matchReasons:
            evaluation.reasons,
        };
      }
    )
    .filter(
      (
        entry
      ) =>
        entry.slotMatches
    )
    .sort(
      (
        left,
        right
      ) =>
        right.matchScore -
          left.matchScore ||
        new Date(
          left.createdAt
        ) -
          new Date(
            right.createdAt
          )
    );
}

export async function convertToAppointment(
  id,
  payload = {},
  user = null
) {
  const entryId =
    objectId(
      id,
      "waitlistEntry"
    );

  const dateValue =
    payload.appointmentDate ||
    payload.date;

  const timeValue =
    payload.appointmentTime ||
    payload.time;

  if (
    !dateValue ||
    !timeValue
  ) {
    throw serviceError(
      "Appointment date and time are required.",
      400
    );
  }

  const existingEntry =
    assertFound(
      await WaitlistEntry
        .findById(
          entryId
        ),

      "Waiting-list entry not found."
    );

  if (
    !CONVERTIBLE_WAITLIST_STATUSES
      .includes(
        existingEntry.status
      )
  ) {
    throw serviceError(
      "Only waiting, notified or accepted entries can be converted.",
      409
    );
  }

  const stylistValue =
    payload.stylist ||
    payload.stylistId ||
    existingEntry.stylist;

  if (
    !stylistValue
  ) {
    throw serviceError(
      "A stylist must be selected before converting this waiting-list entry.",
      400
    );
  }

  const stylistId =
    objectId(
      stylistValue,
      "stylist"
    );

  const {
    customer,
    service,
    stylist,
  } = await loadRelatedRecords({
    customerId:
      existingEntry.customer,

    serviceId:
      existingEntry.service,

    stylistId,
  });

  const appointmentTime =
    normaliseTime(
      timeValue,
      "appointmentTime",
      false
    );

  const startsAt =
    combineDateAndTime(
      dateValue,
      appointmentTime
    );

  const duration =
    numberBetween(
      payload.duration ??
        service.duration,
      1,
      1440,
      Number(
        service.duration
      ) || 60
    );

  const endsAt =
    new Date(
      startsAt.getTime() +
        duration *
          60000
    );

  if (
    startsAt <=
    new Date()
  ) {
    throw serviceError(
      "A waiting-list entry cannot be converted into a past appointment.",
      409
    );
  }

  const slotEvaluation =
    evaluateSlot(
      existingEntry,
      {
        stylist:
          stylistId,

        date:
          startsAt,

        time:
          appointmentTime,
      }
    );

  if (
    !slotEvaluation.matches &&
    !asBoolean(
      payload.force
    )
  ) {
    throw serviceError(
      "The selected appointment does not match this customer's waiting-list preferences.",
      409,
      {
        reasons:
          slotEvaluation.reasons,
      }
    );
  }

  const conflict =
    await findAppointmentConflict({
      stylistId:
        stylist._id,

      startsAt,
      endsAt,
    });

  if (conflict) {
    throw serviceError(
      "The selected stylist already has an overlapping appointment.",
      409,
      {
        conflict,
      }
    );
  }

  const status =
    text(
      payload.status ||
        "pending"
    ).toLowerCase();

  if (
    ![
      "pending",
      "confirmed",
    ].includes(status)
  ) {
    throw serviceError(
      "A converted waiting-list appointment must start as pending or confirmed.",
      400
    );
  }

  const actorId =
    userId(user) ||
    null;

  const session =
    await mongoose.startSession();

  let appointmentId;

  try {
    await session.withTransaction(
      async () => {
        const entry =
          assertFound(
            await WaitlistEntry
              .findById(
                entryId
              )
              .session(
                session
              ),

            "Waiting-list entry not found."
          );

        if (
          !CONVERTIBLE_WAITLIST_STATUSES
            .includes(
              entry.status
            )
        ) {
          throw serviceError(
            "This waiting-list entry has already been processed.",
            409
          );
        }

        const transactionConflict =
          await findAppointmentConflict({
            stylistId:
              stylist._id,

            startsAt,
            endsAt,
            session,
          });

        if (
          transactionConflict
        ) {
          throw serviceError(
            "The selected stylist already has an overlapping appointment.",
            409,
            {
              conflictId:
                String(
                  transactionConflict._id
                ),
            }
          );
        }

        const [
          appointment,
        ] = await Appointment.create(
          [
            {
              customer:
                customer._id,

              service:
                service._id,

              stylist:
                stylist._id,

              appointmentDate:
                startsAt,

              appointmentTime,

              startsAt,
              endsAt,
              duration,

              totalPrice:
                Math.max(
                  0,
                  Number(
                    payload.totalPrice ??
                      payload.price ??
                      service.price ??
                      0
                  ) || 0
                ),

              discount:
                Math.max(
                  0,
                  Number(
                    payload.discount
                  ) || 0
                ),

              tax:
                Math.max(
                  0,
                  Number(
                    payload.tax
                  ) || 0
                ),

              status,

              notes:
                text(
                  payload.notes ||
                    entry.notes
                ),

              createdBy:
                actorId,

              updatedBy:
                actorId,
            },
          ],
          {
            session,
          }
        );

        entry.convertedAppointment =
          appointment._id;

        entry.changeStatus(
          "booked",
          {
            user:
              actorId,

            reason:
              text(
                payload.reason ||
                  "Converted into an appointment."
              ),
          }
        );

        entry.updatedBy =
          actorId ||
          entry.updatedBy;

        await entry.save({
          session,
        });

        appointmentId =
          appointment._id;
      }
    );
  } finally {
    await session.endSession();
  }

  const [
    entry,
    appointment,
  ] = await Promise.all([
    populateEntry(
      WaitlistEntry.findById(
        entryId
      )
    ).lean(),

    Appointment.findById(
      appointmentId
    )
      .populate(
        "customer",
        "firstName lastName preferredName email phone"
      )
      .populate(
        "service",
        "name category price duration"
      )
      .populate(
        "stylist",
        "name firstName lastName email phone"
      )
      .lean(),
  ]);

  return {
    entry,
    appointment,
  };
}

export async function deleteEntry(
  id,
  options = {}
) {
  const entry =
    assertFound(
      await WaitlistEntry
        .findById(
          objectId(
            id,
            "waitlistEntry"
          )
        ),

      "Waiting-list entry not found."
    );

  if (
    entry.status ===
      "booked" &&
    !asBoolean(
      options.force
    )
  ) {
    throw serviceError(
      "A booked waiting-list entry cannot be deleted because it is linked to an appointment.",
      409,
      {
        convertedAppointment:
          entry.convertedAppointment
            ? String(
                entry.convertedAppointment
              )
            : null,
      }
    );
  }

  await entry.deleteOne();

  return {
    message:
      "Waiting-list entry deleted.",

    id:
      String(
        entry._id
      ),
  };
}

export default {
  expireStaleEntries,
  createEntry,
  getEntry,
  listEntries,
  getSummary,
  updateEntry,
  matchAvailableSlot,
  convertToAppointment,
  deleteEntry,
};