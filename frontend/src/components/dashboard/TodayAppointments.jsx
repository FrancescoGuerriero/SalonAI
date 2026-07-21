import Card from "../ui/Card";

function formatStatus(status = "") {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function getAppointmentTime(appointment) {
  if (appointment.appointmentTime) {
    return appointment.appointmentTime;
  }

  if (!appointment.appointmentDate) {
    return "Time not set";
  }

  const date = new Date(appointment.appointmentDate);

  if (Number.isNaN(date.getTime())) {
    return "Time not set";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function TodayAppointments({
  appointments = [],
  loading = false,
}) {
  return (
    <Card
      title="Today's Appointments"
      subtitle={`${appointments.length} appointment${
        appointments.length === 1 ? "" : "s"
      }`}
    >
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-14 animate-pulse rounded bg-gray-100"
            />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <p className="py-8 text-center text-gray-500">
          No appointments today.
        </p>
      ) : (
        <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
          {appointments.map((appointment) => (
            <div
              key={appointment._id}
              className="flex justify-between gap-4 border-b border-gray-100 pb-3 last:border-b-0"
            >
              <div className="min-w-0">
                <h3 className="truncate font-medium text-gray-900">
                  {appointment.customer?.fullName ??
                    appointment.customer?.name ??
                    "Customer"}
                </h3>

                <p className="truncate text-sm text-gray-500">
                  {appointment.service?.name ??
                    "Service not assigned"}
                </p>

                {appointment.stylist ? (
                  <p className="mt-1 truncate text-xs text-gray-400">
                    Stylist:{" "}
                    {appointment.stylist.fullName ??
                      appointment.stylist.name ??
                      "Assigned stylist"}
                  </p>
                ) : null}
              </div>

              <div className="shrink-0 text-right">
                <p className="font-medium text-gray-900">
                  {getAppointmentTime(appointment)}
                </p>

                <p className="text-sm text-gray-500">
                  {formatStatus(appointment.status)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
