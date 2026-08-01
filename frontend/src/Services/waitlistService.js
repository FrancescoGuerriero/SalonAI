import API from "../api/axios.js";

const WAITLIST_ROOT =
  "/future/waitlist";

const WAITLIST_STATUSES = [
  "waiting",
  "notified",
  "accepted",
  "booked",
  "declined",
  "expired",
  "cancelled",
];

const ACTIVE_WAITLIST_STATUSES = [
  "waiting",
  "notified",
  "accepted",
];

const WAITLIST_TIME_PREFERENCES = [
  "morning",
  "afternoon",
  "evening",
  "any",
];

const WAITLIST_CONTACT_CHANNELS = [
  "email",
  "sms",
  "phone",
  "whatsapp",
];

const CONVERTED_APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
];

/*
|--------------------------------------------------------------------------
| General normalisation
|--------------------------------------------------------------------------
*/

function normaliseText(value) {
  return String(
    value ?? ""
  )
    .trim()
    .replace(/\s+/g, " ");
}

function normaliseIdentifier(
  value,
  fieldName = "Identifier",
  {
    required = true,
  } = {}
) {
  const identifier =
    value?._id
      ? normaliseText(
          value._id
        )
      : normaliseText(
          value
        );

  if (
    required &&
    !identifier
  ) {
    throw new Error(
      `${fieldName} is required.`
    );
  }

  return identifier;
}

function normaliseNumber(
  value,
  fallback,
  {
    minimum = null,
    maximum = null,
  } = {}
) {
  const parsedValue =
    Number(value);

  if (
    !Number.isFinite(
      parsedValue
    )
  ) {
    return fallback;
  }

  let result =
    parsedValue;

  if (
    minimum !== null
  ) {
    result =
      Math.max(
        minimum,
        result
      );
  }

  if (
    maximum !== null
  ) {
    result =
      Math.min(
        maximum,
        result
      );
  }

  return result;
}

function normaliseInteger(
  value,
  fallback,
  options = {}
) {
  return Math.round(
    normaliseNumber(
      value,
      fallback,
      options
    )
  );
}

function normaliseBoolean(
  value
) {
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
    normaliseText(
      value
    ).toLowerCase()
  );
}

/*
|--------------------------------------------------------------------------
| Date and time normalisation
|--------------------------------------------------------------------------
*/

function normaliseDateOnly(
  value,
  fieldName = "Date"
) {
  if (!value) {
    return "";
  }

  if (
    typeof value ===
      "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return value;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      `${fieldName} must be a valid calendar date.`
    );
  }

  const localDate =
    new Date(
      date.getTime() -
        date.getTimezoneOffset() *
          60000
    );

  return localDate
    .toISOString()
    .slice(0, 10);
}

function normaliseDateTime(
  value,
  fieldName = "Date"
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      `${fieldName} must be a valid date and time.`
    );
  }

  return date.toISOString();
}

function normaliseTime(
  value,
  fieldName = "Time",
  {
    required = false,
  } = {}
) {
  const time =
    normaliseText(value);

  if (
    !time &&
    !required
  ) {
    return "";
  }

  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(
      time
    )
  ) {
    throw new Error(
      `${fieldName} must use HH:mm format.`
    );
  }

  return time;
}

function normalisePreferredDates(
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

  return Array.from(
    new Set(
      values
        .filter(Boolean)
        .map(
          (
            item
          ) =>
            normaliseDateOnly(
              item,
              "Preferred date"
            )
        )
    )
  ).sort();
}

/*
|--------------------------------------------------------------------------
| Waiting-list enums
|--------------------------------------------------------------------------
*/

function normaliseWaitlistStatus(
  value
) {
  const status =
    normaliseText(
      value
    ).toLowerCase();

  if (
    !WAITLIST_STATUSES.includes(
      status
    )
  ) {
    throw new Error(
      `Waiting-list status must be one of: ${WAITLIST_STATUSES.join(
        ", "
      )}.`
    );
  }

  return status;
}

function normaliseTimePreference(
  value
) {
  const preference =
    normaliseText(
      value || "any"
    ).toLowerCase();

  if (
    !WAITLIST_TIME_PREFERENCES
      .includes(
        preference
      )
  ) {
    throw new Error(
      `Time preference must be one of: ${WAITLIST_TIME_PREFERENCES.join(
        ", "
      )}.`
    );
  }

  return preference;
}

function normaliseContactChannel(
  value
) {
  const channel =
    normaliseText(
      value || "email"
    ).toLowerCase();

  if (
    !WAITLIST_CONTACT_CHANNELS
      .includes(
        channel
      )
  ) {
    throw new Error(
      `Contact channel must be one of: ${WAITLIST_CONTACT_CHANNELS.join(
        ", "
      )}.`
    );
  }

  return channel;
}

