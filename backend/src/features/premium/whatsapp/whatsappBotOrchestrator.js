import Service from "../../../models/service.js";
import Stylist from "../../../models/Stylist.js";
import {
  buildAvailableSlots,
  parseBookingDate,
  stylistOffersService,
} from "../../../services/bookingAvailabilityService.js";
import {
  dayAvailability,
} from "../../staff/staffService.js";
import WhatsAppConversation from "./WhatsAppConversation.js";
import {
  analyseWhatsAppBotMessage,
} from "./whatsappBotAiClient.js";


const CONFIRMATION_WORDS = new Set([
  "confirm",
  "confirmed",
  "yes",
  "yes please",
  "book it",
  "go ahead",
  "looks good",
  "that's fine",
  "thats fine",
  "that is fine",
]);

const CHANGE_WORDS = new Set([
  "no",
  "change",
  "change it",
  "another time",
  "different time",
  "another date",
  "different date",
]);

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const MONTHS = new Map([
  ["jan", 1],
  ["january", 1],
  ["feb", 2],
  ["february", 2],
  ["mar", 3],
  ["march", 3],
  ["apr", 4],
  ["april", 4],
  ["may", 5],
  ["jun", 6],
  ["june", 6],
  ["jul", 7],
  ["july", 7],
  ["aug", 8],
  ["august", 8],
  ["sep", 9],
  ["sept", 9],
  ["september", 9],
  ["oct", 10],
  ["october", 10],
  ["nov", 11],
  ["november", 11],
  ["dec", 12],
  ["december", 12],
]);


function readBoolean(
  value,
  fallback = false
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  return (
    String(value)
      .trim()
      .toLowerCase() === "true"
  );
}


function readNumber(
  value,
  fallback
) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}


function compactText(
  value,
  maximum = 1000
) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximum);
}


function normalisedText(
  value
) {
  return compactText(
    value,
    4096
  ).toLowerCase();
}


export function getWhatsAppBotConfig(
  environment = process.env
) {
  const enabled = readBoolean(
    environment.WHATSAPP_BOT_ENABLED,
    false
  );

  const sendReplies =
    enabled &&
    readBoolean(
      environment.WHATSAPP_BOT_SEND_REPLIES,
      false
    );

  const minimumConfidence = readNumber(
    environment.WHATSAPP_BOT_MIN_CONFIDENCE,
    0.75
  );

  const sessionMinutes = Math.trunc(
    readNumber(
      environment.WHATSAPP_BOT_SESSION_MINUTES,
      30
    )
  );

  const maximumServiceOptions = Math.trunc(
    readNumber(
      environment.WHATSAPP_BOT_MAX_SERVICE_OPTIONS,
      8
    )
  );

  if (
    enabled &&
    (
      minimumConfidence < 0 ||
      minimumConfidence > 1
    )
  ) {
    throw new Error(
      "WHATSAPP_BOT_MIN_CONFIDENCE must be between 0 and 1."
    );
  }

  if (
    enabled &&
    (
      sessionMinutes < 5 ||
      sessionMinutes > 180
    )
  ) {
    throw new Error(
      "WHATSAPP_BOT_SESSION_MINUTES must be between 5 and 180."
    );
  }

  return {
    enabled,
    sendReplies,
    minimumConfidence,
    sessionMinutes,
    maximumServiceOptions:
      Math.max(
        3,
        Math.min(
          12,
          maximumServiceOptions
        )
      ),
    timeZone: compactText(
      environment.SALON_TIME_ZONE ||
        "Europe/London",
      80
    ),
    openingHours: compactText(
      environment.SALON_OPENING_HOURS ||
        "",
      500
    ),
  };
}


function validYmd(
  value
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/
      .exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const candidate = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      12
    )
  );

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}


function datePartsInTimeZone(
  now,
  timeZone
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    );

  const parts =
    Object.fromEntries(
      formatter
        .formatToParts(now)
        .filter(
          (part) =>
            part.type !== "literal"
        )
        .map(
          (part) => [
            part.type,
            part.value,
          ]
        )
    );

  return (
    `${parts.year}-` +
    `${parts.month}-` +
    `${parts.day}`
  );
}


function addDays(
  value,
  days
) {
  const [year, month, day] =
    value
      .split("-")
      .map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      12
    )
  );

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date
    .toISOString()
    .slice(0, 10);
}


function buildYmd(
  year,
  month,
  day
) {
  const candidate =
    `${String(year).padStart(4, "0")}-` +
    `${String(month).padStart(2, "0")}-` +
    `${String(day).padStart(2, "0")}`;

  return validYmd(candidate)
    ? candidate
    : "";
}


