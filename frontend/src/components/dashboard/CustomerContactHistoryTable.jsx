import {
  Bell,
  CalendarClock,
  CheckCheck,
  CircleAlert,
  Clock,
  Eye,
  Mail,
  MessageCircle,
  MessageSquareReply,
  Phone,
  Send,
  Smartphone,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";

import Card from "../ui/Card";

const CHANNEL_CONFIG = {
  email: {
    label: "Email",
    icon: Mail,
    className: "bg-blue-100 text-blue-700",
  },

  sms: {
    label: "SMS",
    icon: Smartphone,
    className: "bg-purple-100 text-purple-700",
  },

  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    className: "bg-green-100 text-green-700",
  },

  phone: {
    label: "Phone",
    icon: Phone,
    className: "bg-orange-100 text-orange-700",
  },

  in_app: {
    label: "In App",
    icon: Bell,
    className: "bg-indigo-100 text-indigo-700",
  },
};

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    icon: Clock,
    className: "bg-gray-100 text-gray-700",
  },

  queued: {
    label: "Queued",
    icon: CalendarClock,
    className: "bg-yellow-100 text-yellow-700",
  },

  sent: {
    label: "Sent",
    icon: Send,
    className: "bg-blue-100 text-blue-700",
  },

  delivered: {
    label: "Delivered",
    icon: CheckCheck,
    className: "bg-green-100 text-green-700",
  },

  opened: {
    label: "Opened",
    icon: Eye,
    className: "bg-purple-100 text-purple-700",
  },

  responded: {
    label: "Responded",
    icon: MessageSquareReply,
    className: "bg-emerald-100 text-emerald-700",
  },

  failed: {
    label: "Failed",
    icon: CircleAlert,
    className: "bg-red-100 text-red-700",
  },

  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-orange-100 text-orange-700",
  },
};

const CAMPAIGN_LABELS = {
  dormant_customer: "Dormant Customer",
  appointment_reminder: "Appointment Reminder",
  follow_up: "Follow-up",
  promotion: "Promotion",
  birthday: "Birthday",
  general: "General",
};

const STATUS_OPTIONS = [
  "draft",
  "queued",
  "sent",
  "delivered",
  "opened",
  "responded",
  "failed",
  "cancelled",
];

function getCustomerName(contactLog) {
  const customer = contactLog?.customer;

  return (
    customer?.fullName?.trim() ||
    customer?.name?.trim() ||
    [
      customer?.firstName,
      customer?.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    contactLog?.customerName?.trim() ||
    "Customer"
  );
}

function getCustomerId(contactLog, index) {
  return (
    contactLog?.customer?._id ||
    contactLog?.customer ||
    `customer-${index}`
  );
}

function getContactLogId(contactLog, index) {
  return (
    contactLog?._id ||
    contactLog?.id ||
    `contact-log-${index}`
  );
}

function formatDate(value) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatCampaignType(campaignType = "general") {
  return (
    CAMPAIGN_LABELS[campaignType] ||
    campaignType
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) =>
        character.toUpperCase()
      )
  );
}

function truncateText(value, maximumLength = 90) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "No message recorded";
  }

  if (text.length <= maximumLength) {
    return text;
  }

  return `${text.slice(0, maximumLength)}…`;
}

function CustomerAvatar({ name }) {
  const initials = String(name || "Customer")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
      {initials || <UserRound size={18} />}
    </div>
  );
}

function ChannelBadge({ channel }) {
  const config =
    CHANNEL_CONFIG[channel] ??
    CHANNEL_CONFIG.in_app;

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      <Icon size={14} />
      {config.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const config =
    STATUS_CONFIG[status] ??
    STATUS_CONFIG.draft;

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      <Icon size={14} />
      {config.label}
    </span>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="h-20 animate-pulse rounded-lg bg-gray-100"
        />
      ))}
    </div>
  );
}

