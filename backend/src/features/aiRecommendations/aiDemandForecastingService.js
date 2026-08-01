import Appointment from "../../models/Appointment.js";
import Stylist from "../../models/Stylist.js";
import StaffShift from "../staffRota/StaffShift.js";
import {
  forecastAppointmentDemand,
} from "../../services/aiMicroserviceClient.js";

const TIMEZONE = "Europe/London";
const CURRENCY = "GBP";
const DAY_MS = 86_400_000;

const ACTIVE_APPOINTMENT_STATUSES = new Set([
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
]);

const FORECAST_APPOINTMENT_STATUSES = new Set([
  ...ACTIVE_APPOINTMENT_STATUSES,
  "completed",
  "cancelled",
  "no_show",
]);

const ACTIVE_SHIFT_STATUSES = [
  "published",
  "completed",
];

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const DEFAULT_DEMAND_FORECAST_OPTIONS =
  Object.freeze({
    lookbackDays: 180,
    horizonDays: 28,
    minimumHistoryDays: 56,
    recentWindowDays: 28,
    baselineWindowDays: 84,
    confidenceLevel: 0.9,
    targetUtilisation: 0.8,
    appointmentsPerStaffHour: 0.75,
    staffShiftHours: 8,
    includeRevenueForecast: true,
  });

export class AiDemandForecastingError extends Error {
  constructor(
    message,
    {
      code = "AI_DEMAND_FORECASTING_ERROR",
      status = 400,
      details = null,
      cause = null,
    } = {}
  ) {
    super(message, {
      cause,
    });

    this.name = "AiDemandForecastingError";
    this.code = code;
    this.status = status;
    this.statusCode = status;
    this.details = details;
  }
}

function number(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function positiveNumber(value, fallback = 0) {
  return Math.max(
    0,
    number(value, fallback)
  );
}

function roundNumber(value, decimalPlaces = 2) {
  const multiplier =
    10 ** decimalPlaces;

  return (
    Math.round(
      (Number(value) || 0) *
        multiplier
    ) / multiplier
  );
}

function clampNumber(
  value,
  minimum,
  maximum,
  fallback
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
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

function clampInteger(
  value,
  minimum,
  maximum,
  fallback
) {
  return Math.round(
    clampNumber(
      value,
      minimum,
      maximum,
      fallback
    )
  );
}

function validDate(value) {
  if (!value) {
    return null;
  }

  const parsed =
    new Date(value);

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}

function entityId(value) {
  return String(
    value?._id ||
      value?.id ||
      value ||
      ""
  ).trim();
}

function serviceName(value) {
  return String(
    value?.name ||
      value?.title ||
      "Unknown service"
  )
    .trim()
    .slice(0, 200);
}

function dateParts(
  value,
  timeZone = TIMEZONE
) {
  const date =
    validDate(value);

  if (!date) {
    return null;
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }
    ).formatToParts(date);

  return Object.fromEntries(
    parts.map(
      (part) => [
        part.type,
        part.value,
      ]
    )
  );
}

function dateKey(value) {
  const parts =
    dateParts(value);

  if (!parts) {
    return "";
  }

  return [
    parts.year,
    parts.month,
    parts.day,
  ].join("-");
}

function weekdayIndex(value) {
  const parts =
    dateParts(value);

  if (!parts) {
    return -1;
  }

  return WEEKDAY_NAMES.indexOf(
    parts.weekday
  );
}

function hourOfDay(value) {
  const parts =
    dateParts(value);

  const hour =
    Number(parts?.hour);

  return Number.isFinite(hour)
    ? hour
    : 0;
}

function parseDateKey(
  value,
  fieldName = "asOfDate"
) {
  const text =
    String(value || "").trim();

  const match =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!match) {
    throw new AiDemandForecastingError(
      `${fieldName} must use YYYY-MM-DD format.`,
      {
        code:
          "INVALID_DEMAND_FORECAST_DATE",

        status: 400,

        details: {
          field: fieldName,
        },
      }
    );
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const probe =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        12
      )
    );

  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new AiDemandForecastingError(
      `${fieldName} must be a valid calendar date.`,
      {
        code:
          "INVALID_DEMAND_FORECAST_DATE",

        status: 400,

        details: {
          field: fieldName,
        },
      }
    );
  }

  return text;
}

