import {
  Area,
  AreaChart,
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

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-sm font-medium text-gray-700">
        {formatDate(label)}
      </p>

      <p className="mt-1 text-sm font-semibold text-blue-600">
        {formatCurrency(payload[0]?.value)}
      </p>
    </div>
  );
}

export default function RevenueChart({
  data = [],
  loading = false,
  days = 30,
  onDaysChange,
}) {
  const normalizedData = Array.isArray(data)
    ? data.map((item) => ({
        date: item.date,
        total: Number(item.total) || 0,
      }))
    : [];

  return (
    <Card
      title="Revenue"
      subtitle={`Revenue over the last ${days} days`}
      actions={
        onDaysChange ? (
          <select
            value={days}
            onChange={(event) =>
              onDaysChange(Number(event.target.value))
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            aria-label="Revenue period"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        ) : null
      }
    >
      {loading ? (
        <div className="h-80 animate-pulse rounded-lg bg-gray-100" />
      ) : normalizedData.length === 0 ? (
        <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-gray-300">
          <p className="text-sm text-gray-500">
            No revenue data is available for this period.
          </p>
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={normalizedData}
              margin={{
                top: 10,
                right: 10,
                left: 0,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient
                  id="revenueGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="#2563eb"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="95%"
                    stopColor="#2563eb"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                tick={{ fontSize: 12 }}
              />

              <YAxis
                tickFormatter={(value) => `£${value}`}
                tickLine={false}
                axisLine={false}
                width={70}
                tick={{ fontSize: 12 }}
              />

              <Tooltip content={<RevenueTooltip />} />

              <Area
                type="monotone"
                dataKey="total"
                stroke="#2563eb"
                strokeWidth={3}
                fill="url(#revenueGradient)"
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