function futureYearForPartialDate(
  month,
  day,
  current
) {
  const currentYear =
    Number(
      current.slice(0, 4)
    );

  const candidate =
    buildYmd(
      currentYear,
      month,
      day
    );

  if (!candidate) {
    return "";
  }

  if (candidate >= current) {
    return candidate;
  }

  return buildYmd(
    currentYear + 1,
    month,
    day
  );
}


export function normaliseBotDate(
  value,
  {
    now = new Date(),
    timeZone =
      "Europe/London",
  } = {}
) {
  const text =
    normalisedText(value);

  if (!text) {
    return "";
  }

  if (validYmd(text)) {
    return text;
  }

  const current =
    datePartsInTimeZone(
      now,
      timeZone
    );

  const britishFull =
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/
      .exec(text);

  if (britishFull) {
    let year =
      Number(
        britishFull[3]
      );

    if (year < 100) {
      year += 2000;
    }

    return buildYmd(
      year,
      Number(britishFull[2]),
      Number(britishFull[1])
    );
  }

  const britishPartial =
    /^(\d{1,2})[/-](\d{1,2})$/
      .exec(text);

  if (britishPartial) {
    return futureYearForPartialDate(
      Number(britishPartial[2]),
      Number(britishPartial[1]),
      current
    );
  }

  const namedDate =
    /^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/
      .exec(text);

  if (
    namedDate &&
    MONTHS.has(
      namedDate[2]
    )
  ) {
    const day =
      Number(namedDate[1]);

    const month =
      MONTHS.get(
        namedDate[2]
      );

    if (namedDate[3]) {
      return buildYmd(
        Number(namedDate[3]),
        month,
        day
      );
    }

    return futureYearForPartialDate(
      month,
      day,
      current
    );
  }

  if (text === "today") {
    return current;
  }

  if (text === "tomorrow") {
    return addDays(
      current,
      1
    );
  }

  const currentDate = new Date(
    `${current}T12:00:00.000Z`
  );

  const currentWeekday =
    currentDate.getUTCDay();

  for (
    let index = 0;
    index < WEEKDAYS.length;
    index += 1
  ) {
    const weekday =
      WEEKDAYS[index];

    if (
      text === weekday ||
      text === `next ${weekday}`
    ) {
      let delta =
        (
          index -
          currentWeekday +
          7
        ) % 7;

      if (
        text.startsWith("next ") &&
        delta === 0
      ) {
        delta = 7;
      }

      return addDays(
        current,
        delta
      );
    }
  }

  return "";
}


export function normaliseBotTime(
  value
) {
  const text =
    normalisedText(value);

  if (!text) {
    return "";
  }

  if (
    [
      "morning",
      "afternoon",
      "evening",
    ].includes(text)
  ) {
    return text;
  }

  const twentyFourHour =
    /^([01]?\d|2[0-3])[:.]([0-5]\d)$/
      .exec(text);

  if (twentyFourHour) {
    return (
      String(
        Number(
          twentyFourHour[1]
        )
      ).padStart(
        2,
        "0"
      ) +
      ":" +
      twentyFourHour[2]
    );
  }

  const twelveHour =
    /^(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)$/
      .exec(text);

  if (twelveHour) {
    let hours =
      Number(
        twelveHour[1]
      );

    const minutes =
      twelveHour[2] || "00";

    if (
      twelveHour[3] === "am" &&
      hours === 12
    ) {
      hours = 0;
    }

    if (
      twelveHour[3] === "pm" &&
      hours !== 12
    ) {
      hours += 12;
    }

    return (
      String(hours)
        .padStart(
          2,
          "0"
        ) +
      ":" +
      minutes
    );
  }

  return "";
}


function slotMinutes(
  value
) {
  const [hours, minutes] =
    String(value)
      .split(":")
      .map(Number);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes)
  ) {
    return null;
  }

  return (
    hours * 60 +
    minutes
  );
}


export function selectPreferredSlots(
  slots,
  preference,
  limit = 3
) {
  const unique =
    [
      ...new Set(
        Array.isArray(slots)
          ? slots
          : []
      ),
    ].sort();

  if (!preference) {
    return unique.slice(
      0,
      limit
    );
  }

  if (
    /^\d{2}:\d{2}$/
      .test(preference)
  ) {
    return unique.includes(
      preference
    )
      ? [preference]
      : [];
  }

  const filtered =
    unique.filter(
      (slot) => {
        const minutes =
          slotMinutes(slot);

        if (minutes === null) {
          return false;
        }

        if (
          preference === "morning"
        ) {
          return minutes < 12 * 60;
        }

        if (
          preference === "afternoon"
        ) {
          return (
            minutes >= 12 * 60 &&
            minutes < 17 * 60
          );
        }

        if (
          preference === "evening"
        ) {
          return minutes >= 17 * 60;
        }

        return false;
      }
    );

  return filtered.slice(
    0,
    limit
  );
}