function normaliseConvertedAppointmentStatus(
  value
) {
  const status =
    normaliseText(
      value || "pending"
    )
      .toLowerCase()
      .replace(
        /-/g,
        "_"
      );

  if (
    !CONVERTED_APPOINTMENT_STATUSES
      .includes(
        status
      )
  ) {
    throw new Error(
      "Converted appointments must start as pending or confirmed."
    );
  }

  return status;
}

/*
|--------------------------------------------------------------------------
| Object utilities
|--------------------------------------------------------------------------
*/

function removeUndefinedValues(
  object = {}
) {
  return Object.fromEntries(
    Object.entries(
      object
    ).filter(
      ([, value]) =>
        value !==
        undefined
    )
  );
}

function removeEmptyValues(
  object = {}
) {
  return Object.fromEntries(
    Object.entries(
      object
    ).filter(
      ([, value]) => {
        if (
          value ===
            undefined ||
          value ===
            null ||
          value ===
            ""
        ) {
          return false;
        }

        if (
          Array.isArray(
            value
          ) &&
          value.length ===
            0
        ) {
          return false;
        }

        return true;
      }
    )
  );
}

/*
|--------------------------------------------------------------------------
| Error handling
|--------------------------------------------------------------------------
*/

function createWaitlistError(
  error
) {
  const responseData =
    error?.response?.data ||
    {};

  const message =
    responseData.message ||
    responseData.error ||
    error?.message ||
    "The waiting-list request failed.";

  const waitlistError =
    new Error(message);

  waitlistError.name =
    "WaitlistApiError";

  waitlistError.status =
    error?.response?.status ||
    responseData.statusCode ||
    responseData.status ||
    null;

  waitlistError.statusCode =
    waitlistError.status;

  waitlistError.code =
    responseData.code ||
    error?.code ||
    "WAITLIST_API_ERROR";

  waitlistError.details =
    responseData.details ||
    null;

  waitlistError.conflict =
    responseData.conflict ||
    responseData.details
      ?.conflict ||
    null;

  waitlistError.data =
    responseData;

  waitlistError.originalError =
    error;

  return waitlistError;
}

async function runRequest(
  request
) {
  try {
    return await request();
  } catch (error) {
    throw createWaitlistError(
      error
    );
  }
}

/*
|--------------------------------------------------------------------------
| Response extraction
|--------------------------------------------------------------------------
*/

function extractItems(
  responseData
) {
  if (
    Array.isArray(
      responseData
    )
  ) {
    return responseData;
  }

  if (
    Array.isArray(
      responseData?.items
    )
  ) {
    return responseData.items;
  }

  if (
    Array.isArray(
      responseData?.data
    )
  ) {
    return responseData.data;
  }

  if (
    Array.isArray(
      responseData?.data
        ?.items
    )
  ) {
    return responseData
      .data
      .items;
  }

  return [];
}

function extractEntry(
  responseData
) {
  return (
    responseData?.entry ||
    responseData?.data
      ?.entry ||
    responseData?.data ||
    responseData ||
    null
  );
}

/*
|--------------------------------------------------------------------------
| Query parameter construction
|--------------------------------------------------------------------------
*/

function buildListParams(
  filters = {}
) {
  const params = {
    page:
      normaliseInteger(
        filters.page,
        1,
        {
          minimum: 1,
        }
      ),

    limit:
      normaliseInteger(
        filters.limit,
        20,
        {
          minimum: 1,
          maximum: 100,
        }
      ),

    search:
      normaliseText(
        filters.search ||
          filters.q
      ),

    customer:
      normaliseText(
        filters.customer ||
          filters.customerId
      ),

    service:
      normaliseText(
        filters.service ||
          filters.serviceId
      ),

    stylist:
      normaliseText(
        filters.stylist ||
          filters.stylistId
      ),

    sort:
      normaliseText(
        filters.sort
      ),
  };

  if (
    filters.active ===
      true ||
    filters.active ===
      "true"
  ) {
    params.active =
      "true";
  }

  if (
    filters.status &&
    filters.status !==
      "all"
  ) {
    const statuses =
      Array.isArray(
        filters.status
      )
        ? filters.status
        : String(
            filters.status
          ).split(",");

    params.status =
      statuses
        .map(
          (
            status
          ) =>
            normaliseWaitlistStatus(
              status
            )
        )
        .join(",");
  }

  return removeEmptyValues(
    params
  );
}

