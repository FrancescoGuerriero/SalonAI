import {
  AlertCircle,
  Ban,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Copy,
  Edit3,
  Eye,
  FileText,
  Mail,
  MessageCircle,
  MoreVertical,
  Pause,
  Phone,
  Play,
  RefreshCcw,
  RotateCcw,
  Send,
  Smartphone,
  Trash2,
  Users,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const CHANNEL_CONFIG = {
  email: {
    label: "Email",
    icon: Mail,
    badgeClass:
      "border-blue-200 bg-blue-50 text-blue-700",
    iconClass:
      "bg-blue-100 text-blue-700",
  },

  sms: {
    label: "SMS",
    icon: Smartphone,
    badgeClass:
      "border-purple-200 bg-purple-50 text-purple-700",
    iconClass:
      "bg-purple-100 text-purple-700",
  },

  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    badgeClass:
      "border-green-200 bg-green-50 text-green-700",
    iconClass:
      "bg-green-100 text-green-700",
  },

  phone: {
    label: "Phone",
    icon: Phone,
    badgeClass:
      "border-orange-200 bg-orange-50 text-orange-700",
    iconClass:
      "bg-orange-100 text-orange-700",
  },

  in_app: {
    label: "In App",
    icon: FileText,
    badgeClass:
      "border-indigo-200 bg-indigo-50 text-indigo-700",
    iconClass:
      "bg-indigo-100 text-indigo-700",
  },
};

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    badgeClass:
      "border-gray-200 bg-gray-100 text-gray-700",
    icon: FileText,
  },

  scheduled: {
    label: "Scheduled",
    badgeClass:
      "border-blue-200 bg-blue-50 text-blue-700",
    icon: CalendarClock,
  },

  queued: {
    label: "Queued",
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-700",
    icon: Clock3,
  },

  processing: {
    label: "Processing",
    badgeClass:
      "border-purple-200 bg-purple-50 text-purple-700",
    icon: RefreshCcw,
  },

  paused: {
    label: "Paused",
    badgeClass:
      "border-orange-200 bg-orange-50 text-orange-700",
    icon: Pause,
  },

  completed: {
    label: "Completed",
    badgeClass:
      "border-green-200 bg-green-50 text-green-700",
    icon: CheckCircle2,
  },

  partially_completed: {
    label: "Partially Completed",
    badgeClass:
      "border-yellow-200 bg-yellow-50 text-yellow-700",
    icon: AlertCircle,
  },

  failed: {
    label: "Failed",
    badgeClass:
      "border-red-200 bg-red-50 text-red-700",
    icon: AlertCircle,
  },

  cancelled: {
    label: "Cancelled",
    badgeClass:
      "border-gray-300 bg-gray-100 text-gray-600",
    icon: Ban,
  },
};

const CAMPAIGN_TYPE_LABELS = {
  dormant_customer: "Dormant Customer",
  appointment_reminder:
    "Appointment Reminder",
  follow_up: "Follow-up",
  promotion: "Promotion",
  birthday: "Birthday",
  general: "General",
};

const AUDIENCE_TYPE_LABELS = {
  all_customers: "All Customers",
  segments: "Customer Segments",
  selected_customers:
    "Selected Customers",
  custom_filters: "Custom Filters",
};

const SEND_MODE_LABELS = {
  draft: "Draft",
  immediate: "Immediate",
  scheduled: "Scheduled",
};

const EDITABLE_STATUSES = [
  "draft",
  "scheduled",
  "paused",
  "failed",
];

const LAUNCHABLE_STATUSES = [
  "draft",
  "scheduled",
  "failed",
];

const PAUSABLE_STATUSES = [
  "queued",
  "processing",
];

const CANCELLABLE_STATUSES = [
  "draft",
  "scheduled",
  "queued",
  "processing",
  "paused",
  "failed",
];

const DELETABLE_STATUSES = [
  "draft",
  "failed",
  "cancelled",
];

function getRecordId(record) {
  return String(
    record?._id ||
      record?.id ||
      record ||
      ""
  ).trim();
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-GB").format(
    Number(value) || 0
  );
}

