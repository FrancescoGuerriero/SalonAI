import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Activity,
  CheckCheck,
  CircleAlert,
  Clock,
  Eye,
  MessageSquareReply,
  Send,
  XCircle,
} from "lucide-react";

import Card from "../ui/Card";

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    colour: "#6b7280",
    icon: Clock,
  },

  queued: {
    label: "Queued",
    colour: "#ca8a04",
    icon: Clock,
  },

  sent: {
    label: "Sent",
    colour: "#2563eb",
    icon: Send,
  },

  delivered: {
    label: "Delivered",
    colour: "#16a34a",
    icon: CheckCheck,
  },

  opened: {
    label: "Opened",
    colour: "#7c3aed",
    icon: Eye,
  },

  responded: {
    label: "Responded",
    colour: "#059669",
    icon: MessageSquareReply,
  },

  failed: {
    label: "Failed",
    colour: "#dc2626",
    icon: CircleAlert,
  },

  cancelled: {
    label: "Cancelled",
    colour: "#ea580c",
    icon: XCircle,
  },
};

const STATUS_ORDER = [
  "draft",
  "queued",
  "sent",
  "delivered",
  "opened",
  "responded",
  "failed",
  "cancelled",
];

function formatStatusLabel(status) {
  return (
    STATUS_CONFIG[status]?.label ||
    String(status || "Unknown")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) =>
        character.toUpperCase()
      )
  );
}

function normalizeStatusData(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  const normalizedData = data
    .map((item) => {
      const status =
        item?.status ||
        item?._id ||
        item?.name ||
        "unknown";

      const value = Number(
        item?.count ??
          item?.total ??
          item?.value ??
          0
      );

      return {
        status,
        name: formatStatusLabel(status),
        value: Number.isFinite(value) ? value : 0,
        colour:
          STATUS_CONFIG[status]?.colour ||
          "#64748b",
      };
    })
    .filter((item) => item.value > 0);

  return normalizedData.sort((firstItem, secondItem) => {
    const firstIndex = STATUS_ORDER.indexOf(
      firstItem.status
    );

    const secondIndex = STATUS_ORDER.indexOf(
      secondItem.status
    );

    const normalizedFirstIndex =
      firstIndex === -1
        ? STATUS_ORDER.length
        : firstIndex;

    const normalizedSecondIndex =
      secondIndex === -1
        ? STATUS_ORDER.length
        : secondIndex;

    return normalizedFirstIndex - normalizedSecondIndex;
  });
}

function CustomTooltip({
  active,
  payload,
}) {
  if (
    !active ||
    !Array.isArray(payload) ||
    payload.length === 0
  ) {
    return null;
  }

  const item = payload[0]?.payload;

  const value = Number(item?.value) || 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-gray-900">
        {item?.name}
      </p>

      <p className="mt-1 text-sm text-gray-600">
        {value.toLocaleString("en-GB")} contact
        {value === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4 py-6">
      {[85, 70, 60, 48, 38, 28].map(
        (width, index) => (
          <div
            key={`${width}-${index}`}
            className="flex items-center gap-4"
          >
            <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />

            <div className="h-8 flex-1 overflow-hidden rounded bg-gray-100">
              <div
                className="h-full animate-pulse rounded bg-gray-200"
                style={{
                  width: `${width}%`,
                }}
              />
            </div>
          </div>
        )
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-80 flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
        <Activity
          className="text-blue-600"
          size={23}
        />
      </div>

      <h3 className="mt-4 font-semibold text-gray-900">
        No status data
      </h3>

      <p className="mt-2 max-w-sm text-sm text-gray-500">
        Communication status activity will appear after
        customer contact records have been created.
      </p>
    </div>
  );
}

function StatusLegend({ data }) {
  return (
    <div className="mt-5 flex flex-wrap gap-3 border-t border-gray-100 pt-4">
      {data.map((item) => {
        const Icon =
          STATUS_CONFIG[item.status]?.icon ||
          Activity;

        return (
          <div
            key={item.status}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
          >
            <Icon
              size={15}
              style={{
                color: item.colour,
              }}
            />

            <span className="text-xs font-semibold text-gray-700">
              {item.name}
            </span>

            <span className="text-xs font-bold text-gray-900">
              {item.value.toLocaleString("en-GB")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function CommunicationStatusChart({
  data = [],
  loading = false,
}) {
  const normalizedData =
    normalizeStatusData(data);

  return (
    <Card
      title="Contacts by Status"
      subtitle="Current communication progress and outcomes"
    >
      {loading ? (
        <LoadingState />
      ) : normalizedData.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="h-80">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={normalizedData}
                layout="vertical"
                margin={{
                  top: 10,
                  right: 25,
                  bottom: 10,
                  left: 15,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                />

                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{
                    fontSize: 12,
                    fill: "#6b7280",
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  width={85}
                  tick={{
                    fontSize: 12,
                    fill: "#4b5563",
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{
                    fill: "#f3f4f6",
                  }}
                />

                <Bar
                  dataKey="value"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={32}
                >
                  {normalizedData.map((item) => (
                    <Cell
                      key={item.status}
                      fill={item.colour}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <StatusLegend data={normalizedData} />
        </>
      )}
    </Card>
  );
}