function currentLondonDateKey(
  now = new Date()
) {
  return dateKey(now);
}

function shiftDateKey(
  value,
  days
) {
  const parsed =
    parseDateKey(
      value,
      "date"
    );

  const [
    year,
    month,
    day,
  ] = parsed
    .split("-")
    .map(Number);

  const shifted =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + Number(days),
        12
      )
    );

  return [
    shifted.getUTCFullYear(),

    String(
      shifted.getUTCMonth() + 1
    ).padStart(2, "0"),

    String(
      shifted.getUTCDate()
    ).padStart(2, "0"),
  ].join("-");
}

function zonedDateTimeToUtc(
  dateKeyValue,
  {
    hour = 0,
    minute = 0,
    second = 0,
  } = {}
) {
  const [
    year,
    month,
    day,
  ] = parseDateKey(
    dateKeyValue,
    "date"
  )
    .split("-")
    .map(Number);

  const desiredTimestamp =
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second
    );

  let candidate =
    new Date(
      desiredTimestamp
    );

  for (
    let attempt = 0;
    attempt < 3;
    attempt += 1
  ) {
    const parts =
      dateParts(
        candidate,
        TIMEZONE
      );

    if (!parts) {
      break;
    }

    const representedTimestamp =
      Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
      );

    const difference =
      desiredTimestamp -
      representedTimestamp;

    if (difference === 0) {
      break;
    }

    candidate =
      new Date(
        candidate.getTime() +
          difference
      );
  }

  return candidate;
}

function londonDayBounds(
  dateKeyValue
) {
  const nextDateKey =
    shiftDateKey(
      dateKeyValue,
      1
    );

  return {
    start:
      zonedDateTimeToUtc(
        dateKeyValue
      ),

    end:
      zonedDateTimeToUtc(
        nextDateKey
      ),
  };
}

function appointmentStartsAt(
  appointment
) {
  const explicitStart =
    validDate(
      appointment?.startsAt
    );

  if (explicitStart) {
    return explicitStart;
  }

  const appointmentDate =
    validDate(
      appointment?.appointmentDate
    );

  if (!appointmentDate) {
    return null;
  }

  const localDateKey =
    dateKey(
      appointmentDate
    );

  const [
    hour = 0,
    minute = 0,
  ] = String(
    appointment?.appointmentTime ||
      "00:00"
  )
    .split(":")
    .map(Number);

  return zonedDateTimeToUtc(
    localDateKey,
    {
      hour:
        Number.isFinite(hour)
          ? hour
          : 0,

      minute:
        Number.isFinite(minute)
          ? minute
          : 0,
    }
  );
}

function appointmentRevenue(
  appointment
) {
  if (
    String(
      appointment?.status || ""
    ).toLowerCase() !==
    "completed"
  ) {
    return 0;
  }

  const paid =
    positiveNumber(
      appointment?.amountPaid
    );

  if (paid > 0) {
    return paid;
  }

  return positiveNumber(
    appointment?.finalPrice ??
      appointment?.totalPrice ??
      appointment?.service?.price
  );
}

function timeBucket(value) {
  const hour =
    hourOfDay(value);

  if (hour < 12) {
    return "morning";
  }

  if (hour < 17) {
    return "afternoon";
  }

  return "evening";
}

function emptyServiceObservation(
  serviceKey,
  name
) {
  return {
    service_key:
      serviceKey,

    service_name:
      name,

    booked_appointments: 0,

    completed_appointments: 0,

    cancelled_appointments: 0,

    no_show_appointments: 0,

    revenue: 0,
  };
}

function emptyTimeBucketObservation(
  bucket
) {
  return {
    bucket,

    booked_appointments: 0,

    completed_appointments: 0,

    cancelled_appointments: 0,

    no_show_appointments: 0,
  };
}

function emptyDailyObservation(
  businessDate
) {
  return {
    business_date:
      businessDate,

    booked_appointments: 0,

    completed_appointments: 0,

    cancelled_appointments: 0,

    no_show_appointments: 0,

    pending_appointments: 0,

    total_revenue: 0,

    available_staff_hours: 0,

    appointment_capacity: 0,

    services: [],

    time_buckets: [],
  };
}

