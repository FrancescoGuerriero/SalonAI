import clsx from "clsx";

import Card from "./Card";

const iconStyles = {
  blue: "bg-blue-100 text-blue-600",
  green: "bg-green-100 text-green-600",
  orange: "bg-orange-100 text-orange-600",
  purple: "bg-purple-100 text-purple-600",
  red: "bg-red-100 text-red-600",
  yellow: "bg-yellow-100 text-yellow-600",
  gray: "bg-gray-100 text-gray-600",
};

export default function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = "blue",
  loading = false,
}) {
  return (
    <Card bodyClassName="p-5">
      {loading ? (
        <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-500">
              {title}
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              {value}
            </p>
          </div>

          {Icon ? (
            <div
              className={clsx(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                iconStyles[iconColor] ?? iconStyles.blue
              )}
            >
              <Icon size={24} />
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
