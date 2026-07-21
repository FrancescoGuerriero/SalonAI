import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import Card from "../ui/Card";

const CUSTOMER_TYPE_CONFIG = {
  new: {
    label: "New Customers",
    color: "#16a34a",
  },

  returning: {
    label: "Returning Customers",
    color: "#7c3aed",
  },
};

function normalizeData(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      const type = item.type ?? "unknown";
      const config = CUSTOMER_TYPE_CONFIG[type];

      return {
        type,
        label:
          item.label ??
          config?.label ??
          "Other Customers",
        count: Number(item.count) || 0,
        color: config?.color ?? "#94a3b8",
      };
    })
    .filter((item) => item.count > 0);
}

function calculatePercentage(value, total) {
  if (!total) {
    return 0;
  }

  return Number(((value / total) * 100).toFixed(1));
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0]?.payload;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg">
      <p className="font-medium text-gray-900">
        {item?.label ?? "Customers"}
      </p>

      <p className="mt-1 text-sm text-gray-600">
        {item?.count ?? 0} customer
        {item?.count === 1 ? "" : "s"}
      </p>

      <p className="text-xs text-gray-500">
        {item?.percentage ?? 0}% of active customers
      </p>
    </div>
  );
}

export default function NewVsReturningChart({
  data = [],
  loading = false,
}) {
  const normalizedData = normalizeData(data);

  const totalCustomers = normalizedData.reduce(
    (total, item) => total + item.count,
    0
  );

  const chartData = normalizedData.map((item) => ({
    ...item,
    percentage: calculatePercentage(
      item.count,
      totalCustomers
    ),
  }));

  return (
    <Card
      title="New vs Returning Customers"
      subtitle="Customer mix for the selected period"
    >
      {loading ? (
        <div className="h-80 animate-pulse rounded-lg bg-gray-100" />
      ) : chartData.length === 0 ? (
        <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-gray-300">
          <p className="text-sm text-gray-500">
            No customer retention data is available.
          </p>
        </div>
      ) : (
        <>
          <div className="relative h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={4}
                  stroke="none"
                >
                  {chartData.map((item) => (
                    <Cell
                      key={item.type}
                      fill={item.color}
                    />
                  ))}
                </Pie>

                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900">
                {totalCustomers}
              </span>

              <span className="text-sm text-gray-500">
                Customers
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {chartData.map((item) => (
              <div
                key={item.type}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor: item.color,
                    }}
                  />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {item.label}
                    </p>

                    <p className="text-xs text-gray-500">
                      {item.percentage}% of active customers
                    </p>
                  </div>
                </div>

                <span className="text-lg font-bold text-gray-900">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}