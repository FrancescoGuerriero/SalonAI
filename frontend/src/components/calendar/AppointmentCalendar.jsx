import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  momentLocalizer,
} from "react-big-calendar";
import moment from "moment";

import "react-big-calendar/lib/css/react-big-calendar.css";

import { getAppointments } from "../../services/appointmentApi";

const localizer = momentLocalizer(moment);

const stylistColours = {
  Emma: "#2563eb",
  Lisa: "#7c3aed",
  Maria: "#16a34a",
  James: "#ea580c",
};

export default function AppointmentCalendar() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadAppointments() {
    try {
      setLoading(true);

      const response = await getAppointments();

      setAppointments(response.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  const events = useMemo(() => {
    return appointments.map((appointment) => ({
      id: appointment._id,

      title:
        `${appointment.customer?.firstName ?? ""} ` +
        `${appointment.customer?.lastName ?? ""} - ` +
        `${appointment.service?.name ?? "Service"}`,

      start: new Date(appointment.startTime),
      end: new Date(appointment.endTime),

      stylist:
        appointment.stylist?.firstName || "Unknown",

      resource: appointment,
    }));
  }, [appointments]);

  function eventStyleGetter(event) {
    const colour =
      stylistColours[event.stylist] || "#475569";

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
    console.log(event.resource);
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

      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        selectable
        popup
        defaultView="week"
        views={[
          "day",
          "week",
          "month",
          "agenda",
        ]}
        style={{
          height: 800,
        }}
        eventPropGetter={eventStyleGetter}
        onSelectEvent={handleSelectEvent}
      />

    </div>
  );
}