/*
|--------------------------------------------------------------------------
| List, summary and individual entry
|--------------------------------------------------------------------------
*/

async function getWaitlistEntries(
  filters = {}
) {
  return runRequest(
    async () => {
      const response =
        await API.get(
          WAITLIST_ROOT,
          {
            params:
              buildListParams(
                filters
              ),
          }
        );

      const items =
        extractItems(
          response.data
        );

      return {
        ...response.data,
        items,

        pagination:
          response.data
            ?.pagination ||
          response.data?.data
            ?.pagination ||
          {
            page:
              Number(
                filters.page
              ) || 1,

            limit:
              Number(
                filters.limit
              ) || 20,

            total:
              items.length,

            pages:
              items.length >
              0
                ? 1
                : 0,
          },
      };
    }
  );
}

async function getWaitlistEntry(
  entryId
) {
  const identifier =
    normaliseIdentifier(
      entryId,
      "Waiting-list entry identifier"
    );

  return runRequest(
    async () => {
      const response =
        await API.get(
          `${WAITLIST_ROOT}/${encodeURIComponent(
            identifier
          )}`
        );

      return extractEntry(
        response.data
      );
    }
  );
}

async function getWaitlistSummary() {
  return runRequest(
    async () => {
      const response =
        await API.get(
          `${WAITLIST_ROOT}/summary`
        );

      return (
        response.data
          ?.summary ||
        response.data?.data
          ?.summary ||
        response.data?.data ||
        response.data ||
        {}
      );
    }
  );
}

/*
|--------------------------------------------------------------------------
| Create entry
|--------------------------------------------------------------------------
*/

async function createWaitlistEntry(
  payload = {}
) {
  const requestBody = {
    customer:
      normaliseIdentifier(
        payload.customer ||
          payload.customerId,
        "Customer"
      ),

    service:
      normaliseIdentifier(
        payload.service ||
          payload.serviceId,
        "Service"
      ),

    stylist:
      normaliseIdentifier(
        payload.stylist ||
          payload.stylistId,
        "Stylist",
        {
          required:
            false,
        }
      ),

    preferredDates:
      normalisePreferredDates(
        payload.preferredDates
      ),

    dateRangeStart:
      payload.dateRangeStart
        ? normaliseDateOnly(
            payload.dateRangeStart,
            "Date range start"
          )
        : "",

    dateRangeEnd:
      payload.dateRangeEnd
        ? normaliseDateOnly(
            payload.dateRangeEnd,
            "Date range end"
          )
        : "",

    timePreference:
      normaliseTimePreference(
        payload.timePreference
      ),

    earliestTime:
      normaliseTime(
        payload.earliestTime,
        "Earliest time"
      ),

    latestTime:
      normaliseTime(
        payload.latestTime,
        "Latest time"
      ),

    priority:
      normaliseInteger(
        payload.priority,
        0,
        {
          minimum: -100,
          maximum: 100,
        }
      ),

    notes:
      normaliseText(
        payload.notes
      ),

    preferredContactChannel:
      normaliseContactChannel(
        payload.preferredContactChannel
      ),

    responseDeadline:
      payload.responseDeadline
        ? normaliseDateTime(
            payload.responseDeadline,
            "Response deadline"
          )
        : "",

    expiresAt:
      payload.expiresAt
        ? normaliseDateTime(
            payload.expiresAt,
            "Expiry date"
          )
        : "",
  };

  if (
    requestBody.earliestTime &&
    requestBody.latestTime &&
    requestBody.earliestTime >
      requestBody.latestTime
  ) {
    throw new Error(
      "Latest time must be after the earliest time."
    );
  }

  if (
    requestBody.dateRangeStart &&
    requestBody.dateRangeEnd &&
    requestBody.dateRangeStart >
      requestBody.dateRangeEnd
  ) {
    throw new Error(
      "Date range end must be on or after the start date."
    );
  }

  return runRequest(
    async () => {
      const response =
        await API.post(
          WAITLIST_ROOT,
          removeEmptyValues(
            requestBody
          )
        );

      return extractEntry(
        response.data
      );
    }
  );
}

/*
|--------------------------------------------------------------------------
| Update entry
|--------------------------------------------------------------------------
*/