function incrementStatus(
  target,
  status
) {
  if (status === "completed") {
    target.completed_appointments +=
      1;

    return;
  }

  if (status === "cancelled") {
    target.cancelled_appointments +=
      1;

    return;
  }

  if (status === "no_show") {
    target.no_show_appointments +=
      1;
  }
}

function scheduledShiftHours(
  shift,
  dayStart,
  dayEnd
) {
  const shiftStart =
    validDate(
      shift?.startsAt
    );

  const shiftEnd =
    validDate(
      shift?.endsAt
    );

  if (
    !shiftStart ||
    !shiftEnd ||
    shiftEnd <= shiftStart ||
    shiftStart >= dayEnd ||
    shiftEnd <= dayStart
  ) {
    return 0;
  }

  const overlapStart =
    new Date(
      Math.max(
        shiftStart.getTime(),
        dayStart.getTime()
      )
    );

  const overlapEnd =
    new Date(
      Math.min(
        shiftEnd.getTime(),
        dayEnd.getTime()
      )
    );

  const overlapMinutes =
    Math.max(
      0,
      (
        overlapEnd -
        overlapStart
      ) / 60_000
    );

  const totalMinutes =
    Math.max(
      1,
      (
        shiftEnd -
        shiftStart
      ) / 60_000
    );

  const allocatedBreakMinutes =
    positiveNumber(
      shift?.breakMinutes
    ) *
    (
      overlapMinutes /
      totalMinutes
    );

  return Math.max(
    0,
    (
      overlapMinutes -
      allocatedBreakMinutes
    ) / 60
  );
}

function workingHoursDuration(
  workingHour
) {
  if (
    !workingHour ||
    workingHour.available === false
  ) {
    return 0;
  }

  const startMatch =
    String(
      workingHour.start ||
        "09:00"
    ).match(
      /^(\d{1,2}):(\d{2})$/
    );

  const endMatch =
    String(
      workingHour.end ||
        "17:00"
    ).match(
      /^(\d{1,2}):(\d{2})$/
    );

  if (
    !startMatch ||
    !endMatch
  ) {
    return 0;
  }

  const startMinutes =
    Number(startMatch[1]) *
      60 +
    Number(startMatch[2]);

  const endMinutes =
    Number(endMatch[1]) *
      60 +
    Number(endMatch[2]);

  return Math.max(
    0,
    (
      endMinutes -
      startMinutes
    ) / 60
  );
}

function fallbackWorkingHoursForDate(
  businessDate,
  stylists
) {
  const probe =
    zonedDateTimeToUtc(
      businessDate,
      {
        hour: 12,
      }
    );

  const index =
    weekdayIndex(probe);

  const weekdayName =
    WEEKDAY_NAMES[index];

  if (!weekdayName) {
    return 0;
  }

  return stylists.reduce(
    (
      total,
      stylist
    ) => {
      const hours =
        Array.isArray(
          stylist?.workingHours
        )
          ? stylist.workingHours.find(
              (item) =>
                item?.day ===
                weekdayName
            )
          : null;

      return (
        total +
        workingHoursDuration(
          hours
        )
      );
    },
    0
  );
}

function normaliseBusinessDays(
  value,
  stylists = []
) {
  if (
    Array.isArray(value) &&
    value.length > 0
  ) {
    const result =
      Array.from(
        new Set(
          value
            .map(
              (item) =>
                Number.parseInt(
                  item,
                  10
                )
            )
            .filter(
              (item) =>
                Number.isInteger(
                  item
                ) &&
                item >= 0 &&
                item <= 6
            )
        )
      ).sort(
        (
          left,
          right
        ) =>
          left - right
      );

    if (result.length > 0) {
      return result;
    }
  }

  const derived =
    new Set();

  for (
    const stylist
    of stylists
  ) {
    for (
      const hours
      of stylist?.workingHours ||
        []
    ) {
      if (
        hours?.available === false ||
        workingHoursDuration(
          hours
        ) <= 0
      ) {
        continue;
      }

      const index =
        WEEKDAY_NAMES.indexOf(
          hours.day
        );

      if (index >= 0) {
        derived.add(index);
      }
    }
  }

  return derived.size > 0
    ? Array.from(
        derived
      ).sort(
        (
          left,
          right
        ) =>
          left - right
      )
    : [
        0,
        1,
        2,
        3,
        4,
        5,
      ];
}

