import {
  CalendarCheck,
  CheckCircle,
  Clock,
  PlayCircle,
  User,
  XCircle,
} from "lucide-react";

import Card from "../ui/Card";

const statusConfig = {
  pending: {
    icon: Clock,
    iconClass: "text-yellow-600",
    backgroundClass: "bg-yellow-100",
  },
  confirmed: {
    icon: CalendarCheck,
    iconClass: "text-blue-600",
    backgroundClass: "bg-blue-100",
  },
  checked_in: {
    icon: User,
    iconClass: "text-purple-600",
    backgroundClass: "bg-purple-100",
  },
  in_progress: {
    icon: PlayCircle,
    iconClass: "text-indigo-600",
    backgroundClass: "bg-indigo-100",
  },
  completed: {
    icon: CheckCircle,
    iconClass: "text-green-600",
    backgroundClass: "bg-green-100",
  },
  cancelled: {
    icon: XCircle,
    iconClass: "text-red-600",
    backgroundClass: "bg-red-100",
  },
};

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatStatus(status = "") {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

export default function ActivityTimeline({
  activity = [],
  loading = false,
}) {
  return (
    <Card
      title="Recent Activity"
      subtitle={`${activity.length} recent update${
        activity.length === 1 ? "" : "s"
      }`}
    >
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-16 animate-pulse rounded bg-gray-100"
            />
          ))}
        </div>
      ) : activity.length === 0 ? (
        <div className="py-10 text-center text-gray-500">
          No recent activity.
        </div>
      ) : (
        <div className="max-h-[30rem] space-y-5 overflow-y-auto pr-1">
          {activity.map((item) => {
            const config =
              statusConfig[item.status] ??
              statusConfig.pending;

            const Icon = config.icon;

            return (
              <div
                key={item._id}
                className="flex gap-4"
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${config.backgroundClass}`}
                >
                  <Icon
                    size={20}
                    className={config.iconClass}
                  />
                </div>

                <div className="min-w-0 flex-1 border-b border-gray-100 pb-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="truncate font-semibold text-gray-900">
                      {item.customer?.fullName ??
                        item.customer?.name ??
                        "Customer"}
                    </h3>

                    <span className="shrink-0 text-xs text-gray-400">
                      {formatDate(item.updatedAt)}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-sm text-gray-600">
                    {item.service?.name ??
                      "Service not assigned"}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${config.backgroundClass} ${config.iconClass}`}
                    >
                      {formatStatus(item.status)}
                    </span>

                    {item.stylist ? (
                      <span className="text-xs text-gray-500">
                        Stylist:{" "}
                        {item.stylist.fullName ??
                          item.stylist.name ??
                          "Assigned stylist"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