function bookingDateObject(
  ymd
) {
  return new Date(
    `${ymd}T12:00:00.000Z`
  );
}


function appointmentDateValue(
  value
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
    return "";
  }

  return date
    .toISOString()
    .slice(0, 10);
}


function formatDateLabel(
  ymd
) {
  return (
    new Intl.DateTimeFormat(
      "en-GB",
      {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }
    ).format(
      bookingDateObject(
        ymd
      )
    )
  );
}


function stylistName(
  stylist
) {
  return compactText(
    [
      stylist?.firstName,
      stylist?.lastName,
    ]
      .filter(Boolean)
      .join(" "),
    120
  );
}


function objectIdText(
  value
) {
  return String(value || "");
}


function findByName(
  values,
  requestedName,
  label
) {
  const requested =
    normalisedText(
      requestedName
    );

  if (!requested) {
    return null;
  }

  return (
    values.find(
      (value) =>
        normalisedText(
          label(value)
        ) === requested
    ) ||
    null
  );
}


function findById(
  values,
  requestedId
) {
  const requested =
    objectIdText(
      requestedId
    );

  if (!requested) {
    return null;
  }

  return (
    values.find(
      (value) =>
        objectIdText(
          value?._id
        ) === requested
    ) ||
    null
  );
}


function priceLabel(
  service
) {
  if (
    service?.priceLabel
  ) {
    return service.priceLabel;
  }

  if (
    service?.priceOnConsultation
  ) {
    return "Price on consultation";
  }

  return (
    new Intl.NumberFormat(
      "en-GB",
      {
        style: "currency",
        currency: "GBP",
      }
    ).format(
      Math.max(
        0,
        Number(
          service?.price
        ) || 0
      )
    )
  );
}


function serviceNeedsManualBooking(
  service
) {
  return Boolean(
    service &&
    (
      service.onlineBookable === false ||
      service.priceOnConsultation === true
    )
  );
}


function ensureState(
  conversation
) {
  conversation.bookingSession =
    conversation.bookingSession || {};

  conversation.automation =
    conversation.automation || {};

  const session =
    conversation.bookingSession;

  const automation =
    conversation.automation;

  session.stage =
    session.stage || "idle";

  session.availableSlots =
    Array.isArray(
      session.availableSlots
    )
      ? session.availableSlots
      : [];

  automation.mode =
    automation.mode || "bot";

  automation.clarificationCount =
    Number.isInteger(
      automation.clarificationCount
    )
      ? automation.clarificationCount
      : 0;

  automation.anyStylist =
    automation.anyStylist === true;

  return {
    session,
    automation,
  };
}


function recordAnalysis(
  automation,
  analysis
) {
  automation.lastIntent =
    compactText(
      analysis?.intent,
      80
    );

  const confidence =
    Number(
      analysis?.confidence
    );

  automation.lastConfidence =
    Number.isFinite(
      confidence
    )
      ? confidence
      : null;

  automation.lastAction =
    compactText(
      analysis?.next_action,
      100
    );

  automation.modelName =
    compactText(
      analysis?.model_name,
      200
    );

  automation.providerMode =
    compactText(
      analysis?.provider_mode,
      80
    );

  automation.lastError = "";
}


function markProcessed(
  automation,
  incoming,
  now
) {
  automation.lastProcessedMessageId =
    compactText(
      incoming?.providerMessageId,
      300
    );

  automation.lastProcessedAt =
    now;
}


function handoff(
  automation,
  reason
) {
  automation.mode = "human";
  automation.handoffRequested = true;
  automation.handoffReason =
    compactText(
      reason,
      200
    );
}


function clearHandoff(
  automation
) {
  automation.mode = "bot";
  automation.handoffRequested = false;
  automation.handoffReason = "";
}


function isConfirmation(
  value
) {
  return CONFIRMATION_WORDS.has(
    normalisedText(value)
  );
}


function isChangeRequest(
  value
) {
  return CHANGE_WORDS.has(
    normalisedText(value)
  );
}


function anyStylistRequested(
  entityValue,
  customerText
) {
  const entity =
    normalisedText(
      entityValue
    );

  if (
    [
      "any available stylist",
      "any stylist",
      "anyone available",
      "anyone",
    ].includes(entity)
  ) {
    return true;
  }

  return (
    /\bany (available )?stylist\b/.test(
      normalisedText(
        customerText
      )
    ) ||
    /\banyone available\b/.test(
      normalisedText(
        customerText
      )
    )
  );
}


