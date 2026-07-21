import {
  AlertTriangle,
  Bell,
  Clock,
  PackageSearch,
} from "lucide-react";

import Card from "../ui/Card";

function AlertRow({
  icon: Icon,
  iconClass,
  backgroundClass,
  title,
  description,
  value,
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-200 p-4">
      <div className={`rounded-full p-3 ${backgroundClass}`}>
        <Icon className={iconClass} size={22} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900">
          {title}
        </p>

        <p className="text-sm text-gray-500">
          {description}
        </p>
      </div>

      <span className={`text-2xl font-bold ${iconClass}`}>
        {value}
      </span>
    </div>
  );
}

export default function DashboardAlerts({
  alerts = {},
  loading = false,
}) {
  if (loading) {
    return (
      <Card
        title="Dashboard Alerts"
        subtitle="Requires attention"
      >
        <div className="space-y-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-20 animate-pulse rounded bg-gray-100"
            />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Dashboard Alerts"
      subtitle="Requires attention"
    >
      <div className="space-y-4">
        <AlertRow
          icon={AlertTriangle}
          iconClass="text-red-600"
          backgroundClass="bg-red-100"
          title="Overdue Appointments"
          description="Appointments requiring immediate attention"
          value={alerts.overdueAppointments ?? 0}
        />

        <AlertRow
          icon={Clock}
          iconClass="text-yellow-600"
          backgroundClass="bg-yellow-100"
          title="Pending Appointments"
          description="Appointments awaiting confirmation"
          value={alerts.pendingAppointments ?? 0}
        />

        <AlertRow
          icon={PackageSearch}
          iconClass="text-orange-600"
          backgroundClass="bg-orange-100"
          title="Low Stock Products"
          description="Products that may need restocking"
          value={alerts.lowStockProducts ?? 0}
        />

        <AlertRow
          icon={Bell}
          iconClass="text-blue-600"
          backgroundClass="bg-blue-100"
          title="Unread Notifications"
          description="Notifications not yet reviewed"
          value={alerts.unreadNotifications ?? 0}
        />
      </div>
    </Card>
  );
}