async function updateWaitlistEntry(
  entryId,
  payload = {}
) {
  const identifier =
    normaliseIdentifier(
      entryId,
      "Waiting-list entry identifier"
    );

  const requestBody = {};

  if (
    payload.service !==
      undefined ||
    payload.serviceId !==
      undefined
  ) {
    requestBody.service =
      normaliseIdentifier(
        payload.service ??
          payload.serviceId,
        "Service"
      );
  }

  if (
    payload.stylist !==
      undefined ||
    payload.stylistId !==
      undefined
  ) {
    const stylistValue =
      payload.stylist ??
      payload.stylistId;

    requestBody.stylist =
      stylistValue
        ? normaliseIdentifier(
            stylistValue,
            "Stylist"
          )
        : null;
  }

  if (
    payload.preferredDates !==
    undefined
  ) {
    requestBody.preferredDates =
      normalisePreferredDates(
        payload.preferredDates
      );
  }

  if (
    payload.dateRangeStart !==
    undefined
  ) {
    requestBody.dateRangeStart =
      payload.dateRangeStart
        ? normaliseDateOnly(
            payload.dateRangeStart,
            "Date range start"
          )
        : null;
  }

  if (
    payload.dateRangeEnd !==
    undefined
  ) {
    requestBody.dateRangeEnd =
      payload.dateRangeEnd
        ? normaliseDateOnly(
            payload.dateRangeEnd,
            "Date range end"
          )
        : null;
  }

  if (
    payload.timePreference !==
    undefined
  ) {
    requestBody.timePreference =
      normaliseTimePreference(
        payload.timePreference
      );
  }

  if (
    payload.earliestTime !==
    undefined
  ) {
    requestBody.earliestTime =
      normaliseTime(
        payload.earliestTime,
        "Earliest time"
      );
  }

  if (
    payload.latestTime !==
    undefined
  ) {
    requestBody.latestTime =
      normaliseTime(
        payload.latestTime,
        "Latest time"
      );
  }

  if (
    payload.priority !==
    undefined
  ) {
    requestBody.priority =
      normaliseInteger(
        payload.priority,
        0,
        {
          minimum: -100,
          maximum: 100,
        }
      );
  }

  if (
    payload.notes !==
    undefined
  ) {
    requestBody.notes =
      normaliseText(
        payload.notes
      );
  }

  if (
    payload.preferredContactChannel !==
    undefined
  ) {
    requestBody.preferredContactChannel =
      normaliseContactChannel(
        payload.preferredContactChannel
      );
  }

  if (
    payload.responseDeadline !==
    undefined
  ) {
    requestBody.responseDeadline =
      payload.responseDeadline
        ? normaliseDateTime(
            payload.responseDeadline,
            "Response deadline"
          )
        : null;
  }

  if (
    payload.expiresAt !==
    undefined
  ) {
    requestBody.expiresAt =
      payload.expiresAt
        ? normaliseDateTime(
            payload.expiresAt,
            "Expiry date"
          )
        : null;
  }

  if (
    payload.status !==
    undefined
  ) {
    requestBody.status =
      normaliseWaitlistStatus(
        payload.status
      );

    requestBody.statusReason =
      normaliseText(
        payload.statusReason ||
          payload.reason
      );
  }

  if (
    payload.force !==
    undefined
  ) {
    requestBody.force =
      normaliseBoolean(
        payload.force
      );
  }

  return runRequest(
    async () => {
      const response =
        await API.patch(
          `${WAITLIST_ROOT}/${encodeURIComponent(
            identifier
          )}`,
          removeUndefinedValues(
            requestBody
          )
        );

      return extractEntry(
        response.data
      );
    }
  );
}

/*
|--------------------------------------------------------------------------
| Delete entry
|--------------------------------------------------------------------------
*/

async function deleteWaitlistEntry(
  entryId,
  {
    force = false,
  } = {}
) {
  const identifier =
    normaliseIdentifier(
      entryId,
      "Waiting-list entry identifier"
    );

  return runRequest(
    async () => {
      const response =
        await API.delete(
          `${WAITLIST_ROOT}/${encodeURIComponent(
            identifier
          )}`,
          {
            params: {
              force:
                normaliseBoolean(
                  force
                ),
            },
          }
        );

      return response.data;
    }
  );
}

/*
|--------------------------------------------------------------------------
| Match available slot
|--------------------------------------------------------------------------
*/

async function matchWaitlistEntries(
  payload = {}
) {
  const params = {
    service:
      normaliseIdentifier(
        payload.service ||
          payload.serviceId,
        "Service"
      ),

    stylist:
      normaliseIdentifier(
        payload.stylist ||
          payload.stylistId,
        "Stylist",
        {
          required:
            false,
        }
      ),

    date:
      payload.appointmentDate ||
      payload.date
        ? normaliseDateOnly(
            payload.appointmentDate ||
              payload.date,
            "Appointment date"
          )
        : "",

    time:
      payload.appointmentTime ||
      payload.time
        ? normaliseTime(
            payload.appointmentTime ||
              payload.time,
            "Appointment time",
            {
              required:
                true,
            }
          )
        : "",

    limit:
      normaliseInteger(
        payload.limit,
        20,
        {
          minimum: 1,
          maximum: 100,
        }
      ),
  };

  return runRequest(
    async () => {
      const response =
        await API.get(
          `${WAITLIST_ROOT}/matches`,
          {
            params:
              removeEmptyValues(
                params
              ),
          }
        );

      const items =
        extractItems(
          response.data
        );

      return {
        ...response.data,
        items,

        total:
          Number(
            response.data?.total
          ) ||
          items.length,
      };
    }
  );
}