function buildSettings(
  options,
  stylists
) {
  const lookbackDays =
    clampInteger(
      options.lookbackDays,
      28,
      365,
      DEFAULT_DEMAND_FORECAST_OPTIONS
        .lookbackDays
    );

  const baselineWindowDays =
    clampInteger(
      options.baselineWindowDays,
      28,
      Math.min(
        365,
        lookbackDays
      ),
      Math.min(
        DEFAULT_DEMAND_FORECAST_OPTIONS
          .baselineWindowDays,
        lookbackDays
      )
    );

  const recentWindowDays =
    clampInteger(
      options.recentWindowDays,
      7,
      Math.min(
        120,
        baselineWindowDays
      ),
      Math.min(
        DEFAULT_DEMAND_FORECAST_OPTIONS
          .recentWindowDays,
        baselineWindowDays
      )
    );

  return {
    lookbackDays,

    settings: {
      horizon_days:
        clampInteger(
          options.horizonDays,
          7,
          90,
          DEFAULT_DEMAND_FORECAST_OPTIONS
            .horizonDays
        ),

      minimum_history_days:
        clampInteger(
          options.minimumHistoryDays,
          14,
          Math.min(
            365,
            lookbackDays
          ),
          Math.min(
            DEFAULT_DEMAND_FORECAST_OPTIONS
              .minimumHistoryDays,
            lookbackDays
          )
        ),

      recent_window_days:
        recentWindowDays,

      baseline_window_days:
        baselineWindowDays,

      confidence_level:
        clampNumber(
          options.confidenceLevel,
          0.5,
          0.99,
          DEFAULT_DEMAND_FORECAST_OPTIONS
            .confidenceLevel
        ),

      target_utilisation:
        clampNumber(
          options.targetUtilisation,
          0.5,
          0.98,
          DEFAULT_DEMAND_FORECAST_OPTIONS
            .targetUtilisation
        ),

      appointments_per_staff_hour:
        clampNumber(
          options.appointmentsPerStaffHour,
          0.05,
          10,
          DEFAULT_DEMAND_FORECAST_OPTIONS
            .appointmentsPerStaffHour
        ),

      staff_shift_hours:
        clampNumber(
          options.staffShiftHours,
          1,
          24,
          DEFAULT_DEMAND_FORECAST_OPTIONS
            .staffShiftHours
        ),

      business_days:
        normaliseBusinessDays(
          options.businessDays,
          stylists
        ),

      include_revenue_forecast:
        options.includeRevenueForecast ===
        undefined
          ? DEFAULT_DEMAND_FORECAST_OPTIONS
              .includeRevenueForecast
          : Boolean(
              options
                .includeRevenueForecast
            ),

      currency:
        CURRENCY,

      timezone:
        TIMEZONE,
    },
  };
}

