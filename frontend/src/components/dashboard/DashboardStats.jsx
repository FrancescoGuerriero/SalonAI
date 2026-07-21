import {
  CalendarDays,
  CheckCircle,
  CreditCard,
  DollarSign,
  Scissors,
  Users,
} from "lucide-react";

import StatCard from "../ui/StatCard";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

export default function DashboardStats({
  stats = {},
  loading = false,
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        loading={loading}
        title="Revenue Today"
        value={currencyFormatter.format(
          Number(stats.revenueToday) || 0
        )}
        icon={DollarSign}
        iconColor="green"
      />

      <StatCard
        loading={loading}
        title="Appointments"
        value={stats.appointmentsToday ?? 0}
        icon={CalendarDays}
        iconColor="purple"
      />

      <StatCard
        loading={loading}
        title="Customers"
        value={stats.customers ?? 0}
        icon={Users}
        iconColor="blue"
      />

      <StatCard
        loading={loading}
        title="Stylists"
        value={stats.stylists ?? 0}
        icon={Scissors}
        iconColor="orange"
      />

      <StatCard
        loading={loading}
        title="Completed"
        value={stats.completedAppointments ?? 0}
        icon={CheckCircle}
        iconColor="green"
      />

      <StatCard
        loading={loading}
        title="Pending Payments"
        value={currencyFormatter.format(
          Number(stats.pendingPayments) || 0
        )}
        icon={CreditCard}
        iconColor="red"
      />
    </div>
  );
}
