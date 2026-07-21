import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import Card from "../ui/Card";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "#f59e0b",
  },
  confirmed: {
    label: "Confirmed",
    color: "#2563eb",
  },
  checked_in: {
    label: "Checked In",
    color: "#7c3aed",
  },
  in_progress: {
    label: "In Progress",
    color: "#0891b2",
  },
  completed: {
    label: "Completed",
    color: "#16a34a",
  },
  cancelled: {
    label: "Cancelled",
    color: "#dc2626",
  },
  no_show: {
    label: "No Show",
    color: "#6b7280",
  },
};

function formatStatus(status = "") {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function normalizeData(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      const status = item.status ?? item._id ?? "unknown";
      const config = STATUS_CONFIG[status];

      return {
        status,
        name: config?.label ?? formatStatus(status),
        value: Number(
          item.count ??
            item.appointments ??
            item.value ??
            0
        ),
        color: config?.color ?? "#94a3b8",
      };
    })
    .filter((item) => item.value > 0);
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0]?.payload;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg">
      <p className="font-medium text-gray-900">
        {item?.name ?? "Appointments"}
      </p>

      <p className="mt-1 text-sm text-gray-600">
        {item?.value ?? 0} appointment
        {item?.value === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export default function AppointmentsByStatusChart({
  data = [],
  loading = false,
}) {
  const chartData = normalizeData(data);

  const totalAppointments = chartData.reduce(
    (total, item) => total + item.value,
    0
  );

  return (
    <Card
      title="Appointments by Status"
      subtitle="Appointment distribution for the selected period"
    >
      {loading ? (
        <div className="h-80 animate-pulse rounded-lg bg-gray-100" />
      ) : chartData.length === 0 ? (
        <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-gray-300">
          <p className="text-sm text-gray-500">
            No appointment status data is available.
          </p>
        </div>
      ) : (
        <>
          <div className="relative h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={3}
                  stroke="none"
                >
                  {chartData.map((item) => (
                    <Cell
                      key={item.status}
                      fill={item.color}
                    />
                  ))}
                </Pie>

                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900">
                {totalAppointments}
              </span>

              <span className="text-sm text-gray-500">
                Total
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {chartData.map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor: item.color,
                    }}
                  />

                  <span className="truncate text-sm text-gray-600">
                    {item.name}
                  </span>
                </div>

                <span className="text-sm font-semibold text-gray-900">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
