import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import {
  Mail,
  MessageCircle,
  Phone,
  Smartphone,
} from "lucide-react";

import Card from "../ui/Card";

const CHANNEL_CONFIG = {
  email: {
    label: "Email",
    icon: Mail,
  },
  sms: {
    label: "SMS",
    icon: Smartphone,
  },
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
  },
  phone: {
    label: "Phone",
    icon: Phone,
  },
  in_app: {
    label: "In App",
    icon: MessageCircle,
  },
};

const CHART_COLOURS = [
  "#2563eb",
  "#7c3aed",
  "#16a34a",
  "#ea580c",
  "#4f46e5",
];

function normalizeChannelData(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      const channel =
        item.channel ||
        item._id ||
        item.name ||
        "unknown";

      const count = Number(
        item.count ??
          item.total ??
          item.value ??
          0
      );

      return {
        channel,
        name:
          CHANNEL_CONFIG[channel]?.label ||
          channel
            .replaceAll("_", " ")
            .replace(/\b\w/g, (character) =>
              character.toUpperCase()
            ),
        value: count,
      };
    })
    .filter((item) => item.value > 0);
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

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-gray-900">
        {item?.name}
      </p>

      <p className="mt-1 text-sm text-gray-600">
        {Number(item?.value || 0).toLocaleString(
          "en-GB"
        )}{" "}
        contact
        {Number(item?.value || 0) === 1
          ? ""
          : "s"}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-80 items-center justify-center">
      <div className="h-48 w-48 animate-pulse rounded-full bg-gray-100" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-80 flex-col items-center justify-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
        <MessageCircle
          className="text-indigo-600"
          size={23}
        />
      </div>

      <h3 className="mt-4 font-semibold text-gray-900">
        No communication data
      </h3>

      <p className="mt-2 max-w-sm text-sm text-gray-500">
        Contact-channel activity will appear after
        customer communications have been recorded.
      </p>
    </div>
  );
}

export default function CommunicationChannelChart({
  data = [],
  loading = false,
}) {
  const normalizedData =
    normalizeChannelData(data);

  return (
    <Card
      title="Contacts by Channel"
      subtitle="Communication-channel distribution"
    >
      {loading ? (
        <LoadingState />
      ) : normalizedData.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="h-80">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <PieChart>
              <Pie
                data={normalizedData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
              >
                {normalizedData.map(
                  (item, index) => (
                    <Cell
                      key={`${item.channel}-${index}`}
                      fill={
                        CHART_COLOURS[
                          index %
                            CHART_COLOURS.length
                        ]
                      }
                    />
                  )
                )}
              </Pie>

              <Tooltip
                content={<CustomTooltip />}
              />

              <Legend
                verticalAlign="bottom"
                iconType="circle"
                formatter={(value) => (
                  <span className="text-sm text-gray-700">
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