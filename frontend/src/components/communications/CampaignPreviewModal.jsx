import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit3,
  Eye,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  RefreshCcw,
  Send,
  Smartphone,
  Users,
  X,
} from "lucide-react";

import {
  getCommunicationCampaign,
  getCommunicationCampaignErrorMessage,
  previewExistingCampaignAudience,
} from "../../Services/communicationCampaignApi";

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
    className:
      "border-gray-200 bg-gray-100 text-gray-700",
  },

  scheduled: {
    label: "Scheduled",
    className:
      "border-blue-200 bg-blue-50 text-blue-700",
  },

  queued: {
    label: "Queued",
    className:
      "border-amber-200 bg-amber-50 text-amber-700",
  },

  processing: {
    label: "Processing",
    className:
      "border-purple-200 bg-purple-50 text-purple-700",
  },

  paused: {
    label: "Paused",
    className:
      "border-orange-200 bg-orange-50 text-orange-700",
  },

  completed: {
    label: "Completed",
    className:
      "border-green-200 bg-green-50 text-green-700",
  },

  partially_completed: {
    label: "Partially Completed",
    className:
      "border-yellow-200 bg-yellow-50 text-yellow-700",
  },

  failed: {
    label: "Failed",
    className:
      "border-red-200 bg-red-50 text-red-700",
  },

  cancelled: {
    label: "Cancelled",
    className:
      "border-gray-300 bg-gray-100 text-gray-600",
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

const SEGMENT_LABELS = {
  new_customers: "New Customers",
  returning_customers:
    "Returning Customers",
  dormant_customers:
    "Dormant Customers",
  high_value_customers:
    "High-Value Customers",
  upcoming_appointments:
    "Upcoming Appointments",
  birthday_customers:
    "Birthday Customers",
  inactive_customers:
    "Inactive Customers",
  vip_customers: "VIP Customers",
  custom: "Custom Segment",
};

const SAMPLE_VARIABLES = {
  customerName: "Sophia Brown",
  firstName: "Sophia",
  lastName: "Brown",
  customerEmail: "sophia@example.com",
  customerPhone: "07123 456789",
  salonName: "SalonAI",
  salonPhone: "020 1234 5678",
  salonEmail: "hello@salonai.co.uk",
  appointmentDate: "24 July 2026",
  appointmentTime: "14:30",
  stylistName: "Emma",
  serviceName: "Cut and Blow Dry",
  bookingReference: "SAL-1024",
  campaignName: "Customer Campaign",
  rebookingLink:
    "https://salonai.example/booking",
  discountCode: "WELCOME20",
  discountAmount: "20%",
};

const TABS = [
  {
    id: "overview",
    label: "Overview",
    icon: BarChart3,
  },
  {
    id: "message",
    label: "Message",
    icon: Eye,
  },
  {
    id: "audience",
    label: "Audience",
    icon: Users,
  },
];

function getRecordId(record) {
  return String(
    record?._id ||
      record?.id ||
      record ||
      ""
  ).trim();
}

function normalizeCampaignResponse(response) {
  return (
    response?.campaign ||
    response?.data?.campaign ||
    response?.data ||
    response ||
    null
  );
}

function normalizePreviewResponse(response) {
  return (
    response?.preview ||
    response?.data?.preview ||
    response?.data ||
    response ||
    null
  );
}

function renderTemplateText(
  value,
  variables
) {
  return String(value || "").replace(
    /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g,
    (placeholder, variableName) => {
      const replacement =
        variables?.[variableName];

      if (
        replacement === undefined ||
        replacement === null ||
        replacement === ""
      ) {
        return placeholder;
      }

      return String(replacement);
    }
  );
}

function extractVariables(campaign) {
  const variables = new Set(
    Array.isArray(campaign?.variables)
      ? campaign.variables
      : []
  );

  const pattern =
    /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g;

  for (const value of [
    campaign?.subject,
    campaign?.body,
  ]) {
    const text = String(value || "");

    let match = pattern.exec(text);

    while (match) {
      variables.add(match[1]);
      match = pattern.exec(text);
    }

    pattern.lastIndex = 0;
  }

  return Array.from(variables)
    .map((variable) =>
      String(variable || "").trim()
    )
    .filter(Boolean)
    .sort();
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-GB").format(
    Number(value) || 0
  );
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

function formatPercentage(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0%";
  }

  return `${number.toFixed(1)}%`;
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

function getCustomerName(customer) {
  if (!customer) {
    return "Unknown customer";
  }

  if (typeof customer === "string") {
    return `Customer ${customer.slice(-6)}`;
  }

  return (
    customer.fullName ||
    customer.name ||
    [
      customer.firstName,
      customer.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    customer.email ||
    "Unknown customer"
  );
}

function getCustomerContact(customer) {
  if (
    !customer ||
    typeof customer === "string"
  ) {
    return "";
  }

  return (
    customer.email ||
    customer.phone ||
    customer.phoneNumber ||
    customer.mobile ||
    ""
  );
}

function MetricCard({
  title,
  value,
  description,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-gray-900">
        {value}
      </p>

      {description ? (
        <p className="mt-1 text-xs text-gray-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-3 last:border-b-0">
      <dt className="text-sm text-gray-500">
        {label}
      </dt>

      <dd className="max-w-[65%] text-right text-sm font-semibold text-gray-900">
        {value}
      </dd>
    </div>
  );
}

export default function CampaignPreviewModal({
  open = false,
  campaign = null,
  onClose,
  onEdit,
  onLaunch,
}) {
  const [activeTab, setActiveTab] =
    useState("overview");

  const [campaignData, setCampaignData] =
    useState(campaign);

  const [audiencePreview, setAudiencePreview] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [refreshingAudience, setRefreshingAudience] =
    useState(false);

  const [error, setError] = useState("");

  const campaignId =
    getRecordId(campaign);

  const channelConfig =
    CHANNEL_CONFIG[
      campaignData?.channel
    ] || CHANNEL_CONFIG.in_app;

  const statusConfig =
    STATUS_CONFIG[
      campaignData?.status
    ] || STATUS_CONFIG.draft;

  const ChannelIcon =
    channelConfig.icon;

  const variables = useMemo(
    () => extractVariables(campaignData),
    [campaignData]
  );

  const previewVariables = useMemo(
    () => ({
      ...SAMPLE_VARIABLES,

      campaignName:
        campaignData?.name ||
        SAMPLE_VARIABLES.campaignName,

      ...(campaignData?.variableValues ||
        {}),
    }),
    [
      campaignData?.name,
      campaignData?.variableValues,
    ]
  );

  const previewSubject = useMemo(
    () =>
      renderTemplateText(
        campaignData?.subject,
        previewVariables
      ),
    [
      campaignData?.subject,
      previewVariables,
    ]
  );

  const previewBody = useMemo(
    () =>
      renderTemplateText(
        campaignData?.body,
        previewVariables
      ),
    [
      campaignData?.body,
      previewVariables,
    ]
  );

  const deliveryCounts =
    campaignData?.deliveryCounts || {};

  const totalRecipients =
    Number(
      deliveryCounts.totalRecipients
    ) || 0;

  const processedRecipients =
    Number(deliveryCounts.sent || 0) +
    Number(deliveryCounts.delivered || 0) +
    Number(deliveryCounts.opened || 0) +
    Number(deliveryCounts.responded || 0) +
    Number(deliveryCounts.failed || 0) +
    Number(deliveryCounts.skipped || 0) +
    Number(deliveryCounts.cancelled || 0);

  const progressPercentage =
    Number.isFinite(
      Number(
        campaignData?.progressPercentage
      )
    )
      ? Number(
          campaignData.progressPercentage
        )
      : calculatePercentage(
          processedRecipients,
          totalRecipients
        );

  const deliveryPercentage =
    calculatePercentage(
      Number(deliveryCounts.delivered || 0) +
        Number(deliveryCounts.opened || 0) +
        Number(
          deliveryCounts.responded || 0
        ),
      totalRecipients
    );

  const responsePercentage =
    calculatePercentage(
      deliveryCounts.responded,
      totalRecipients
    );

  const editableStatuses = [
    "draft",
    "scheduled",
    "paused",
    "failed",
  ];

  const launchableStatuses = [
    "draft",
    "scheduled",
    "paused",
    "failed",
  ];

  useEffect(() => {
    if (!open) {
      return;
    }

    setCampaignData(campaign);
    setAudiencePreview(null);
    setActiveTab("overview");
    setError("");
  }, [open, campaign]);

  useEffect(() => {
    if (!open || !campaignId) {
      return undefined;
    }

    let cancelled = false;

    async function loadCampaignPreview() {
      try {
        setLoading(true);
        setError("");

        const [
          campaignResult,
          audienceResult,
        ] = await Promise.allSettled([
          getCommunicationCampaign(
            campaignId
          ),

          previewExistingCampaignAudience(
            campaignId,
            {
              previewLimit: 10,
            }
          ),
        ]);

        if (cancelled) {
          return;
        }

        if (
          campaignResult.status ===
          "fulfilled"
        ) {
          setCampaignData(
            normalizeCampaignResponse(
              campaignResult.value
            )
          );
        } else {
          setError(
            getCommunicationCampaignErrorMessage(
              campaignResult.reason,
              "Unable to load the campaign."
            )
          );
        }

        if (
          audienceResult.status ===
          "fulfilled"
        ) {
          setAudiencePreview(
            normalizePreviewResponse(
              audienceResult.value
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCampaignPreview();

    return () => {
      cancelled = true;
    };
  }, [open, campaignId]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleEscape(event) {
      if (
        event.key === "Escape" &&
        !loading &&
        !refreshingAudience
      ) {
        onClose?.();
      }
    }

    document.addEventListener(
      "keydown",
      handleEscape
    );

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );

      document.body.style.overflow = "";
    };
  }, [
    open,
    loading,
    refreshingAudience,
    onClose,
  ]);

  if (!open || !campaignData) {
    return null;
  }

  async function handleRefreshAudience() {
    if (!campaignId) {
      setError(
        "The campaign does not have a valid ID."
      );

      return;
    }

    try {
      setRefreshingAudience(true);
      setError("");

      const response =
        await previewExistingCampaignAudience(
          campaignId,
          {
            previewLimit: 10,
          }
        );

      setAudiencePreview(
        normalizePreviewResponse(response)
      );
    } catch (requestError) {
      setError(
        getCommunicationCampaignErrorMessage(
          requestError,
          "Unable to refresh the campaign audience."
        )
      );
    } finally {
      setRefreshingAudience(false);
    }
  }

  function handleBackdropClick(event) {
    if (
      event.target ===
        event.currentTarget &&
      !loading &&
      !refreshingAudience
    ) {
      onClose?.();
    }
  }

  function handleEdit() {
    onEdit?.(campaignData);
  }

  function handleLaunch() {
    onLaunch?.(campaignData);
  }

  function renderOverviewTab() {
    return (
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Recipients"
            value={formatNumber(
              totalRecipients ||
                audiencePreview
                  ?.estimatedRecipients
            )}
            description="Eligible campaign recipients"
          />

          <MetricCard
            title="Delivered"
            value={formatNumber(
              Number(
                deliveryCounts.delivered ||
                  0
              ) +
                Number(
                  deliveryCounts.opened || 0
                ) +
                Number(
                  deliveryCounts.responded ||
                    0
                )
            )}
            description={formatPercentage(
              deliveryPercentage
            )}
          />

          <MetricCard
            title="Responses"
            value={formatNumber(
              deliveryCounts.responded
            )}
            description={formatPercentage(
              responsePercentage
            )}
          />

          <MetricCard
            title="Failed"
            value={formatNumber(
              deliveryCounts.failed
            )}
            description={`${formatNumber(
              deliveryCounts.skipped
            )} skipped`}
          />
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900">
                Campaign progress
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Overall recipient processing
                progress.
              </p>
            </div>

            <span className="text-lg font-bold text-indigo-700">
              {formatPercentage(
                progressPercentage
              )}
            </span>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
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

          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              {
                label: "Queued",
                value:
                  deliveryCounts.queued,
              },
              {
                label: "Sent",
                value: deliveryCounts.sent,
              },
              {
                label: "Delivered",
                value:
                  deliveryCounts.delivered,
              },
              {
                label: "Opened",
                value:
                  deliveryCounts.opened,
              },
              {
                label: "Responded",
                value:
                  deliveryCounts.responded,
              },
              {
                label: "Failed",
                value:
                  deliveryCounts.failed,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg bg-gray-50 p-3 text-center"
              >
                <p className="text-xs text-gray-500">
                  {item.label}
                </p>

                <p className="mt-1 text-lg font-bold text-gray-900">
                  {formatNumber(item.value)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <FileText
                className="text-indigo-600"
                size={19}
              />

              <h3 className="font-semibold text-gray-900">
                Campaign details
              </h3>
            </div>

            <dl className="mt-4">
              <DetailRow
                label="Campaign type"
                value={getCampaignTypeLabel(
                  campaignData.campaignType
                )}
              />

              <DetailRow
                label="Channel"
                value={channelConfig.label}
              />

              <DetailRow
                label="Template"
                value={getTemplateName(
                  campaignData.template
                )}
              />

              <DetailRow
                label="Created by"
                value={getCreatorName(
                  campaignData
                )}
              />

              <DetailRow
                label="Created"
                value={formatDateTime(
                  campaignData.createdAt
                )}
              />

              <DetailRow
                label="Last updated"
                value={formatDateTime(
                  campaignData.updatedAt
                )}
              />
            </dl>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <CalendarClock
                className="text-indigo-600"
                size={19}
              />

              <h3 className="font-semibold text-gray-900">
                Delivery configuration
              </h3>
            </div>

            <dl className="mt-4">
              <DetailRow
                label="Send mode"
                value={
                  campaignData.schedule?.mode ===
                  "scheduled"
                    ? "Scheduled"
                    : campaignData.schedule
                          ?.mode ===
                        "immediate"
                      ? "Immediate"
                      : "Draft"
                }
              />

              <DetailRow
                label="Scheduled for"
                value={
                  campaignData.schedule?.mode ===
                  "scheduled"
                    ? formatDateTime(
                        campaignData.schedule
                          ?.scheduledAt
                      )
                    : "Not scheduled"
                }
              />

              <DetailRow
                label="Timezone"
                value={
                  campaignData.schedule
                    ?.timezone ||
                  "Europe/London"
                }
              />

              <DetailRow
                label="Batch size"
                value={formatNumber(
                  campaignData.schedule
                    ?.batchSize || 100
                )}
              />

              <DetailRow
                label="Batch delay"
                value={`${formatNumber(
                  campaignData.schedule
                    ?.delayBetweenBatchesSeconds
                )} seconds`}
              />

              <DetailRow
                label="Dry run"
                value={
                  campaignData.options?.dryRun
                    ? "Enabled"
                    : "Disabled"
                }
              />
            </dl>
          </section>
        </div>

        {campaignData.description ? (
          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <h3 className="font-semibold text-gray-900">
              Description
            </h3>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">
              {campaignData.description}
            </p>
          </section>
        ) : null}

        {campaignData.failureReason ? (
          <section className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5">
            <AlertCircle
              className="mt-0.5 shrink-0 text-red-600"
              size={20}
            />

            <div>
              <h3 className="font-semibold text-red-900">
                Campaign issue
              </h3>

              <p className="mt-1 text-sm leading-6 text-red-700">
                {campaignData.failureReason}
              </p>
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  function renderMessageTab() {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-5 py-4">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${channelConfig.iconClass}`}
            >
              <ChannelIcon size={19} />
            </div>

            <div>
              <h3 className="font-semibold text-gray-900">
                {channelConfig.label} preview
              </h3>

              <p className="mt-0.5 text-xs text-gray-500">
                Personalised with sample customer
                details.
              </p>
            </div>
          </div>

          {campaignData.channel ===
          "email" ? (
            <div className="border-b border-gray-100 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Subject
              </p>

              <p className="mt-2 text-base font-semibold text-gray-900">
                {previewSubject ||
                  "No email subject"}
              </p>
            </div>
          ) : null}

          <div className="min-h-80 px-5 py-6">
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">
              {previewBody ||
                "No message content"}
            </p>
          </div>

          <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
            <p className="text-xs text-gray-500">
              {formatNumber(
                campaignData.body?.length
              )}{" "}
              message characters
            </p>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="font-semibold text-gray-900">
              Template variables
            </h3>

            <p className="mt-1 text-xs leading-5 text-gray-500">
              Variables are replaced separately
              for every campaign recipient.
            </p>

            {variables.length > 0 ? (
              <div className="mt-4 space-y-3">
                {variables.map(
                  (variableName) => (
                    <div
                      key={variableName}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                    >
                      <p className="font-mono text-xs font-semibold text-indigo-700">
                        {`{{${variableName}}}`}
                      </p>

                      <p className="mt-1 truncate text-sm text-gray-700">
                        {String(
                          previewVariables[
                            variableName
                          ] || "No sample value"
                        )}
                      </p>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                No personalisation variables
                detected.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <h3 className="font-semibold text-gray-900">
              Tracking controls
            </h3>

            <dl className="mt-4">
              <DetailRow
                label="Delivery tracking"
                value={
                  campaignData.options
                    ?.trackDelivery !== false
                    ? "Enabled"
                    : "Disabled"
                }
              />

              <DetailRow
                label="Open tracking"
                value={
                  campaignData.options
                    ?.trackOpens !== false
                    ? "Enabled"
                    : "Disabled"
                }
              />

              <DetailRow
                label="Response tracking"
                value={
                  campaignData.options
                    ?.trackResponses !== false
                    ? "Enabled"
                    : "Disabled"
                }
              />

              <DetailRow
                label="Contact logs"
                value={
                  campaignData.options
                    ?.createContactLogs !==
                  false
                    ? "Enabled"
                    : "Disabled"
                }
              />
            </dl>
          </section>
        </aside>
      </div>
    );
  }

  function renderAudienceTab() {
    const audience =
      campaignData.audience || {};

    const sample =
      Array.isArray(audiencePreview?.sample)
        ? audiencePreview.sample
        : [];

    const selectedCustomers =
      Array.isArray(audience.customerIds)
        ? audience.customerIds
        : [];

    const excludedCustomers =
      Array.isArray(
        audience.excludedCustomerIds
      )
        ? audience.excludedCustomerIds
        : [];

    return (
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            title="Matched Customers"
            value={formatNumber(
              audiencePreview
                ?.totalMatchedCustomers
            )}
          />

          <MetricCard
            title="Eligible Recipients"
            value={formatNumber(
              audiencePreview
                ?.estimatedRecipients ??
                audience.estimatedRecipients
            )}
          />

          <MetricCard
            title="Skipped Customers"
            value={formatNumber(
              audiencePreview
                ?.skippedRecipients
            )}
          />
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Users
                  className="text-indigo-600"
                  size={19}
                />

                <h3 className="font-semibold text-gray-900">
                  Audience configuration
                </h3>
              </div>

              <p className="mt-1 text-sm text-gray-500">
                {getAudienceTypeLabel(
                  audience.type
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={handleRefreshAudience}
              disabled={
                refreshingAudience ||
                !campaignId
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCcw
                size={16}
                className={
                  refreshingAudience
                    ? "animate-spin"
                    : ""
                }
              />

              {refreshingAudience
                ? "Refreshing..."
                : "Refresh Audience"}
            </button>
          </div>

          {audience.type === "segments" ? (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Selected segments
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {(audience.segments || []).map(
                  (segment) => (
                    <span
                      key={segment}
                      className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
                    >
                      {SEGMENT_LABELS[
                        segment
                      ] || segment}
                    </span>
                  )
                )}
              </div>
            </div>
          ) : null}

          {audience.type ===
            "selected_customers" &&
          selectedCustomers.length > 0 ? (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Selected customers
              </p>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selectedCustomers.map(
                  (customer) => (
                    <div
                      key={getRecordId(
                        customer
                      )}
                      className="rounded-xl border border-indigo-200 bg-indigo-50 p-3"
                    >
                      <p className="truncate text-sm font-semibold text-indigo-900">
                        {getCustomerName(
                          customer
                        )}
                      </p>

                      <p className="mt-1 truncate text-xs text-indigo-700">
                        {getCustomerContact(
                          customer
                        ) ||
                          "Contact details unavailable"}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}

          {excludedCustomers.length > 0 ? (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Excluded customers
              </p>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {excludedCustomers.map(
                  (customer) => (
                    <div
                      key={getRecordId(
                        customer
                      )}
                      className="rounded-xl border border-red-200 bg-red-50 p-3"
                    >
                      <p className="truncate text-sm font-semibold text-red-900">
                        {getCustomerName(
                          customer
                        )}
                      </p>

                      <p className="mt-1 truncate text-xs text-red-700">
                        {getCustomerContact(
                          customer
                        ) ||
                          "Contact details unavailable"}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}
        </section>

        {sample.length > 0 ? (
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
              <h3 className="font-semibold text-gray-900">
                Recipient sample
              </h3>

              <p className="mt-1 text-xs text-gray-500">
                Personalised preview for up to
                10 matched customers.
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {sample.map(
                (recipient, index) => (
                  <div
                    key={
                      recipient.customerId ||
                      `${recipient.recipient}-${index}`
                    }
                    className="p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">
                          {recipient.customerName ||
                            "Customer"}
                        </p>

                        <p className="mt-1 truncate text-sm text-gray-500">
                          {recipient.recipient ||
                            "No contact details"}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          recipient.status ===
                          "skipped"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-green-200 bg-green-50 text-green-700"
                        }`}
                      >
                        {recipient.status ===
                        "skipped"
                          ? "Skipped"
                          : "Eligible"}
                      </span>
                    </div>

                    {recipient.status ===
                      "skipped" &&
                    recipient.skipDetails ? (
                      <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                        {recipient.skipDetails}
                      </p>
                    ) : null}

                    {recipient.status !==
                    "skipped" ? (
                      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                        {recipient.subject ? (
                          <p className="font-semibold text-gray-900">
                            {recipient.subject}
                          </p>
                        ) : null}

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                          {recipient.body}
                        </p>
                      </div>
                    ) : null}
                  </div>
                )
              )}
            </div>
          </section>
        ) : null}

        {audiencePreview
          ?.skipReasonCounts &&
        Object.keys(
          audiencePreview.skipReasonCounts
        ).length > 0 ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="font-semibold text-amber-900">
              Skip reasons
            </h3>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(
                audiencePreview.skipReasonCounts
              ).map(([reason, count]) => (
                <div
                  key={reason}
                  className="rounded-lg bg-white p-3"
                >
                  <p className="text-xs capitalize text-amber-700">
                    {reason.replaceAll(
                      "_",
                      " "
                    )}
                  </p>

                  <p className="mt-1 text-xl font-bold text-amber-900">
                    {formatNumber(count)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-preview-title"
      onMouseDown={handleBackdropClick}
    >
      <div className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-5 sm:px-7">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${channelConfig.iconClass}`}
            >
              <ChannelIcon size={22} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="campaign-preview-title"
                  className="truncate text-xl font-bold text-gray-900"
                >
                  {campaignData.name ||
                    "Communication Campaign"}
                </h2>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${channelConfig.badgeClass}`}
                >
                  <ChannelIcon size={13} />
                  {channelConfig.label}
                </span>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusConfig.className}`}
                >
                  <CheckCircle2 size={13} />
                  {statusConfig.label}
                </span>
              </div>

              <p className="mt-1 text-sm text-gray-500">
                {campaignData.description ||
                  "Review campaign configuration, message and audience."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={
              loading ||
              refreshingAudience
            }
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close campaign preview"
          >
            <X size={21} />
          </button>
        </header>

        <nav className="border-b border-gray-200 bg-gray-50 px-5 sm:px-7">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const selected =
                activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setActiveTab(tab.id)
                  }
                  className={`inline-flex min-w-fit items-center gap-2 border-b-2 px-4 py-4 text-sm font-semibold transition ${
                    selected
                      ? "border-indigo-600 text-indigo-700"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900"
                  }`}
                >
                  <Icon size={17} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
          {error ? (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
            >
              <AlertCircle
                className="mt-0.5 shrink-0 text-red-600"
                size={20}
              />

              <div>
                <p className="font-semibold text-red-800">
                  Campaign preview issue
                </p>

                <p className="mt-1 text-sm text-red-700">
                  {error}
                </p>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-96 flex-col items-center justify-center">
              <RefreshCcw
                className="animate-spin text-indigo-600"
                size={30}
              />

              <p className="mt-4 text-sm font-semibold text-gray-700">
                Loading campaign...
              </p>
            </div>
          ) : (
            <>
              {activeTab === "overview"
                ? renderOverviewTab()
                : null}

              {activeTab === "message"
                ? renderMessageTab()
                : null}

              {activeTab === "audience"
                ? renderAudienceTab()
                : null}
            </>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock3 size={14} />

            Updated{" "}
            {formatDateTime(
              campaignData.updatedAt
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onClose?.()}
              disabled={loading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Close
            </button>

            {onEdit &&
            editableStatuses.includes(
              campaignData.status
            ) ? (
              <button
                type="button"
                onClick={handleEdit}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-300 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
              >
                <Edit3 size={17} />
                Edit Campaign
              </button>
            ) : null}

            {onLaunch &&
            launchableStatuses.includes(
              campaignData.status
            ) ? (
              <button
                type="button"
                onClick={handleLaunch}
                disabled={loading}
                className="inline-flex min-w-36 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                <Send size={17} />
                Launch Campaign
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}