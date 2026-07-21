import {
  CheckCheck,
  Eye,
  MailCheck,
  MessageSquareReply,
  Send,
  Users,
} from "lucide-react";

import StatCard from "../ui/StatCard";

const numberFormatter = new Intl.NumberFormat("en-GB");

const percentageFormatter = new Intl.NumberFormat(
  "en-GB",
  {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }
);

function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0);
}

function formatPercentage(value) {
  return `${percentageFormatter.format(
    Number(value) || 0
  )}%`;
}

function getRateColour(
  value,
  {
    good = 70,
    moderate = 40,
  } = {}
) {
  const numericValue = Number(value) || 0;

  if (numericValue >= good) {
    return "green";
  }

  if (numericValue >= moderate) {
    return "orange";
  }

  return "red";
}

export default function CustomerContactStats({
  summary = {},
  loading = false,
}) {
  const deliveryRate = Number(summary.deliveryRate) || 0;
  const openRate = Number(summary.openRate) || 0;
  const responseRate = Number(summary.responseRate) || 0;

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        loading={loading}
        title="Total Contacts"
        value={formatNumber(summary.total)}
        icon={Send}
        iconColor="blue"
      />

      <StatCard
        loading={loading}
        title="Customers Contacted"
        value={formatNumber(summary.uniqueCustomers)}
        icon={Users}
        iconColor="purple"
      />

      <StatCard
        loading={loading}
        title="Messages Sent"
        value={formatNumber(summary.sent)}
        icon={MailCheck}
        iconColor="green"
      />

      <StatCard
        loading={loading}
        title="Delivery Rate"
        value={formatPercentage(deliveryRate)}
        icon={CheckCheck}
        iconColor={getRateColour(deliveryRate, {
          good: 85,
          moderate: 60,
        })}
      />

      <StatCard
        loading={loading}
        title="Open Rate"
        value={formatPercentage(openRate)}
        icon={Eye}
        iconColor={getRateColour(openRate, {
          good: 50,
          moderate: 25,
        })}
      />

      <StatCard
        loading={loading}
        title="Response Rate"
        value={formatPercentage(responseRate)}
        icon={MessageSquareReply}
        iconColor={getRateColour(responseRate, {
          good: 25,
          moderate: 10,
        })}
      />
    </div>
  );
}