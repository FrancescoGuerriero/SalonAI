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
  BellRing,
  Cake,
  Gift,
  Megaphone,
  MessageCircle,
  RefreshCcw,
  UserRoundCheck,
} from "lucide-react";

import Card from "../ui/Card";

const CAMPAIGN_CONFIG = {
  dormant_customer: {
    label: "Dormant Customers",
    colour: "#2563eb",
    icon: UserRoundCheck,
  },

  appointment_reminder: {
    label: "Reminders",
    colour: "#7c3aed",
    icon: BellRing,
  },

  follow_up: {
    label: "Follow-ups",
    colour: "#059669",
    icon: RefreshCcw,
  },

  promotion: {
    label: "Promotions",
    colour: "#ea580c",
    icon: Megaphone,
  },

  birthday: {
    label: "Birthdays",
    colour: "#db2777",
    icon: Cake,
  },

  general: {
    label: "General",
    colour: "#4f46e5",
    icon: MessageCircle,
  },
};

const CAMPAIGN_ORDER = [
  "dormant_customer",
  "appointment_reminder",
  "follow_up",
  "promotion",
  "birthday",
  "general",
];

function formatCampaignLabel(campaignType) {
  return (
    CAMPAIGN_CONFIG[campaignType]?.label ||
    String(campaignType || "General")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) =>
        character.toUpperCase()
      )
  );
}

function normalizeCampaignData(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      const campaignType =
        item?.campaignType ||
        item?.campaign ||
        item?._id ||
        item?.name ||
        "general";

      const total = Number(
        item?.count ??
          item?.total ??
          item?.value ??
          item?.contacts ??
          0
      );

      const sent = Number(
        item?.sent ??
          item?.sentCount ??
          item?.messagesSent ??
          0
      );

      const responded = Number(
        item?.responded ??
          item?.responseCount ??
          item?.responses ??
          0
      );

      return {
        campaignType,
        name: formatCampaignLabel(campaignType),
        total: Number.isFinite(total) ? total : 0,
        sent: Number.isFinite(sent) ? sent : 0,
        responded: Number.isFinite(responded)
          ? responded
          : 0,
        colour:
          CAMPAIGN_CONFIG[campaignType]?.colour ||
          "#64748b",
      };
    })
    .filter(
      (item) =>
        item.total > 0 ||
        item.sent > 0 ||
        item.responded > 0
    )
    .sort((firstItem, secondItem) => {
      const firstPosition = CAMPAIGN_ORDER.indexOf(
        firstItem.campaignType
      );

      const secondPosition = CAMPAIGN_ORDER.indexOf(
        secondItem.campaignType
      );

      const normalizedFirstPosition =
        firstPosition === -1
          ? CAMPAIGN_ORDER.length
          : firstPosition;

      const normalizedSecondPosition =
        secondPosition === -1
          ? CAMPAIGN_ORDER.length
          : secondPosition;

      return (
        normalizedFirstPosition -
        normalizedSecondPosition
      );
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

  return (
    <div className="min-w-44 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
      <p className="font-semibold text-gray-900">
        {item?.name}
      </p>

      <div className="mt-2 space-y-1 text-sm">
        <div className="flex items-center justify-between gap-6">
          <span className="text-gray-500">
            Total contacts
          </span>

          <span className="font-semibold text-gray-900">
            {Number(item?.total || 0).toLocaleString(
              "en-GB"
            )}
          </span>
        </div>

        {Number(item?.sent || 0) > 0 ? (
          <div className="flex items-center justify-between gap-6">
            <span className="text-gray-500">
              Sent
            </span>

            <span className="font-semibold text-gray-900">
              {Number(item.sent).toLocaleString(
                "en-GB"
              )}
            </span>
          </div>
        ) : null}

        {Number(item?.responded || 0) > 0 ? (
          <div className="flex items-center justify-between gap-6">
            <span className="text-gray-500">
              Responses
            </span>

            <span className="font-semibold text-gray-900">
              {Number(item.responded).toLocaleString(
                "en-GB"
              )}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-5 py-7">
      {[72, 91, 61, 80, 48, 67].map(
        (width, index) => (
          <div
            key={`${width}-${index}`}
            className="space-y-2"
          >
            <div className="h-4 w-28 animate-pulse rounded bg-gray-100" />

            <div className="h-8 overflow-hidden rounded bg-gray-100">
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
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
        <Gift
          className="text-orange-600"
          size={23}
        />
      </div>

      <h3 className="mt-4 font-semibold text-gray-900">
        No campaign activity
      </h3>

      <p className="mt-2 max-w-sm text-sm text-gray-500">
        Campaign analytics will appear after customer
        communications have been recorded.
      </p>
    </div>
  );
}

function CampaignSummary({ data }) {
  const totalContacts = data.reduce(
    (total, item) => total + item.total,
    0
  );

  return (
    <div className="mt-5 grid gap-3 border-t border-gray-100 pt-5 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((item) => {
        const Icon =
          CAMPAIGN_CONFIG[item.campaignType]?.icon ||
          MessageCircle;

        const percentage =
          totalContacts > 0
            ? (item.total / totalContacts) * 100
            : 0;

        return (
          <div
            key={item.campaignType}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm"
              style={{
                color: item.colour,
              }}
            >
              <Icon size={19} />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-800">
                {item.name}
              </p>

              <p className="mt-0.5 text-xs text-gray-500">
                {item.total.toLocaleString("en-GB")}{" "}
                contact
                {item.total === 1 ? "" : "s"} ·{" "}
                {percentage.toFixed(1)}%
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CommunicationCampaignChart({
  data = [],
  loading = false,
}) {
  const normalizedData =
    normalizeCampaignData(data);

  return (
    <Card
      title="Contacts by Campaign"
      subtitle="Customer communication activity by campaign type"
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
                margin={{
                  top: 10,
                  right: 20,
                  bottom: 50,
                  left: 0,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={75}
                  tick={{
                    fontSize: 11,
                    fill: "#4b5563",
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{
                    fontSize: 12,
                    fill: "#6b7280",
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
                  dataKey="total"
                  name="Contacts"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={54}
                >
                  {normalizedData.map((item) => (
                    <Cell
                      key={item.campaignType}
                      fill={item.colour}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <CampaignSummary data={normalizedData} />
        </>
      )}
    </Card>
  );
}