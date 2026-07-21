import { useMemo } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  MessageCircle,
  Send,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

import Card from "../ui/Card";

function safeNumber(value) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : 0;
}

function formatLabel(value, fallback = "Unknown") {
  const text = String(value || "").trim();

  if (!text) {
    return fallback;
  }

  return text
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function formatPercentage(value) {
  return `${safeNumber(value).toFixed(1)}%`;
}

function getChannelResponseRate(channel) {
  const sent = safeNumber(
    channel?.sent ?? channel?.count
  );

  const responded = safeNumber(
    channel?.responded
  );

  if (sent <= 0) {
    return 0;
  }

  return (responded / sent) * 100;
}

function getCampaignResponseRate(campaign) {
  const sent = safeNumber(
    campaign?.sent ?? campaign?.total
  );

  const responded = safeNumber(
    campaign?.responded
  );

  if (sent <= 0) {
    return 0;
  }

  return (responded / sent) * 100;
}

function findHighestValueItem(
  items,
  valueSelector
) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return items.reduce((highestItem, item) => {
    if (!highestItem) {
      return item;
    }

    return valueSelector(item) >
      valueSelector(highestItem)
      ? item
      : highestItem;
  }, null);
}

function InsightCard({
  icon: Icon,
  title,
  value,
  description,
  tone = "blue",
}) {
  const toneClasses = {
    blue: {
      container:
        "border-blue-200 bg-blue-50",
      icon: "bg-blue-100 text-blue-700",
      value: "text-blue-900",
    },

    green: {
      container:
        "border-green-200 bg-green-50",
      icon: "bg-green-100 text-green-700",
      value: "text-green-900",
    },

    purple: {
      container:
        "border-purple-200 bg-purple-50",
      icon: "bg-purple-100 text-purple-700",
      value: "text-purple-900",
    },

    orange: {
      container:
        "border-orange-200 bg-orange-50",
      icon: "bg-orange-100 text-orange-700",
      value: "text-orange-900",
    },

    red: {
      container:
        "border-red-200 bg-red-50",
      icon: "bg-red-100 text-red-700",
      value: "text-red-900",
    },
  };

  const selectedTone =
    toneClasses[tone] ?? toneClasses.blue;

  return (
    <article
      className={`rounded-xl border p-4 ${selectedTone.container}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selectedTone.icon}`}
        >
          <Icon size={20} />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {title}
          </p>

          <p
            className={`mt-1 truncate text-xl font-bold ${selectedTone.value}`}
          >
            {value}
          </p>

          <p className="mt-2 text-sm leading-5 text-gray-600">
            {description}
          </p>
        </div>
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-36 animate-pulse rounded-xl bg-gray-100"
        />
      ))}
    </div>
  );
}

export default function CommunicationPerformanceInsights({
  summary = {},
  byChannel = [],
  byStatus = [],
  byCampaign = [],
  loading = false,
}) {
  const insights = useMemo(() => {
    const topChannel = findHighestValueItem(
      byChannel,
      (item) => safeNumber(item?.count)
    );

    const bestResponseChannel =
      findHighestValueItem(
        byChannel.filter(
          (item) =>
            safeNumber(item?.sent ?? item?.count) > 0
        ),
        getChannelResponseRate
      );

    const bestCampaign = findHighestValueItem(
      byCampaign.filter(
        (item) =>
          safeNumber(item?.sent ?? item?.total) > 0
      ),
      getCampaignResponseRate
    );

    const failedStatus = byStatus.find(
      (item) =>
        String(item?.status || item?._id) ===
        "failed"
    );

    return {
      topChannel,
      bestResponseChannel,
      bestCampaign,
      failedContacts: safeNumber(
        failedStatus?.count
      ),
    };
  }, [byChannel, byStatus, byCampaign]);

  const totalContacts = safeNumber(
    summary.total
  );

  const responseRate = safeNumber(
    summary.responseRate
  );

  const deliveryRate = safeNumber(
    summary.deliveryRate
  );

  const topChannelName = formatLabel(
    insights.topChannel?.channel ||
      insights.topChannel?._id,
    "No activity"
  );

  const topChannelCount = safeNumber(
    insights.topChannel?.count
  );

  const bestChannelName = formatLabel(
    insights.bestResponseChannel?.channel ||
      insights.bestResponseChannel?._id,
    "No responses"
  );

  const bestChannelRate = getChannelResponseRate(
    insights.bestResponseChannel
  );

  const bestCampaignName = formatLabel(
    insights.bestCampaign?.campaignType ||
      insights.bestCampaign?._id,
    "No campaign data"
  );

  const bestCampaignRate = getCampaignResponseRate(
    insights.bestCampaign
  );

  const recommendation =
    totalContacts === 0
      ? "Record customer contact activity to generate recommendations."
      : responseRate < 10
        ? "Review message wording and prioritise personalised follow-ups."
        : deliveryRate < 70
          ? "Verify customer contact details and investigate failed deliveries."
          : "Continue using the strongest channel and campaign combination.";

  return (
    <Card
      title="Communication Performance Insights"
      subtitle="Automatically generated from current communication data"
    >
      {loading ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InsightCard
              icon={MessageCircle}
              title="Most Used Channel"
              value={topChannelName}
              description={
                topChannelCount > 0
                  ? `${topChannelCount.toLocaleString(
                      "en-GB"
                    )} customer contacts were recorded through this channel.`
                  : "No communication-channel activity has been recorded."
              }
              tone="blue"
            />

            <InsightCard
              icon={TrendingUp}
              title="Best Response Channel"
              value={bestChannelName}
              description={
                insights.bestResponseChannel
                  ? `${formatPercentage(
                      bestChannelRate
                    )} of sent contacts received a response.`
                  : "There is not enough response data to compare channels."
              }
              tone="green"
            />

            <InsightCard
              icon={Users}
              title="Best Campaign"
              value={bestCampaignName}
              description={
                insights.bestCampaign
                  ? `${formatPercentage(
                      bestCampaignRate
                    )} campaign response rate.`
                  : "There is not enough campaign activity to calculate performance."
              }
              tone="purple"
            />

            <InsightCard
              icon={
                insights.failedContacts > 0
                  ? AlertTriangle
                  : CheckCircle2
              }
              title="Failed Contacts"
              value={insights.failedContacts.toLocaleString(
                "en-GB"
              )}
              description={
                insights.failedContacts > 0
                  ? "Review recipient details and failure reasons."
                  : "No failed communication records were found."
              }
              tone={
                insights.failedContacts > 0
                  ? "red"
                  : "green"
              }
            />
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Lightbulb size={20} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Sparkles
                  className="text-amber-600"
                  size={16}
                />

                <p className="font-semibold text-amber-900">
                  Recommended action
                </p>
              </div>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                {recommendation}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 border-t border-gray-100 pt-5 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
              <Send
                className="text-blue-600"
                size={19}
              />

              <div>
                <p className="text-xs text-gray-500">
                  Total contacts
                </p>

                <p className="font-bold text-gray-900">
                  {totalContacts.toLocaleString(
                    "en-GB"
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
              <CheckCircle2
                className="text-green-600"
                size={19}
              />

              <div>
                <p className="text-xs text-gray-500">
                  Delivery rate
                </p>

                <p className="font-bold text-gray-900">
                  {formatPercentage(deliveryRate)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
              <TrendingUp
                className="text-purple-600"
                size={19}
              />

              <div>
                <p className="text-xs text-gray-500">
                  Response rate
                </p>

                <p className="font-bold text-gray-900">
                  {formatPercentage(responseRate)}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}