/*
|--------------------------------------------------------------------------
| Convert entry into appointment
|--------------------------------------------------------------------------
*/

async function convertWaitlistEntry(
  entryId,
  payload = {}
) {
  const identifier =
    normaliseIdentifier(
      entryId,
      "Waiting-list entry identifier"
    );

  const requestBody = {
    stylist:
      normaliseIdentifier(
        payload.stylist ||
          payload.stylistId,
        "Stylist",
        {
          required:
            false,
        }
      ),

    appointmentDate:
      normaliseDateOnly(
        payload.appointmentDate ||
          payload.date,
        "Appointment date"
      ),

    appointmentTime:
      normaliseTime(
        payload.appointmentTime ||
          payload.time,
        "Appointment time",
        {
          required:
            true,
        }
      ),

    duration:
      payload.duration ===
        undefined
        ? undefined
        : normaliseInteger(
            payload.duration,
            60,
            {
              minimum: 1,
              maximum: 1440,
            }
          ),

    totalPrice:
      payload.totalPrice ===
        undefined &&
      payload.price ===
        undefined
        ? undefined
        : normaliseNumber(
            payload.totalPrice ??
              payload.price,
            0,
            {
              minimum: 0,
            }
          ),

    discount:
      payload.discount ===
        undefined
        ? undefined
        : normaliseNumber(
            payload.discount,
            0,
            {
              minimum: 0,
            }
          ),

    tax:
      payload.tax ===
        undefined
        ? undefined
        : normaliseNumber(
            payload.tax,
            0,
            {
              minimum: 0,
            }
          ),

    status:
      normaliseConvertedAppointmentStatus(
        payload.status
      ),

    notes:
      normaliseText(
        payload.notes
      ),

    reason:
      normaliseText(
        payload.reason
      ),

    force:
      normaliseBoolean(
        payload.force
      ),
  };

  return runRequest(
    async () => {
      const response =
        await API.post(
          `${WAITLIST_ROOT}/${encodeURIComponent(
            identifier
          )}/convert`,
          removeUndefinedValues(
            requestBody
          )
        );

      return {
        message:
          response.data
            ?.message ||
          "Waiting-list entry converted into an appointment.",

        entry:
          response.data
            ?.entry ||
          response.data?.data
            ?.entry ||
          null,

        appointment:
          response.data
            ?.appointment ||
          response.data?.data
            ?.appointment ||
          null,
      };
    }
  );
}

/*
|--------------------------------------------------------------------------
| Expiry processing
|--------------------------------------------------------------------------
*/

async function expireWaitlistEntries(
  now = null
) {
  const requestBody =
    now
      ? {
          now:
            normaliseDateTime(
              now,
              "Expiry processing date"
            ),
        }
      : {};

  return runRequest(
    async () => {
      const response =
        await API.post(
          `${WAITLIST_ROOT}/expire`,
          requestBody
        );

      return {
        ...response.data,

        expired:
          Number(
            response.data?.expired
          ) || 0,
      };
    }
  );
}

export {
  ACTIVE_WAITLIST_STATUSES,
  CONVERTED_APPOINTMENT_STATUSES,
  WAITLIST_CONTACT_CHANNELS,
  WAITLIST_ROOT,
  WAITLIST_STATUSES,
  WAITLIST_TIME_PREFERENCES,
  createWaitlistEntry,
  createWaitlistError,
  deleteWaitlistEntry,
  expireWaitlistEntries,
  getWaitlistEntries,
  getWaitlistEntry,
  getWaitlistSummary,
  matchWaitlistEntries,
  normaliseContactChannel,
  normaliseTimePreference,
  normaliseWaitlistStatus,
  updateWaitlistEntry,
  convertWaitlistEntry,
};

export default {
  createWaitlistEntry,
  deleteWaitlistEntry,
  expireWaitlistEntries,
  getWaitlistEntries,
  getWaitlistEntry,
  getWaitlistSummary,
  matchWaitlistEntries,
  updateWaitlistEntry,
  convertWaitlistEntry,
};