export function buildDemandForecastPayload({
  appointments = [],
  shifts = [],
  stylists = [],
  asOfDate,
  ...options
} = {}) {
  const asOfDateKey =
    asOfDate
      ? parseDateKey(
          asOfDate
        )
      : currentLondonDateKey();

  const {
    lookbackDays,
    settings,
  } = buildSettings(
    options,
    stylists
  );

  const firstDateKey =
    shiftDateKey(
      asOfDateKey,
      -(lookbackDays - 1)
    );

  const observationsByDate =
    new Map();

  for (
    let index = 0;
    index < lookbackDays;
    index += 1
  ) {
    const businessDate =
      shiftDateKey(
        firstDateKey,
        index
      );

    observationsByDate.set(
      businessDate,
      emptyDailyObservation(
        businessDate
      )
    );
  }

  const servicesByDate =
    new Map();

  const bucketsByDate =
    new Map();

  for (
    const appointment
    of appointments
  ) {
    const startsAt =
      appointmentStartsAt(
        appointment
      );

    if (!startsAt) {
      continue;
    }

    const businessDate =
      dateKey(startsAt);

    const observation =
      observationsByDate.get(
        businessDate
      );

    if (!observation) {
      continue;
    }

    const status =
      String(
        appointment?.status ||
          "pending"
      ).toLowerCase();

    if (
      !FORECAST_APPOINTMENT_STATUSES
        .has(status)
    ) {
      continue;
    }

    observation
      .booked_appointments += 1;

    incrementStatus(
      observation,
      status
    );

    if (
      ACTIVE_APPOINTMENT_STATUSES
        .has(status)
    ) {
      observation
        .pending_appointments += 1;
    }

    const revenue =
      appointmentRevenue(
        appointment
      );

    observation.total_revenue +=
      revenue;

    if (
      !servicesByDate.has(
        businessDate
      )
    ) {
      servicesByDate.set(
        businessDate,
        new Map()
      );
    }

    const serviceKey =
      entityId(
        appointment?.service
      ) ||
      "unknown-service";

    const serviceMap =
      servicesByDate.get(
        businessDate
      );

    if (
      !serviceMap.has(
        serviceKey
      )
    ) {
      serviceMap.set(
        serviceKey,
        emptyServiceObservation(
          serviceKey,
          serviceName(
            appointment?.service
          )
        )
      );
    }

    const serviceObservation =
      serviceMap.get(
        serviceKey
      );

    serviceObservation
      .booked_appointments += 1;

    incrementStatus(
      serviceObservation,
      status
    );

    serviceObservation.revenue +=
      revenue;

    if (
      !bucketsByDate.has(
        businessDate
      )
    ) {
      bucketsByDate.set(
        businessDate,
        new Map()
      );
    }

    const bucketName =
      timeBucket(
        startsAt
      );

    const bucketMap =
      bucketsByDate.get(
        businessDate
      );

    if (
      !bucketMap.has(
        bucketName
      )
    ) {
      bucketMap.set(
        bucketName,
        emptyTimeBucketObservation(
          bucketName
        )
      );
    }

    const bucketObservation =
      bucketMap.get(
        bucketName
      );

    bucketObservation
      .booked_appointments += 1;

    incrementStatus(
      bucketObservation,
      status
    );
  }

  for (
    const [
      businessDate,
      observation,
    ]
    of observationsByDate
  ) {
    const {
      start,
      end,
    } = londonDayBounds(
      businessDate
    );

    const matchingShifts =
      shifts.filter(
        (shift) => {
          const startsAt =
            validDate(
              shift?.startsAt
            );

          const endsAt =
            validDate(
              shift?.endsAt
            );

          return Boolean(
            startsAt &&
              endsAt &&
              startsAt < end &&
              endsAt > start &&
              ACTIVE_SHIFT_STATUSES
                .includes(
                  String(
                    shift?.status ||
                      ""
                  )
                )
          );
        }
      );

    const rotaHours =
      matchingShifts.reduce(
        (
          total,
          shift
        ) =>
          total +
          scheduledShiftHours(
            shift,
            start,
            end
          ),
        0
      );

    const fallbackHours =
      fallbackWorkingHoursForDate(
        businessDate,
        stylists
      );

    observation
      .available_staff_hours =
        roundNumber(
          rotaHours > 0
            ? rotaHours
            : fallbackHours,
          2
        );

    observation
      .appointment_capacity =
        Math.max(
          0,
          Math.round(
            observation
              .available_staff_hours *
              settings
                .appointments_per_staff_hour
          )
        );

    observation.total_revenue =
      roundNumber(
        observation
          .total_revenue,
        2
      );

    observation.services =
      Array.from(
        servicesByDate
          .get(
            businessDate
          )
          ?.values() ||
          []
      )
        .map(
          (service) => ({
            ...service,

            revenue:
              roundNumber(
                service.revenue,
                2
              ),
          })
        )
        .sort(
          (
            left,
            right
          ) =>
            right
              .booked_appointments -
              left
                .booked_appointments ||
            left
              .service_name
              .localeCompare(
                right
                  .service_name
              )
        );

    observation.time_buckets =
      [
        "morning",
        "afternoon",
        "evening",
      ]
        .map(
          (bucket) =>
            bucketsByDate
              .get(
                businessDate
              )
              ?.get(
                bucket
              )
        )
        .filter(Boolean);
  }

  return {
    as_of_date:
      asOfDateKey,

    observations:
      Array.from(
        observationsByDate.values()
      ),

    settings,
  };
}

