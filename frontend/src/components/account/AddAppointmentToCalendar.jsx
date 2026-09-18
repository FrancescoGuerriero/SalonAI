import {
  CalendarPlus,
  Download,
} from "lucide-react";

import {
  calendarEventFromAppointment,
  canAddAppointmentToCalendar,
  downloadAppointmentIcs,
  googleCalendarUrl,
  outlookCalendarUrl,
} from "../../utils/customerCalendar.js";

function openExternal(
  url
) {
  window.open(
    url,
    "_blank",
    "noopener,noreferrer"
  );
}

export default function AddAppointmentToCalendar({
  appointment,
}) {
  if (
    !canAddAppointmentToCalendar(
      appointment
    )
  ) {
    return null;
  }

  let event;

  try {
    event =
      calendarEventFromAppointment(
        appointment
      );
  } catch {
    return null;
  }

  return (
    <div
      className="account-calendar-actions"
      aria-label="Add appointment to your calendar"
    >
      <span className="account-calendar-actions-label">
        <CalendarPlus
          size={15}
          aria-hidden="true"
        />
        Add to calendar
      </span>

      <div className="account-calendar-actions-buttons">
        <button
          type="button"
          className="account-calendar-button"
          onClick={() =>
            openExternal(
              googleCalendarUrl(
                event
              )
            )
          }
        >
          Google
        </button>

        <button
          type="button"
          className="account-calendar-button"
          onClick={() =>
            openExternal(
              outlookCalendarUrl(
                event
              )
            )
          }
        >
          Outlook
        </button>

        <button
          type="button"
          className="account-calendar-button"
          onClick={() =>
            downloadAppointmentIcs(
              event
            )
          }
        >
          <Download
            size={14}
            aria-hidden="true"
          />
          .ics
        </button>
      </div>
    </div>
  );
}
