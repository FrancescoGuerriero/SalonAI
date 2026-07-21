import {
  BadgePoundSterling,
  CalendarCheck,
  Repeat2,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";

import StatCard from "../ui/StatCard";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-GB").format(
    Number(value) || 0
  );
}

function formatPercentage(value) {
  return `${decimalFormatter.format(
    Number(value) || 0
  )}%`;
}

export default function CustomerRetentionStats({
  summary = {},
  loading = false,
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        loading={loading}
        title="Active Customers"
        value={formatNumber(summary.activeCustomers)}
        icon={Users}
        iconColor="blue"
      />

      <StatCard
        loading={loading}
        title="New Customers"
        value={formatNumber(summary.newCustomers)}
        icon={UserPlus}
        iconColor="green"
      />

      <StatCard
        loading={loading}
        title="Returning Customers"
        value={formatNumber(summary.returningCustomers)}
        icon={Repeat2}
        iconColor="purple"
      />

      <StatCard
        loading={loading}
        title="Retention Rate"
        value={formatPercentage(summary.retentionRate)}
        icon={CalendarCheck}
        iconColor={
          Number(summary.retentionRate) >= 60
            ? "green"
            : Number(summary.retentionRate) >= 30
              ? "orange"
              : "red"
        }
      />

      <StatCard
        loading={loading}
        title="Average Visits"
        value={decimalFormatter.format(
          Number(summary.averageVisitsPerCustomer) || 0
        )}
        icon={WalletCards}
        iconColor="orange"
      />

      <StatCard
        loading={loading}
        title="Revenue per Customer"
        value={formatCurrency(
          summary.averageRevenuePerCustomer
        )}
        icon={BadgePoundSterling}
        iconColor="green"
      />
    </div>
  );
}