function serviceOptionsReply(
  services,
  maximum
) {
  const categories =
    [
      ...new Set(
        services
          .map(
            (service) =>
              compactText(
                service?.category,
                80
              )
          )
          .filter(Boolean)
      ),
    ]
      .sort()
      .slice(
        0,
        maximum
      );

  if (categories.length === 0) {
    return (
      "Tell me what you would like done with your hair and I will help you find the right service."
    );
  }

  return (
    `We currently publish ${services.length} salon services. ` +
    `Categories include ${categories.join(", ")}. ` +
    "Tell me the service name or describe what you would like done."
  );
}


function eligibleStylists(
  stylists,
  service
) {
  return stylists.filter(
    (stylist) =>
      stylistOffersService(
        stylist,
        service?._id
      )
  );
}


function stylistOptionsReply(
  stylists,
  service
) {
  const names =
    eligibleStylists(
      stylists,
      service
    )
      .map(stylistName)
      .filter(Boolean)
      .slice(0, 5);

  if (names.length === 0) {
    return (
      "I could not match an available stylist automatically, so the salon team will need to help."
    );
  }

  return (
    `For ${service.name}, you can choose ${names.join(", ")}, ` +
    "or reply 'any available stylist'."
  );
}


async function defaultGetAvailableSlots({
  stylist,
  service,
  date,
  now,
}) {
  const targetDate =
    parseBookingDate(
      date
    );

  const day =
    await dayAvailability(
      stylist._id,
      targetDate
    );

  return buildAvailableSlots({
    date: targetDate,
    ranges:
      day?.availability?.ranges ||
      [],
    appointments:
      day?.appointments || [],
    timeOff:
      day?.timeOff || [],
    duration:
      Math.max(
        1,
        Number(
          service?.duration
        ) || 60
      ),
    interval: 30,
    now,
  });
}


async function findAvailability({
  service,
  selectedStylist,
  anyStylist,
  stylists,
  date,
  preference,
  now,
  getAvailableSlots,
}) {
  const candidates =
    selectedStylist
      ? [selectedStylist]
      : anyStylist
        ? eligibleStylists(
            stylists,
            service
          )
        : [];

  let fallback = null;

  for (
    const stylist of candidates
  ) {
    const slots =
      await getAvailableSlots({
        stylist,
        service,
        date,
        now,
      });

    const preferred =
      selectPreferredSlots(
        slots,
        preference,
        3
      );

    if (preferred.length > 0) {
      return {
        stylist,
        slots,
        preferred,
        exact:
          /^\d{2}:\d{2}$/
            .test(preference) &&
          preferred[0] === preference,
      };
    }

    if (
      !fallback &&
      Array.isArray(slots) &&
      slots.length > 0
    ) {
      fallback = {
        stylist,
        slots,
        preferred:
          slots.slice(0, 3),
        exact: false,
      };
    }
  }

  return fallback;
}


async function finishTurn({
  conversation,
  incoming,
  reply,
  now,
  persist,
  result = {},
}) {
  markProcessed(
    conversation.automation,
    incoming,
    now
  );

  await persist(
    conversation
  );

  return {
    processed: true,
    reply:
      compactText(
        reply,
        4096
      ),
    ...result,
  };
}


function bookingSignal(
  analysis,
  session
) {
  const entities =
    analysis?.entities || {};

  return Boolean(
    analysis?.intent === "booking" ||
    session.stage !== "idle" ||
    entities.service_name ||
    entities.stylist_name ||
    entities.date_text ||
    entities.time_text
  );
}


