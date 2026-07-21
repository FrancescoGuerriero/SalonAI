import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Card from "../ui/Card";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0]?.payload;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg">
      <p className="font-medium text-gray-900">
        {label || "Stylist"}
      </p>

      <p className="mt-1 text-sm text-gray-600">
        Revenue:{" "}
        {currencyFormatter.format(item?.revenue ?? 0)}
      </p>

      <p className="text-sm text-gray-600">
        Appointments: {item?.appointments ?? 0}
      </p>

      <p className="text-sm text-gray-600">
        Average value:{" "}
        {currencyFormatter.format(
          item?.averageServiceValue ?? 0
        )}
      </p>
    </div>
  );
}

export default function TopStylistsChart({
  data = [],
  loading = false,
}) {
  const chartData = Array.isArray(data)
    ? data
        .map((item) => ({
          ...item,
          stylist:
            item.stylist?.trim() ||
            item.fullName ||
            item.name ||
            "Stylist",
          revenue: Number(item.revenue) || 0,
          appointments: Number(item.appointments) || 0,
          averageServiceValue:
            Number(item.averageServiceValue) || 0,
        }))
        .filter((item) => item.revenue > 0)
    : [];

  const chartHeight = Math.max(320, chartData.length * 54);

  return (
    <Card
      title="Top Stylists"
      subtitle="Ranked by revenue"
    >
      {loading ? (
        <div className="h-80 animate-pulse rounded bg-gray-100" />
      ) : chartData.length === 0 ? (
        <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-gray-300">
          <p className="text-sm text-gray-500">
            No stylist performance data is available.
          </p>
        </div>
      ) : (
        <div
          className="w-full"
          style={{ height: chartHeight }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
              />

              <XAxis
                type="number"
                tickFormatter={(value) => `£${value}`}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                type="category"
                dataKey="stylist"
                width={130}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip content={<CustomTooltip />} />

              <Bar
                dataKey="revenue"
                fill="#2563eb"
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
