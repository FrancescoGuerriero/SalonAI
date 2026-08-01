import {
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";

const config = {
  error: {
    icon: AlertTriangle,
    className:
      "border-red-200 bg-red-50 text-red-800",
  },
  success: {
    icon: CheckCircle2,
    className:
      "border-green-200 bg-green-50 text-green-800",
  },
  info: {
    icon: Info,
    className:
      "border-blue-200 bg-blue-50 text-blue-800",
  },
};

export default function FeedbackBanner({
  type = "info",
  children,
}) {
  if (!children) {
    return null;
  }

  const selected = config[type] || config.info;
  const Icon = selected.icon;

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border p-4 ${selected.className}`}
    >
      <Icon size={20} className="mt-0.5 shrink-0" />
      <div className="text-sm">{children}</div>
    </div>
  );
}