function formatPercentage(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0%";
  }

  return `${number.toFixed(1)}%`;
}

function formatDateTime(value) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatRelativeSchedule(value) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown schedule";
  }

  const difference =
    date.getTime() - Date.now();

  const absoluteDifference =
    Math.abs(difference);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absoluteDifference < minute) {
    return difference >= 0
      ? "Due shortly"
      : "Due recently";
  }

  if (absoluteDifference < hour) {
    const minutes = Math.round(
      absoluteDifference / minute
    );

    return difference >= 0
      ? `In ${minutes} minute${
          minutes === 1 ? "" : "s"
        }`
      : `${minutes} minute${
          minutes === 1 ? "" : "s"
        } ago`;
  }

  if (absoluteDifference < day) {
    const hours = Math.round(
      absoluteDifference / hour
    );

    return difference >= 0
      ? `In ${hours} hour${
          hours === 1 ? "" : "s"
        }`
      : `${hours} hour${
          hours === 1 ? "" : "s"
        } ago`;
  }

  const days = Math.round(
    absoluteDifference / day
  );

  return difference >= 0
    ? `In ${days} day${
        days === 1 ? "" : "s"
      }`
    : `${days} day${
        days === 1 ? "" : "s"
      } ago`;
}

function calculatePercentage(
  numerator,
  denominator
) {
  const safeNumerator =
    Number(numerator) || 0;

  const safeDenominator =
    Number(denominator) || 0;

  if (safeDenominator <= 0) {
    return 0;
  }

  return Math.min(
    100,
    (safeNumerator / safeDenominator) * 100
  );
}

function truncateText(
  value,
  maximumLength = 165
) {
  const text = String(value || "").trim();

  if (!text) {
    return "No campaign description has been added.";
  }

  if (text.length <= maximumLength) {
    return text;
  }

  return `${text.slice(
    0,
    maximumLength
  )}…`;
}

function getCampaignTypeLabel(value) {
  return (
    CAMPAIGN_TYPE_LABELS[value] ||
    String(value || "General")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) =>
        character.toUpperCase()
      )
  );
}

function getAudienceTypeLabel(value) {
  return (
    AUDIENCE_TYPE_LABELS[value] ||
    "Campaign Audience"
  );
}

function getTemplateName(template) {
  if (!template) {
    return "Custom message";
  }

  if (typeof template === "string") {
    return "Message template";
  }

  return (
    template.name ||
    template.title ||
    "Message template"
  );
}