export default function CustomerContactHistoryTable({
  contactLogs = [],
  loading = false,
  error = "",
  updatingContactLogId = "",
  deletingContactLogId = "",
  onStatusChange,
  onDelete,
  pagination,
  onPageChange,
}) {
  const normalizedContactLogs = Array.isArray(contactLogs)
    ? contactLogs
    : [];

  const currentPage =
    Number(pagination?.page) || 1;

  const totalPages = Math.max(
    1,
    Number(pagination?.pages) || 1
  );

  const totalRecords =
    Number(pagination?.total) ||
    normalizedContactLogs.length;

  return (
    <Card
      title="Customer Contact History"
      subtitle={`${totalRecords} contact record${
        totalRecords === 1 ? "" : "s"
      }`}
    >
      {loading ? (
        <LoadingRows />
      ) : error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <CircleAlert
            className="mt-0.5 shrink-0 text-red-600"
            size={20}
          />

          <div>
            <p className="font-semibold text-red-800">
              Contact history unavailable
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>
          </div>
        </div>
      ) : normalizedContactLogs.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <MessageCircle
              className="text-blue-600"
              size={24}
            />
          </div>

          <h3 className="mt-4 font-semibold text-gray-900">
            No contact records
          </h3>

          <p className="mt-2 max-w-md text-sm text-gray-500">
            Email, SMS, WhatsApp and telephone contact
            attempts will appear here after they have been
            recorded.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="text-left">
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Customer
                  </th>

                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Campaign
                  </th>

                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Channel
                  </th>

                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Message
                  </th>

                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>

                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Created
                  </th>

                  {onStatusChange || onDelete ? (
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {normalizedContactLogs.map(
                  (contactLog, index) => {
                    const contactLogId =
                      getContactLogId(
                        contactLog,
                        index
                      );

                    const customerName =
                      getCustomerName(contactLog);

                    const customerId =
                      getCustomerId(
                        contactLog,
                        index
                      );

                    const isUpdating =
                      String(
                        updatingContactLogId
                      ) === String(contactLogId);

                    const isDeleting =
                      String(
                        deletingContactLogId
                      ) === String(contactLogId);

                    const isBusy =
                      isUpdating || isDeleting;

                    return (
                      <tr
                        key={contactLogId}
                        className="align-top transition hover:bg-gray-50"
                      >
                        <td className="px-3 py-4">
                          <div className="flex min-w-56 items-center gap-3">
                            <CustomerAvatar
                              name={customerName}
                            />

                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-900">
                                {customerName}
                              </p>

                              <p className="mt-1 truncate text-xs text-gray-500">
                                {contactLog.recipient ||
                                  contactLog.customer
                                    ?.email ||
                                  contactLog.customer
                                    ?.phone ||
                                  "No recipient recorded"}
                              </p>

                              <p className="mt-1 truncate text-xs text-gray-400">
                                ID: {String(customerId)}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-3 py-4">
                          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                            {formatCampaignType(
                              contactLog.campaignType
                            )}
                          </span>

                          <p className="mt-2 text-xs capitalize text-gray-400">
                            {contactLog.direction ||
                              "outbound"}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-3 py-4">
                          <ChannelBadge
                            channel={
                              contactLog.channel
                            }
                          />
                        </td>

                        <td className="max-w-xs px-3 py-4">
                          {contactLog.subject ? (
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {contactLog.subject}
                            </p>
                          ) : null}

                          <p
                            className={`text-sm leading-5 text-gray-600 ${
                              contactLog.subject
                                ? "mt-1"
                                : ""
                            }`}
                            title={
                              contactLog.message ||
                              ""
                            }
                          >
                            {truncateText(
                              contactLog.message
                            )}
                          </p>

                          {contactLog.failureReason ? (
                            <p className="mt-2 text-xs font-medium text-red-600">
                              Failure:{" "}
                              {contactLog.failureReason}
                            </p>
                          ) : null}
                        </td>

                        <td className="whitespace-nowrap px-3 py-4">
                          <StatusBadge
                            status={
                              contactLog.status
                            }
                          />

                          {contactLog.sentAt ? (
                            <p className="mt-2 text-xs text-gray-400">
                              Sent{" "}
                              {formatDate(
                                contactLog.sentAt
                              )}
                            </p>
                          ) : null}
                        </td>

                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-600">
                          {formatDate(
                            contactLog.createdAt
                          )}
                        </td>

                        {onStatusChange ||
                        onDelete ? (
                          <td className="whitespace-nowrap px-3 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {onStatusChange ? (
                                <select
                                  value={
                                    contactLog.status ||
                                    "draft"
                                  }
                                  onChange={(event) =>
                                    onStatusChange(
                                      contactLog,
                                      event.target.value
                                    )
                                  }
                                  disabled={isBusy}
                                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs font-semibold text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  aria-label={`Update status for ${customerName}`}
                                >
                                  {STATUS_OPTIONS.map(
                                    (status) => (
                                      <option
                                        key={status}
                                        value={status}
                                      >
                                        {
                                          STATUS_CONFIG[
                                            status
                                          ].label
                                        }
                                      </option>
                                    )
                                  )}
                                </select>
                              ) : null}

                              {onDelete ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onDelete(
                                      contactLog
                                    )
                                  }
                                  disabled={isBusy}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  aria-label={`Delete contact record for ${customerName}`}
                                  title="Delete contact record"
                                >
                                  {isDeleting ? (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                  ) : (
                                    <Trash2
                                      size={16}
                                    />
                                  )}
                                </button>
                              ) : null}
                            </div>

                            {isUpdating ? (
                              <p className="mt-2 text-xs text-blue-600">
                                Updating status...
                              </p>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onPageChange?.(
                      Math.max(1, currentPage - 1)
                    )
                  }
                  disabled={
                    currentPage <= 1 || loading
                  }
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onPageChange?.(
                      Math.min(
                        totalPages,
                        currentPage + 1
                      )
                    )
                  }
                  disabled={
                    currentPage >= totalPages ||
                    loading
                  }
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}