export async function loadDemandForecastSourceData({
  asOfDate,
  lookbackDays =
    DEFAULT_DEMAND_FORECAST_OPTIONS
      .lookbackDays,
} = {}) {
  const asOfDateKey =
    asOfDate
      ? parseDateKey(
          asOfDate
        )
      : currentLondonDateKey();

  const selectedLookbackDays =
    clampInteger(
      lookbackDays,
      28,
      365,
      DEFAULT_DEMAND_FORECAST_OPTIONS
        .lookbackDays
    );

  const firstDateKey =
    shiftDateKey(
      asOfDateKey,
      -(
        selectedLookbackDays -
        1
      )
    );

  const queryStart =
    new Date(
      londonDayBounds(
        firstDateKey
      ).start.getTime() -
        DAY_MS
    );

  const queryEnd =
    new Date(
      londonDayBounds(
        shiftDateKey(
          asOfDateKey,
          1
        )
      ).end.getTime() +
        DAY_MS
    );

  const [
    appointments,
    shifts,
    stylists,
  ] = await Promise.all([
    Appointment.find({
      $or: [
        {
          startsAt: {
            $gte:
              queryStart,

            $lt:
              queryEnd,
          },
        },

        {
          appointmentDate: {
            $gte:
              queryStart,

            $lt:
              queryEnd,
          },
        },
      ],
    })
      .select(
        [
          "service",
          "appointmentDate",
          "appointmentTime",
          "startsAt",
          "status",
          "totalPrice",
          "finalPrice",
          "amountPaid",
        ].join(" ")
      )
      .populate(
        "service",
        "name title price duration"
      )
      .lean(),

    StaffShift.find({
      status: {
        $in:
          ACTIVE_SHIFT_STATUSES,
      },

      startsAt: {
        $lt:
          queryEnd,
      },

      endsAt: {
        $gt:
          queryStart,
      },
    })
      .select(
        [
          "staff",
          "startsAt",
          "endsAt",
          "breakMinutes",
          "status",
        ].join(" ")
      )
      .lean(),

    Stylist.find({
      isActive: {
        $ne: false,
      },
    })
      .select(
        "workingHours isActive"
      )
      .lean(),
  ]);

  return {
    appointments,
    shifts,
    stylists,

    asOfDate:
      asOfDateKey,

    lookbackDays:
      selectedLookbackDays,
  };
}

export async function createAiAppointmentDemandForecast({
  requestId,
  ...options
} = {}) {
  const source =
    await loadDemandForecastSourceData(
      options
    );

  const payload =
    buildDemandForecastPayload({
      ...source,
      ...options,

      asOfDate:
        source.asOfDate,

      lookbackDays:
        source.lookbackDays,
    });

  try {
    const forecast =
      await forecastAppointmentDemand(
        payload,
        {
          requestId,
        }
      );

    return {
      forecast,

      source: {
        timezone:
          TIMEZONE,

        currency:
          CURRENCY,

        asOfDate:
          payload.as_of_date,

        historyStart:
          payload
            .observations[0]
            ?.business_date ||
          null,

        historyEnd:
          payload
            .observations
            .at(-1)
            ?.business_date ||
          null,

        historyDays:
          payload
            .observations
            .length,

        appointmentRecords:
          source
            .appointments
            .length,

        rotaShiftRecords:
          source
            .shifts
            .length,

        activeStylists:
          source
            .stylists
            .length,

        privacy: {
          customerPiiSentToAi:
            false,

          staffPiiSentToAi:
            false,

          freeTextSentToAi:
            false,
        },
      },
    };
  } catch (error) {
    if (
      error instanceof
      AiDemandForecastingError
    ) {
      throw error;
    }

    throw new AiDemandForecastingError(
      error?.message ||
        "Unable to generate the appointment-demand forecast.",
      {
        code:
          error?.code ||
          "AI_DEMAND_FORECASTING_FAILED",

        status:
          error?.statusCode ||
          error?.status ||
          502,

        details:
          error?.details ||
          null,

        cause:
          error,
      }
    );
  }
}

export default {
  buildDemandForecastPayload,
  createAiAppointmentDemandForecast,
  loadDemandForecastSourceData,
};