function getCreatorName(campaign) {
  const creator = campaign?.createdBy;

  if (!creator) {
    return "Unknown";
  }

  if (typeof creator === "string") {
    return creator;
  }

  return (
    creator.name ||
    [
      creator.firstName,
      creator.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    creator.email ||
    "Unknown"
  );
}

function getAudienceDescription(campaign) {
  const audience =
    campaign?.audience || {};

  switch (audience.type) {
    case "selected_customers": {
      const count = Array.isArray(
        audience.customerIds
      )
        ? audience.customerIds.length
        : Number(
            audience.estimatedRecipients
          ) || 0;

      return `${formatNumber(
        count
      )} selected customer${
        count === 1 ? "" : "s"
      }`;
    }

    case "segments": {
      const count = Array.isArray(
        audience.segments
      )
        ? audience.segments.length
        : 0;

      return `${formatNumber(
        count
      )} selected segment${
        count === 1 ? "" : "s"
      }`;
    }

    case "custom_filters":
      return "Customers matching filters";

    case "all_customers":
    default:
      return "All eligible customers";
  }
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  danger = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function DeliveryMetric({
  label,
  value,
  className = "",
}) {
  return (
    <div
      className={`rounded-lg bg-gray-50 p-3 ${className}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold text-gray-900">
        {formatNumber(value)}
      </p>
    </div>
  );
}

export default function CommunicationCampaignCard({
  campaign,
  busyAction = "",
  onPreview,
  onEdit,
  onDuplicate,
  onLaunch,
  onPause,
  onResume,
  onCancel,
  onDelete,
  onRefreshCounts,
}) {
  const menuRef = useRef(null);

  const [menuOpen, setMenuOpen] =
    useState(false);

  const campaignId =
    getRecordId(campaign);

  const status =
    campaign?.status || "draft";

  const channel =
    CHANNEL_CONFIG[campaign?.channel] ||
    CHANNEL_CONFIG.in_app;

  const statusConfig =
    STATUS_CONFIG[status] ||
    STATUS_CONFIG.draft;

  const ChannelIcon = channel.icon;
  const StatusIcon = statusConfig.icon;

  const deliveryCounts =
    campaign?.deliveryCounts || {};

  const totalRecipients =
    Number(
      deliveryCounts.totalRecipients
    ) || 0;

  const successfulRecipients =
    Number(deliveryCounts.sent || 0) +
    Number(deliveryCounts.delivered || 0) +
    Number(deliveryCounts.opened || 0) +
    Number(
      deliveryCounts.responded || 0
    );

  const completedRecipients =
    successfulRecipients +
    Number(deliveryCounts.failed || 0) +
    Number(deliveryCounts.skipped || 0) +
    Number(
      deliveryCounts.cancelled || 0
    );

  const progressPercentage =
    Number.isFinite(
      Number(campaign?.progressPercentage)
    )
      ? Number(
          campaign.progressPercentage
        )
      : calculatePercentage(
          completedRecipients,
          totalRecipients
        );

  const responsePercentage =
    calculatePercentage(
      deliveryCounts.responded,
      totalRecipients
    );

  const editable =
    EDITABLE_STATUSES.includes(status);

  const launchable =
    LAUNCHABLE_STATUSES.includes(status);

  const pausable =
    PAUSABLE_STATUSES.includes(status);

  const resumable = status === "paused";

  const cancellable =
    CANCELLABLE_STATUSES.includes(status);

  const deletable =
    DELETABLE_STATUSES.includes(status);

  const isBusy = Boolean(busyAction);

  const scheduledAt =
    campaign?.schedule?.scheduledAt;

  const scheduled =
    campaign?.schedule?.mode ===
      "scheduled" &&
    Boolean(scheduledAt);

  const primaryAction = useMemo(() => {
    if (status === "paused") {
      return {
        label: "Resume",
        icon: RotateCcw,
        onClick: onResume,
      };
    }

    if (pausable) {
      return {
        label: "Pause",
        icon: Pause,
        onClick: onPause,
      };
    }

    if (launchable) {
      return {
        label: scheduled
          ? "Launch Now"
          : "Launch",
        icon: Play,
        onClick: onLaunch,
      };
    }

    return null;
  }, [
    status,
    pausable,
    launchable,
    scheduled,
    onResume,
    onPause,
    onLaunch,
  ]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target
        )
      ) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [menuOpen]);

  useEffect(() => {
    if (isBusy) {
      setMenuOpen(false);
    }
  }, [isBusy]);

  function closeMenuAndRun(
    callback,
    ...argumentsList
  ) {
    setMenuOpen(false);

    callback?.(
      campaign,
      ...argumentsList
    );
  }

  function handlePrimaryAction() {
    primaryAction?.onClick?.(campaign);
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <header className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${channel.iconClass}`}
          >
            <ChannelIcon size={21} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className="truncate text-lg font-bold text-gray-900"
                title={campaign?.name}
              >
                {campaign?.name ||
                  "Untitled Campaign"}
              </h3>

              {campaign?.options?.dryRun ? (
                <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                  Dry Run
                </span>
              ) : null}
            </div>

            <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-500">
              {truncateText(
                campaign?.description
              )}
            </p>
          </div>
        </div>

        <div
          ref={menuRef}
          className="relative shrink-0"
        >
          <button
            type="button"
            onClick={() =>
              setMenuOpen(
                (currentValue) =>
                  !currentValue
              )
            }
            disabled={isBusy}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Open actions for ${
              campaign?.name ||
              "campaign"
            }`}
            aria-expanded={menuOpen}
          >
            {isBusy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
            ) : (
              <MoreVertical size={19} />
            )}
          </button>

          {menuOpen ? (
            <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
              <ActionButton
                icon={Eye}
                label="View campaign"
                onClick={() =>
                  closeMenuAndRun(
                    onPreview
                  )
                }
              />

              <ActionButton
                icon={Edit3}
                label="Edit campaign"
                disabled={!editable}
                onClick={() =>
                  closeMenuAndRun(onEdit)
                }
              />

              <ActionButton
                icon={Copy}
                label={
                  busyAction === "duplicate"
                    ? "Duplicating..."
                    : "Duplicate campaign"
                }
                disabled={isBusy}
                onClick={() =>
                  closeMenuAndRun(
                    onDuplicate
                  )
                }
              />

              <ActionButton
                icon={RefreshCcw}
                label={
                  busyAction ===
                  "refresh"
                    ? "Refreshing..."
                    : "Refresh statistics"
                }
                disabled={isBusy}
                onClick={() =>
                  closeMenuAndRun(
                    onRefreshCounts
                  )
                }
              />

              <div className="my-1 border-t border-gray-100" />

              {launchable ? (
                <ActionButton
                  icon={Play}
                  label={
                    busyAction === "launch"
                      ? "Launching..."
                      : scheduled
                        ? "Launch now"
                        : "Launch campaign"
                  }
                  disabled={isBusy}
                  onClick={() =>
                    closeMenuAndRun(
                      onLaunch
                    )
                  }
                />
              ) : null}

              {pausable ? (
                <ActionButton
                  icon={Pause}
                  label={
                    busyAction === "pause"
                      ? "Pausing..."
                      : "Pause campaign"
                  }
                  disabled={isBusy}
                  onClick={() =>
                    closeMenuAndRun(
                      onPause
                    )
                  }
                />
              ) : null}

              {resumable ? (
                <ActionButton
                  icon={RotateCcw}
                  label={
                    busyAction === "resume"
                      ? "Resuming..."
                      : "Resume campaign"
                  }
                  disabled={isBusy}
                  onClick={() =>
                    closeMenuAndRun(
                      onResume
                    )
                  }
                />
              ) : null}

              {cancellable ? (
                <ActionButton
                  icon={Ban}
                  label={
                    busyAction === "cancel"
                      ? "Cancelling..."
                      : "Cancel campaign"
                  }
                  disabled={isBusy}
                  onClick={() =>
                    closeMenuAndRun(
                      onCancel
                    )
                  }
                />
              ) : null}

              <div className="my-1 border-t border-gray-100" />

              <ActionButton
                icon={Trash2}
                label={
                  busyAction === "delete"
                    ? "Deleting..."
                    : "Delete campaign"
                }
                danger
                disabled={
                  isBusy || !deletable
                }
                onClick={() =>
                  closeMenuAndRun(
                    onDelete
                  )
                }
              />
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex-1 space-y-5 p-5">
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${channel.badgeClass}`}
          >
            <ChannelIcon size={13} />
            {channel.label}
          </span>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusConfig.badgeClass}`}
          >
            <StatusIcon
              size={13}
              className={
                status === "processing"
                  ? "animate-spin"
                  : ""
              }
            />

            {statusConfig.label}
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
            <BarChart3 size={13} />

            {getCampaignTypeLabel(
              campaign?.campaignType
            )}
          </span>
        </div>

        {campaign?.channel === "email" &&
        campaign?.subject ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">
              Email subject
            </p>

            <p
              className="mt-1 truncate text-sm font-semibold text-blue-900"
              title={campaign.subject}
            >
              {campaign.subject}
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <Users
                className="text-indigo-600"
                size={16}
              />

              <p className="text-xs font-semibold text-gray-600">
                Audience
              </p>
            </div>

            <p className="mt-2 text-sm font-bold text-gray-900">
              {getAudienceTypeLabel(
                campaign?.audience?.type
              )}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              {getAudienceDescription(
                campaign
              )}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <FileText
                className="text-indigo-600"
                size={16}
              />

              <p className="text-xs font-semibold text-gray-600">
                Template
              </p>
            </div>

            <p
              className="mt-2 truncate text-sm font-bold text-gray-900"
              title={getTemplateName(
                campaign?.template
              )}
            >
              {getTemplateName(
                campaign?.template
              )}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              {formatNumber(
                campaign?.variables?.length
              )}{" "}
              variable
              {Number(
                campaign?.variables?.length
              ) === 1
                ? ""
                : "s"}
            </p>
          </div>
        </div>

        {scheduled ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <CalendarClock
                className="mt-0.5 shrink-0 text-blue-700"
                size={19}
              />

              <div className="min-w-0">
                <p className="text-sm font-semibold text-blue-900">
                  Scheduled delivery
                </p>

                <p className="mt-1 text-sm text-blue-700">
                  {formatDateTime(
                    scheduledAt
                  )}
                </p>

                <p className="mt-1 text-xs font-medium text-blue-600">
                  {formatRelativeSchedule(
                    scheduledAt
                  )}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <Send
                className="text-gray-500"
                size={17}
              />

              <span className="text-sm text-gray-600">
                Send mode
              </span>
            </div>

            <span className="text-sm font-semibold text-gray-900">
              {SEND_MODE_LABELS[
                campaign?.schedule?.mode
              ] || "Draft"}
            </span>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Campaign progress
              </p>

              <p className="mt-0.5 text-xs text-gray-500">
                {formatNumber(
                  completedRecipients
                )}{" "}
                of{" "}
                {formatNumber(
                  totalRecipients
                )}{" "}
                processed
              </p>
            </div>

            <span className="text-sm font-bold text-indigo-700">
              {formatPercentage(
                progressPercentage
              )}
            </span>
          </div>

          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{
                width: `${Math.min(
                  100,
                  Math.max(
                    0,
                    progressPercentage
                  )
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <DeliveryMetric
            label="Recipients"
            value={totalRecipients}
          />

          <DeliveryMetric
            label="Delivered"
            value={
              Number(
                deliveryCounts.delivered ||
                  0
              ) +
              Number(
                deliveryCounts.opened || 0
              ) +
              Number(
                deliveryCounts.responded || 0
              )
            }
          />

          <DeliveryMetric
            label="Responses"
            value={
              deliveryCounts.responded
            }
          />
        </div>

        {totalRecipients > 0 ? (
          <div className="flex items-center justify-between gap-4 rounded-lg bg-green-50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2
                className="text-green-600"
                size={16}
              />

              <span className="text-xs font-semibold text-green-800">
                Response rate
              </span>
            </div>

            <span className="text-sm font-bold text-green-800">
              {formatPercentage(
                responsePercentage
              )}
            </span>
          </div>
        ) : null}

        {campaign?.failureReason ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
            <AlertCircle
              className="mt-0.5 shrink-0 text-red-600"
              size={17}
            />

            <p className="line-clamp-3 text-xs leading-5 text-red-700">
              {campaign.failureReason}
            </p>
          </div>
        ) : null}
      </div>

      <footer className="border-t border-gray-100 bg-gray-50/70 px-5 py-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-gray-400">
              Updated
            </p>

            <p className="mt-1 font-semibold text-gray-800">
              {formatDateTime(
                campaign?.updatedAt
              )}
            </p>
          </div>

          <div>
            <p className="text-gray-400">
              Created by
            </p>

            <p
              className="mt-1 truncate font-semibold text-gray-800"
              title={getCreatorName(
                campaign
              )}
            >
              {getCreatorName(campaign)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() =>
              onPreview?.(campaign)
            }
            disabled={isBusy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Eye size={16} />
            View
          </button>

          {primaryAction ? (
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={isBusy}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                primaryAction.label ===
                "Pause"
                  ? "bg-orange-600 hover:bg-orange-700"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {busyAction ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <primaryAction.icon
                  size={16}
                />
              )}

              {busyAction
                ? "Working..."
                : primaryAction.label}
            </button>
          ) : editable ? (
            <button
              type="button"
              onClick={() =>
                onEdit?.(campaign)
              }
              disabled={isBusy}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Edit3 size={16} />
              Edit
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                onRefreshCounts?.(campaign)
              }
              disabled={isBusy}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCcw
                size={16}
                className={
                  busyAction === "refresh"
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>
          )}
        </div>

        <span className="sr-only">
          Campaign ID: {campaignId}
        </span>
      </footer>
    </article>
  );
}