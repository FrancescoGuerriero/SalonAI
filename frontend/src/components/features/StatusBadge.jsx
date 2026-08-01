const classes = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-yellow-100 text-yellow-800",
  queued: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  pending: "bg-yellow-100 text-yellow-800",
  pending_payment:
    "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  sent: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  opened: "bg-purple-100 text-purple-800",
  responded: "bg-emerald-100 text-emerald-800",
  completed: "bg-green-100 text-green-800",
  paid: "bg-green-100 text-green-800",
  active: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  partially_failed: "bg-orange-100 text-orange-800",
  cancelled: "bg-red-100 text-red-800",
  no_show: "bg-orange-100 text-orange-800",
  waiting: "bg-blue-100 text-blue-800",
  notified: "bg-purple-100 text-purple-800",
  booked: "bg-green-100 text-green-800",
  expired: "bg-gray-100 text-gray-700",
};

export default function StatusBadge({
  status,
}) {
  const value = String(status || "unknown");

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        classes[value] ||
        "bg-gray-100 text-gray-700"
      }`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
