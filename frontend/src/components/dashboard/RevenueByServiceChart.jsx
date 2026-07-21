import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import Card from "../ui/Card";

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#db2777",
];

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0]?.payload;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg">
      <p className="font-medium text-gray-900">
        {item?.name ?? "Service"}
      </p>

      <p className="mt-1 text-sm text-gray-600">
        {currencyFormatter.format(item?.revenue ?? 0)}
      </p>

      <p className="text-xs text-gray-500">
        {item?.appointments ?? 0} appointment
        {item?.appointments === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export default function RevenueByServiceChart({
  data = [],
  loading = false,
}) {
  const chartData = Array.isArray(data)
    ? data
        .map((item, index) => ({
          id: item.serviceId ?? item._id ?? index,
          name: item._id ?? item.name ?? "Service",
          revenue: Number(item.revenue) || 0,
          appointments: Number(item.appointments) || 0,
          color: COLORS[index % COLORS.length],
        }))
        .filter((item) => item.revenue > 0)
    : [];

  return (
    <Card
      title="Revenue by Service"
      subtitle="Revenue contribution by service"
    >
      {loading ? (
        <div className="h-80 animate-pulse rounded bg-gray-100" />
      ) : chartData.length === 0 ? (
        <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-gray-300">
          <p className="text-sm text-gray-500">
            No service revenue data is available.
          </p>
        </div>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="revenue"
                nameKey="name"
                innerRadius={55}
                outerRadius={105}
                paddingAngle={2}
                stroke="none"
              >
                {chartData.map((item) => (
                  <Cell
                    key={item.id}
                    fill={item.color}
                  />
                ))}
              </Pie>

              <Tooltip content={<CustomTooltip />} />

              <Legend
                formatter={(value) => (
                  <span className="text-sm text-gray-600">
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
