const DEFAULT_DURATION_MINUTES =
  60;
const CALENDAR_TIME_ZONE =
  "Europe/London";

function validDate(value) {
  const date =
    value
      ? new Date(value)
      : null;

  return (
    date &&
    !Number.isNaN(
      date.getTime()
    )
  )
    ? date
    : null;
}

function appointmentStart(
  appointment
) {
  const direct =
    validDate(
      appointment?.startsAt
    );

  if (direct) {
    return direct;
  }

  const date =
    validDate(
      appointment
        ?.appointmentDate
    );

  if (!date) {
    return null;
  }

  const match =
    String(
      appointment
        ?.appointmentTime ||
        appointment?.time ||
        "00:00"
    ).match(
      /^(\d{2}):(\d{2})/
    );

  if (!match) {
    return date;
  }

  date.setHours(
    Number(match[1]),
    Number(match[2]),
    0,
    0
  );

  return date;
}

function appointmentEnd(
  appointment,
  start
) {
  const direct =
    validDate(
      appointment?.endsAt
    );

  if (direct) {
    return direct;
  }

  const duration =
    Math.max(
      1,
      Number(
        appointment?.duration ||
          appointment
            ?.service
            ?.duration ||
          DEFAULT_DURATION_MINUTES
      ) ||
        DEFAULT_DURATION_MINUTES
    );

  return new Date(
    start.getTime() +
      duration * 60_000
  );
}

function entityName(
  entity
) {
  if (
    !entity ||
    typeof entity !== "object"
  ) {
    return "";
  }

  return (
    String(
      entity.fullName ||
        entity.name ||
        ""
    ).trim() ||
    [
      entity.firstName,
      entity.lastName,
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

function utcCompact(
  value
) {
  return value
    .toISOString()
    .replace(
      /[-:]/g,
      ""
    )
    .replace(
      /\.\d{3}Z$/,
      "Z"
    );
}

function outlookDate(
  value
) {
  return value
    .toISOString()
    .replace(
      /\.\d{3}Z$/,
      "Z"
    );
}

function icsEscape(
  value
) {
  return String(
    value || ""
  )
    .replaceAll(
      "\\",
      "\\\\"
    )
    .replaceAll(
      "\n",
      "\\n"
    )
    .replaceAll(
      ",",
      "\\,"
    )
    .replaceAll(
      ";",
      "\\;"
    );
}

function safeId(
  appointment
) {
  return String(
    appointment?._id ||
      appointment?.id ||
      "appointment"
  ).replace(
    /[^a-zA-Z0-9_-]/g,
    ""
  );
}

export function calendarEventFromAppointment(
  appointment,
  {
    salonName =
      import.meta.env
        .VITE_SALON_NAME ||
      "SalonAI",
    salonAddress =
      import.meta.env
        .VITE_SALON_ADDRESS ||
      "",
  } = {}
) {
  const start =
    appointmentStart(
      appointment
    );

  if (!start) {
    throw new Error(
      "Appointment start time is unavailable."
    );
  }

  const end =
    appointmentEnd(
      appointment,
      start
    );
  const service =
    entityName(
      appointment?.service
    ) ||
    appointment?.serviceName ||
    "Salon appointment";
  const stylist =
    entityName(
      appointment?.stylist
    );
  const title =
    service +
    " · " +
    salonName;
  const description = [
    stylist
      ? "With " + stylist + "."
      : "",
    "This appointment is managed by SalonAI.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id:
      safeId(
        appointment
      ),
    title,
    description,
    location:
      salonAddress,
    start,
    end,
    timeZone:
      CALENDAR_TIME_ZONE,
  };
}

export function googleCalendarUrl(
  event
) {
  const params =
    new URLSearchParams({
      action: "TEMPLATE",
      dates:
        utcCompact(
          event.start
        ) +
        "/" +
        utcCompact(
          event.end
        ),
      stz:
        event.timeZone,
      etz:
        event.timeZone,
      text:
        event.title,
      details:
        event.description,
    });

  if (event.location) {
    params.set(
      "location",
      event.location
    );
  }

  return (
    "https://calendar.google.com/calendar/r/eventedit?" +
    params.toString()
  );
}

export function outlookCalendarUrl(
  event
) {
  const params =
    new URLSearchParams({
      path:
        "/calendar/action/compose",
      rru: "addevent",
      allday: "false",
      subject:
        event.title,
      startdt:
        outlookDate(
          event.start
        ),
      enddt:
        outlookDate(
          event.end
        ),
      body:
        event.description,
    });

  if (event.location) {
    params.set(
      "location",
      event.location
    );
  }

  return (
    "https://outlook.live.com/calendar/0/deeplink/compose?" +
    params.toString()
  );
}

export function appointmentIcs(
  event
) {
  const uid =
    "salonai-" +
    event.id +
    "@salonai";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SalonAI//Customer Appointment//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:" +
      icsEscape(uid),
    "DTSTAMP:" +
      utcCompact(
        new Date()
      ),
    "DTSTART:" +
      utcCompact(
        event.start
      ),
    "DTEND:" +
      utcCompact(
        event.end
      ),
    "SUMMARY:" +
      icsEscape(
        event.title
      ),
    "DESCRIPTION:" +
      icsEscape(
        event.description
      ),
  ];

  if (event.location) {
    lines.push(
      "LOCATION:" +
        icsEscape(
          event.location
        )
    );
  }

  lines.push(
    "END:VEVENT",
    "END:VCALENDAR",
    ""
  );

  return lines.join(
    "\r\n"
  );
}

export function downloadAppointmentIcs(
  event
) {
  const blob =
    new Blob(
      [
        appointmentIcs(
          event
        ),
      ],
      {
        type:
          "text/calendar;charset=utf-8",
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );
  const anchor =
    document.createElement(
      "a"
    );

  anchor.href = url;
  anchor.download =
    "salonai-appointment-" +
    event.id +
    ".ics";

  document.body.appendChild(
    anchor
  );
  anchor.click();
  anchor.remove();

  window.setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    0
  );
}

export function canAddAppointmentToCalendar(
  appointment
) {
  const status =
    String(
      appointment?.status ||
        ""
    )
      .trim()
      .toLowerCase()
      .replaceAll(
        "-",
        "_"
      );

  if (
    [
      "cancelled",
      "completed",
      "no_show",
    ].includes(status)
  ) {
    return false;
  }

  const start =
    appointmentStart(
      appointment
    );

  return Boolean(
    start &&
    start.getTime() >
      Date.now()
  );
}