export async function runWhatsAppBotTurn(
  {
    conversation,
    incoming,
    services = [],
    stylists = [],
  },
  {
    analyse =
      analyseWhatsAppBotMessage,
    getAvailableSlots =
      defaultGetAvailableSlots,
    persist =
      async (value) =>
        value.save(),
    environment =
      process.env,
    now =
      new Date(),
  } = {}
) {
  const config =
    getWhatsAppBotConfig(
      environment
    );

  if (!config.enabled) {
    return {
      processed: false,
      skipped: "bot_disabled",
    };
  }

  if (
    !conversation ||
    !incoming
  ) {
    throw new Error(
      "A WhatsApp conversation and incoming message are required."
    );
  }

  const {
    session,
    automation,
  } =
    ensureState(
      conversation
    );

  const incomingId =
    compactText(
      incoming.providerMessageId,
      300
    );

  if (
    incomingId &&
    automation.lastProcessedMessageId ===
      incomingId
  ) {
    return {
      processed: false,
      skipped:
        "already_processed",
    };
  }

  if (
    conversation.assignedTo ||
    automation.mode === "human"
  ) {
    handoff(
      automation,
      conversation.assignedTo
        ? "staff_assigned"
        : (
            automation.handoffReason ||
            "human_mode"
          )
    );

    markProcessed(
      automation,
      incoming,
      now
    );

    await persist(
      conversation
    );

    return {
      processed: false,
      skipped: "human_owned",
      handoff: true,
    };
  }

  const customerText =
    compactText(
      incoming.message,
      4096
    );

  if (!customerText) {
    markProcessed(
      automation,
      incoming,
      now
    );

    await persist(
      conversation
    );

    return {
      processed: false,
      skipped: "empty_message",
    };
  }

  if (
    session.stage === "review" &&
    isConfirmation(
      customerText
    )
  ) {
    handoff(
      automation,
      "customer_confirmed_slot"
    );

    automation.lastIntent =
      "booking_confirmation";

    automation.lastConfidence = 1;

    automation.lastAction =
      "handoff_for_final_confirmation";

    conversation.status =
      "awaiting_confirmation";

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        "Thanks. Your requested slot has been passed to the salon team for final confirmation. Your appointment is not booked until you receive a confirmation message.",
      result: {
        handoff: true,
        bookingReady: true,
      },
    });
  }

  if (
    session.stage === "review" &&
    isChangeRequest(
      customerText
    )
  ) {
    session.stage = "time";
    session.appointmentTime = "";
    session.availableSlots = [];
    session.confirmed = false;
    session.confirmationState =
      "pending";
    session.expiresAt = null;

    conversation.status =
      "collecting_details";

    automation.lastIntent =
      "booking";

    automation.lastConfidence = 1;

    automation.lastAction =
      "collect_time";

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        "No problem. Tell me another preferred time, or say morning, afternoon or evening.",
      result: {
        handoff: false,
        intent: "booking",
      },
    });
  }

  /*
   * When the booking state machine is explicitly waiting for a
   * date or time, accept a safely parseable standalone value
   * deterministically before consulting AI. This prevents a
   * low-confidence generic intent classification from blocking
   * an otherwise unambiguous booking continuation.
   */
  let stageAnalysis = null;

  if (
    session.stage === "date"
  ) {
    const stageDate =
      normaliseBotDate(
        customerText,
        {
          now,
          timeZone:
            config.timeZone,
        }
      );

    if (stageDate) {
      stageAnalysis = {
        intent: "booking",
        confidence: 1,
        entities: {
          service_name: "",
          stylist_name: "",
          date_text:
            stageDate,
          time_text: "",
          customer_name: "",
        },
        next_action:
          "collect_time",
        requires_human: false,
        reply_suggestion:
          "What time would you prefer?",
        provider_mode:
          "deterministic",
        model_name:
          "salonai-booking-state-machine-v1",
        rules_applied: [
          "booking-stage-date-value",
        ],
      };
    }
  } else if (
    session.stage === "time"
  ) {
    const stageTime =
      normaliseBotTime(
        customerText
      );

    if (stageTime) {
      stageAnalysis = {
        intent: "booking",
        confidence: 1,
        entities: {
          service_name: "",
          stylist_name: "",
          date_text: "",
          time_text:
            stageTime,
          customer_name: "",
        },
        next_action:
          "check_availability",
        requires_human: false,
        reply_suggestion:
          "I will check live availability.",
        provider_mode:
          "deterministic",
        model_name:
          "salonai-booking-state-machine-v1",
        rules_applied: [
          "booking-stage-time-value",
        ],
      };
    }
  }

  const analysis =
    stageAnalysis ||
    await analyse({
      message: customerText,
      current_stage:
        session.stage || "idle",
      services:
        services
          .map(
            (service) =>
              service.name
          )
          .filter(Boolean)
          .slice(0, 200),
      stylists:
        stylists
          .map(stylistName)
          .filter(Boolean)
          .slice(0, 100),
      locale: "en-GB",
    });

  recordAnalysis(
    automation,
    analysis
  );

  const entities =
    analysis?.entities || {};

  if (
    analysis?.requires_human ||
    [
      "reschedule",
      "cancellation",
      "human_handoff",
    ].includes(
      analysis?.intent
    )
  ) {
    handoff(
      automation,
      analysis?.intent ||
        "ai_handoff"
    );

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        analysis?.reply_suggestion ||
        "I will pass this conversation to the salon team.",
      result: {
        handoff: true,
        intent:
          analysis?.intent || "",
      },
    });
  }

  const confidence =
    Number(
      analysis?.confidence
    );

  if (
    !Number.isFinite(confidence) ||
    confidence <
      config.minimumConfidence
  ) {
    handoff(
      automation,
      "low_ai_confidence"
    );

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        "I am not confident I understood that correctly, so I will ask the salon team to help.",
      result: {
        handoff: true,
        intent:
          analysis?.intent || "",
      },
    });
  }

  let service =
    findById(
      services,
      session.serviceId
    );

  const identifiedService =
    findByName(
      services,
      entities.service_name,
      (value) =>
        value?.name
    );

  if (
    identifiedService &&
    (
      !service ||
      objectIdText(
        service._id
      ) !==
        objectIdText(
          identifiedService._id
        )
    )
  ) {
    service =
      identifiedService;

    session.serviceId =
      service._id;

    session.stylistId = null;
    session.appointmentDate = null;
    session.appointmentTime = "";
    session.availableSlots = [];

    automation.anyStylist = false;
  }

  let stylist =
    findById(
      stylists,
      session.stylistId
    );

  if (
    anyStylistRequested(
      entities.stylist_name,
      customerText
    )
  ) {
    stylist = null;
    session.stylistId = null;
    automation.anyStylist = true;
  } else {
    const identifiedStylist =
      findByName(
        stylists,
        entities.stylist_name,
        stylistName
      );

    if (
      identifiedStylist &&
      (
        !stylist ||
        objectIdText(
          stylist._id
        ) !==
          objectIdText(
            identifiedStylist._id
          )
      )
    ) {
      stylist =
        identifiedStylist;

      session.stylistId =
        stylist._id;

      automation.anyStylist = false;

      session.appointmentTime = "";
      session.availableSlots = [];
    }
  }

  let appointmentDate =
    appointmentDateValue(
      session.appointmentDate
    );

  if (entities.date_text) {
    const resolvedDate =
      normaliseBotDate(
        entities.date_text,
        {
          now,
          timeZone:
            config.timeZone,
        }
      );

    if (!resolvedDate) {
      session.stage = "date";
      conversation.status =
        "collecting_details";

      return finishTurn({
        conversation,
        incoming,
        now,
        persist,
        reply:
          "I could not safely understand that date. Please send a date such as 3 September, 03/09/2026, tomorrow or next Friday.",
        result: {
          handoff: false,
          intent: "booking",
        },
      });
    }

    if (
      appointmentDate &&
      appointmentDate !==
        resolvedDate
    ) {
      session.appointmentTime = "";
      session.availableSlots = [];
    }

    appointmentDate =
      resolvedDate;

    session.appointmentDate =
      bookingDateObject(
        resolvedDate
      );
  }

  let timePreference =
    session.appointmentTime || "";

  if (entities.time_text) {
    const resolvedTime =
      normaliseBotTime(
        entities.time_text
      );

    if (!resolvedTime) {
      session.stage = "time";
      conversation.status =
        "collecting_details";

      return finishTurn({
        conversation,
        incoming,
        now,
        persist,
        reply:
          "I could not safely understand that time. Please send a time such as 15:00, 3pm, morning, afternoon or evening.",
        result: {
          handoff: false,
          intent: "booking",
        },
      });
    }

    timePreference =
      resolvedTime;

    if (
      /^\d{2}:\d{2}$/
        .test(
          resolvedTime
        )
    ) {
      session.appointmentTime =
        resolvedTime;
    } else {
      session.appointmentTime = "";
    }
  }

  if (
    analysis.intent === "price"
  ) {
    if (!service) {
      return finishTurn({
        conversation,
        incoming,
        now,
        persist,
        reply:
          "Which service would you like the current published price for?",
        result: {
          handoff: false,
          intent: "price",
        },
      });
    }

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        `${service.name}: ${priceLabel(service)}.`,
      result: {
        handoff: false,
        intent: "price",
      },
    });
  }

  if (
    analysis.intent === "services"
  ) {
    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        serviceOptionsReply(
          services,
          config.maximumServiceOptions
        ),
      result: {
        handoff: false,
        intent: "services",
      },
    });
  }

  if (
    analysis.intent ===
      "opening_hours"
  ) {
    if (config.openingHours) {
      return finishTurn({
        conversation,
        incoming,
        now,
        persist,
        reply:
          config.openingHours,
        result: {
          handoff: false,
          intent:
            "opening_hours",
        },
      });
    }

    handoff(
      automation,
      "opening_hours_not_configured"
    );

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        "I do not have verified salon opening hours configured, so I will ask the salon team to help.",
      result: {
        handoff: true,
        intent:
          "opening_hours",
      },
    });
  }

  if (
    analysis.intent === "greeting" &&
    session.stage === "idle"
  ) {
    automation.clarificationCount = 0;

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        analysis.reply_suggestion ||
        "Hello. I can help with salon services, prices and appointment requests.",
      result: {
        handoff: false,
        intent: "greeting",
      },
    });
  }

  const isBooking =
    bookingSignal(
      analysis,
      session
    );

  if (
    !isBooking &&
    analysis.intent === "unknown"
  ) {
    if (
      automation.clarificationCount <
      1
    ) {
      automation.clarificationCount += 1;

      return finishTurn({
        conversation,
        incoming,
        now,
        persist,
        reply:
          "I can help with appointments, services and prices. Could you tell me what you would like to do?",
        result: {
          handoff: false,
          intent: "unknown",
        },
      });
    }

    handoff(
      automation,
      "repeated_unrecognised_message"
    );

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        "I am not confident I understood your request, so I will pass the conversation to the salon team.",
      result: {
        handoff: true,
        intent: "unknown",
      },
    });
  }

  if (!isBooking) {
    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        analysis.reply_suggestion ||
        "How can I help with your salon appointment?",
      result: {
        handoff: false,
        intent:
          analysis.intent || "",
      },
    });
  }

  automation.clarificationCount = 0;
  clearHandoff(
    automation
  );

  if (!service) {
    session.stage = "service";
    conversation.status =
      "collecting_details";
    automation.lastAction =
      "collect_service";

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        "Which salon service would you like to book?",
      result: {
        handoff: false,
        intent: "booking",
      },
    });
  }

  /*
   * Estimated durations are deliberately accepted here.
   * The provisional catalogue currently uses 60 minutes.
   * Manual handling remains required for price-on-
   * consultation or explicitly non-bookable services.
   */
  if (
    serviceNeedsManualBooking(
      service
    )
  ) {
    handoff(
      automation,
      service.priceOnConsultation
        ? "service_price_requires_consultation"
        : "service_not_online_bookable"
    );

    session.stage = "service";
    session.serviceId =
      service._id;

    conversation.status = "open";

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        `${service.name} currently requires salon confirmation. ` +
        `Published price: ${priceLabel(service)}. ` +
        "I have passed your request to the salon team.",
      result: {
        handoff: true,
        intent: "booking",
        serviceRequiresConsultation:
          true,
      },
    });
  }

  if (
    stylist &&
    !stylistOffersService(
      stylist,
      service._id
    )
  ) {
    stylist = null;
    session.stylistId = null;
    session.stage = "stylist";
    conversation.status =
      "collecting_details";

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        "That stylist is not currently linked to this service. Please choose another stylist or say 'any available stylist'.",
      result: {
        handoff: false,
        intent: "booking",
      },
    });
  }

  if (
    !stylist &&
    !automation.anyStylist
  ) {
    const eligible =
      eligibleStylists(
        stylists,
        service
      );

    if (eligible.length === 0) {
      handoff(
        automation,
        "no_eligible_stylist"
      );

      return finishTurn({
        conversation,
        incoming,
        now,
        persist,
        reply:
          "I could not match a stylist for this service automatically, so I will ask the salon team to help.",
        result: {
          handoff: true,
          intent: "booking",
        },
      });
    }

    session.stage = "stylist";
    conversation.status =
      "collecting_details";
    automation.lastAction =
      "collect_stylist";

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        stylistOptionsReply(
          stylists,
          service
        ),
      result: {
        handoff: false,
        intent: "booking",
      },
    });
  }

  if (!appointmentDate) {
    session.stage = "date";
    conversation.status =
      "collecting_details";
    automation.lastAction =
      "collect_date";

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        "What date would you prefer for the appointment?",
      result: {
        handoff: false,
        intent: "booking",
      },
    });
  }

  if (!timePreference) {
    session.stage = "time";
    conversation.status =
      "collecting_details";
    automation.lastAction =
      "collect_time";

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        "What time would you prefer? You can also say morning, afternoon or evening.",
      result: {
        handoff: false,
        intent: "booking",
      },
    });
  }

  let availability;

  try {
    availability =
      await findAvailability({
        service,
        selectedStylist:
          stylist,
        anyStylist:
          automation.anyStylist,
        stylists,
        date:
          appointmentDate,
        preference:
          timePreference,
        now,
        getAvailableSlots,
      });
  } catch (error) {
    handoff(
      automation,
      "availability_check_failed"
    );

    automation.lastError =
      compactText(
        error?.message ||
          "Availability check failed.",
        1000
      );

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        "I could not safely verify live availability, so I will ask the salon team to check the appointment manually.",
      result: {
        handoff: true,
        intent: "booking",
      },
    });
  }

  if (
    !availability ||
    !availability.stylist
  ) {
    session.stage = "date";
    session.appointmentTime = "";
    session.availableSlots = [];
    conversation.status =
      "collecting_details";
    automation.lastAction =
      "collect_date";

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        `I could not find an available 60-minute slot for ${service.name} on ${formatDateLabel(appointmentDate)}. ` +
        "Please send another preferred date.",
      result: {
        handoff: false,
        intent: "booking",
      },
    });
  }

  stylist =
    availability.stylist;

  session.stylistId =
    stylist._id;

  automation.anyStylist = false;

  session.appointmentDate =
    bookingDateObject(
      appointmentDate
    );

  session.duration =
    Math.max(
      1,
      Number(
        service.duration
      ) || 60
    );

  session.price =
    Math.max(
      0,
      Number(
        service.price
      ) || 0
    );

  if (availability.exact) {
    const selectedTime =
      availability.preferred[0];

    session.stage = "review";
    session.appointmentTime =
      selectedTime;
    session.availableSlots = [];
    session.confirmed = false;
    session.confirmationState =
      "pending";
    session.expiresAt =
      new Date(
        now.getTime() +
        config.sessionMinutes *
          60_000
      );

    conversation.status =
      "awaiting_confirmation";

    automation.lastAction =
      "await_customer_confirmation";

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        `I found ${service.name} with ${stylistName(stylist)} on ` +
        `${formatDateLabel(appointmentDate)} at ${selectedTime}. ` +
        `${priceLabel(service)}. ` +
        "Reply CONFIRM to send this slot request to the salon team for final confirmation.",
      result: {
        handoff: false,
        intent: "booking",
        bookingReady: true,
      },
    });
  }

  const offeredSlots =
    availability.preferred
      .slice(0, 3);

  if (offeredSlots.length === 0) {
    session.stage = "date";
    session.appointmentTime = "";
    session.availableSlots = [];
    conversation.status =
      "collecting_details";

    return finishTurn({
      conversation,
      incoming,
      now,
      persist,
      reply:
        `I could not find a suitable ${timePreference} slot on ${formatDateLabel(appointmentDate)}. ` +
        "Please send another preferred date or time.",
      result: {
        handoff: false,
        intent: "booking",
      },
    });
  }

  session.stage = "time";
  session.appointmentTime = "";
  session.availableSlots =
    offeredSlots;
  session.confirmed = false;
  session.confirmationState =
    "pending";
  conversation.status =
    "collecting_details";
  automation.lastAction =
    "collect_time";

  const preferenceWasExact =
    /^\d{2}:\d{2}$/
      .test(
        timePreference
      );

  return finishTurn({
    conversation,
    incoming,
    now,
    persist,
    reply:
      (
        preferenceWasExact
          ? "That exact time is not available. "
          : ""
      ) +
      `Available times with ${stylistName(stylist)} on ${formatDateLabel(appointmentDate)} include ` +
      `${offeredSlots.join(", ")}. Reply with the time you prefer.`,
    result: {
      handoff: false,
      intent: "booking",
      offeredSlots,
    },
  });
}


