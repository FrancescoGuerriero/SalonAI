import {
  CalendarDays,
  ClipboardList,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useState,
} from "react";

const ReceptionWorkspace = lazy(
  () =>
    import(
      "../components/appointments/ReceptionWorkspace.jsx"
    )
);

const AppointmentsOperationsPage = lazy(
  () =>
    import(
      "./AppointmentsOperationsPage.jsx"
    )
);

function LoadingPanel() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-sm font-bold text-stone-600">
      Loading appointment workspace…
    </div>
  );
}

export default function AppointmentsPage() {
  const [view, setView] =
    useState("reception");

  return (
    <div className="space-y-5">
      <div className="px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        <nav
          aria-label="Appointment workspace"
          className="inline-flex w-full max-w-xl rounded-2xl border border-stone-200 bg-white p-1 shadow-sm"
        >
          <button
            type="button"
            aria-pressed={
              view === "reception"
            }
            onClick={() =>
              setView("reception")
            }
            className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${
              view === "reception"
                ? "bg-amber-400 text-black"
                : "text-stone-700 hover:bg-stone-100"
            }`}
          >
            <ClipboardList size={17} />
            Reception
          </button>

          <button
            type="button"
            aria-pressed={
              view === "appointments"
            }
            onClick={() =>
              setView("appointments")
            }
            className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${
              view === "appointments"
                ? "bg-amber-400 text-black"
                : "text-stone-700 hover:bg-stone-100"
            }`}
          >
            <CalendarDays size={17} />
            All appointments
          </button>
        </nav>
      </div>

      <Suspense
        fallback={<LoadingPanel />}
      >
        {view === "reception" ? (
          <div className="px-4 pb-6 sm:px-6 lg:px-8">
            <ReceptionWorkspace
              onOpenAllAppointments={() =>
                setView(
                  "appointments"
                )
              }
            />
          </div>
        ) : (
          <AppointmentsOperationsPage />
        )}
      </Suspense>
    </div>
  );
}
