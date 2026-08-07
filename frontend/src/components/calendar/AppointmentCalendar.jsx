import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  momentLocalizer,
} from "react-big-calendar";
import moment from "moment";

import "react-big-calendar/lib/css/react-big-calendar.css";

import { getAppointments } from "../../Services/appointmentApi.js";

const localizer = momentLocalizer(moment);

const stylistColours = {
  Emma: "#555552",
  Lisa: "#b28a20",
  Maria: "#c9a227",
  James: "#d8c395",
};

function extractAppointments(responseData) {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  if (Array.isArray(responseData?.appointments)) {
    return responseData.appointments;
  }

  if (Array.isArray(responseData?.data)) {
    return responseData.data;
  }

  if (Array.isArray(responseData?.data?.appointments)) {
    return responseData.data.appointments;
  }

  return [];
}

function getAppointmentStart(appointment) {
  const directStart =
    appointment?.startsAt ||
    appointment?.startTime ||
    appointment?.start;

  if (directStart) {
    const parsed = new Date(directStart);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const dateValue =
    appointment?.appointmentDate ||
    appointment?.date;
  const timeValue =
    appointment?.appointmentTime ||
    appointment?.time ||
    "00:00";

  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const [hours = 0, minutes = 0] = String(timeValue)
    .split(":")
    .map(Number);

  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

function getAppointmentEnd(appointment, start) {
  const directEnd =
    appointment?.endsAt ||
    appointment?.endTime ||
    appointment?.end;

  if (directEnd) {
    const parsed = new Date(directEnd);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (!start) {
    return null;
  }

  const duration = Math.max(
    1,
    Number(
      appointment?.duration ||
        appointment?.service?.duration ||
        60
    ) || 60
  );

  return new Date(start.getTime() + duration * 60_000);
}

function getStylistName(stylist) {
  if (!stylist || typeof stylist !== "object") {
    return "Unknown";
  }

  return (
    String(
      stylist.name ||
        `${stylist.firstName || ""} ${stylist.lastName || ""}`
    ).trim() || "Unknown"
  );
}

export default function AppointmentCalendar() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAppointments() {
    try {
      setLoading(true);
      setError("");

      const response = await getAppointments();
      setAppointments(extractAppointments(response.data));
    } catch (requestError) {
      console.error(requestError);
      setAppointments([]);
      setError(
        requestError.response?.data?.message ||
          "Appointments could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  const events = useMemo(() => {
    return appointments.flatMap((appointment) => {
      const start = getAppointmentStart(appointment);
      const end = getAppointmentEnd(appointment, start);

      if (!start || !end) {
        return [];
      }

      const customerName = String(
        appointment.customer?.name ||
          `${appointment.customer?.firstName || ""} ${
            appointment.customer?.lastName || ""
          }`
      ).trim();

      return [
        {
          id: appointment._id,
          title: `${customerName || "Customer"} - ${
            appointment.service?.name || "Service"
          }`,
          start,
          end,
          stylist: getStylistName(appointment.stylist),
          resource: appointment,
        },
      ];
    });
  }, [appointments]);

  function eventStyleGetter(event) {
    const colour = stylistColours[event.stylist] || "#555552";

    return {
      style: {
        backgroundColor: colour,
        borderRadius: "8px",
        border: "none",
        color: "#fff",
        padding: "2px",
      },
    };
  }

  function handleSelectEvent(event) {
    console.info("Selected appointment", event.resource);
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        Loading calendar...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        selectable
        popup
        defaultView="week"
        views={["day", "week", "month", "agenda"]}
        style={{ height: 800 }}
        eventPropGetter={eventStyleGetter}
        onSelectEvent={handleSelectEvent}
      />
    </div>
  );
}