export async function processWhatsAppBotMessage(
  {
    conversationId,
    incoming,
  },
  {
    environment =
      process.env,
    now =
      new Date(),
  } = {}
) {
  const config =
    getWhatsAppBotConfig(
      environment
    );

  if (!config.enabled) {
    return {
      processed: false,
      skipped: "bot_disabled",
    };
  }

  const conversation =
    await WhatsAppConversation
      .findById(
        conversationId
      );

  if (!conversation) {
    return {
      processed: false,
      skipped:
        "conversation_not_found",
    };
  }

  const [
    services,
    stylists,
  ] =
    await Promise.all([
      Service.find({
        active: {
          $ne: false,
        },
      })
        .sort({
          category: 1,
          name: 1,
        })
        .lean(),

      Stylist.find({
        isActive: {
          $ne: false,
        },
        profilePublished: {
          $ne: false,
        },
      })
        .sort({
          displayOrder: 1,
          firstName: 1,
          lastName: 1,
        })
        .lean(),
    ]);

  try {
    return await runWhatsAppBotTurn(
      {
        conversation,
        incoming,
        services,
        stylists,
      },
      {
        environment,
        now,
      }
    );
  } catch (error) {
    const {
      automation,
    } =
      ensureState(
        conversation
      );

    handoff(
      automation,
      "bot_processing_error"
    );

    automation.lastError =
      compactText(
        error?.message ||
          "WhatsApp bot processing failed.",
        1000
      );

    automation.lastAction =
      "handoff";

    markProcessed(
      automation,
      incoming,
      now
    );

    await conversation.save();

    console.error(
      "WhatsApp bot processing failed.",
      {
        conversationId:
          String(
            conversationId
          ),
        code:
          compactText(
            error?.code ||
              error?.name ||
              "WHATSAPP_BOT_ERROR",
            120
          ),
      }
    );

    return {
      processed: false,
      handoff: true,
      error: true,
    };
  }
}


export default {
  getWhatsAppBotConfig,
  normaliseBotDate,
  normaliseBotTime,
  processWhatsAppBotMessage,
  runWhatsAppBotTurn,
  selectPreferredSlots,
};
