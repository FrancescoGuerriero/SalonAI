import {
  lazy,
  Suspense,
  useState,
} from "react";

import AppointmentCalendar from "../components/calendar/AppointmentCalendar";

const StaffCalendarConnections = lazy(
  () =>
    import(
      "../components/calendar/StaffCalendarConnections.jsx"
    )
);

export default function CalendarPage() {
  const [
    showConnections,
    setShowConnections,
  ] = useState(false);

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Appointment Calendar
          </h1>

          <p className="mt-1 text-gray-500">
            Manage appointments, stylists and schedules.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-black hover:border-amber-400"
          aria-expanded={
            showConnections
          }
          aria-controls="external-calendar-connections"
          onClick={() =>
            setShowConnections(
              (current) =>
                !current
            )
          }
        >
          {showConnections
            ? "Hide external calendars"
            : "Manage external calendars"}
        </button>
      </div>

      {showConnections ? (
        <div
          id="external-calendar-connections"
        >
          <Suspense
            fallback={
              <section
                className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-600 shadow-sm"
                role="status"
              >
                Loading calendar connections…
              </section>
            }
          >
            <StaffCalendarConnections />
          </Suspense>
        </div>
      ) : null}

      <AppointmentCalendar />
    </div>
  );
}
