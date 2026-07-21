import React from "react";
import AppointmentCalendar from "../components/calendar/AppointmentCalendar";

export default function CalendarPage() {
  return (
    <div className="p-6">

      <div className="flex justify-between items-center mb-6">

        <div>
          <h1 className="text-3xl font-bold">
            Appointment Calendar
          </h1>

          <p className="text-gray-500 mt-1">
            Manage appointments, stylists and schedules.
          </p>
        </div>

      </div>

      <AppointmentCalendar />

    </div>
  );
}