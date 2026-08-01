import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  FileText,
  Mail,
  MessageCircle,
  MoreVertical,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import CommunicationTemplateModal from "../components/communications/CommunicationTemplateModal.jsx";
import CommunicationTemplatePreviewModal from "../components/communications/CommunicationTemplatePreviewModal.jsx";

import {
  getCommunicationTemplates,
} from "../Services/communicationTemplateApi.js";

const CHANNELS = {
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

const CAMPAIGN_TYPE_LABELS = {
  dormant_customer: "Dormant Customer",
  appointment_reminder:
    "Appointment Reminder",
  follow_up: "Follow-up",
  promotion: "Promotion",
  birthday: "Birthday",
  general: "General",
};

const CHANNEL_FILTER_OPTIONS = [
  {
    value: "",
    label: "All channels",
  },
  {
    value: "email",
    label: "Email",
  },
  {
    value: "sms",
    label: "SMS",
  },
  {
    value: "whatsapp",
    label: "WhatsApp",
  },
  {
    value: "phone",
    label: "Phone",
  },
  {
    value: "in_app",
    label: "In App",
  },
];

const TYPE_FILTER_OPTIONS = [
  {
    value: "",
    label: "All template types",
  },
  {
    value: "general",
    label: "General",
  },
  {
    value: "promotion",
    label: "Promotion",
  },
  {
    value: "appointment_reminder",
    label: "Appointment Reminder",
  },
  {
    value: "follow_up",
    label: "Follow-up",
  },
  {
    value: "dormant_customer",
    label: "Dormant Customer",
  },
  {
    value: "birthday",
    label: "Birthday",
  },
];

const STATUS_FILTER_OPTIONS = [
  {
    value: "",
    label: "All statuses",
  },
  {
    value: "active",
    label: "Active",
  },
  {
    value: "inactive",
    label: "Inactive",
  },
];

const SORT_OPTIONS = [
  {
    value: "name_asc",
    label: "Name A–Z",
  },
  {
    value: "name_desc",
    label: "Name Z–A",
  },
  {
    value: "recently_updated",
    label: "Recently updated",
  },
  {
    value: "newest",
    label: "Newest first",
  },
  {
    value: "most_used",
    label: "Most used",
  },
];

const DEFAULT_FILTERS = {
  channel: "",
  campaignType: "",
  status: "",
  sort: "name_asc",
};

const PAGE_SIZE = 12;

function getTemplateId(template) {
  return String(
    template?._id ||
      template?.id ||
      template ||
      ""
  ).trim();
}

function getTemplateName(template) {
  return (
    template?.name ||
    template?.title ||
    "Untitled Template"
  );
}

function normalizeTemplatesResponse(response) {
  const payload =
    response?.data ?? response ?? {};

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.templates)) {
    return payload.templates;
  }

  if (
    Array.isArray(payload.data?.templates)
  ) {
    return payload.data.templates;
  }

  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  return [];
}

function getErrorMessage(
  error,
  fallbackMessage
) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallbackMessage
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-GB").format(
    Number(value) || 0
  );
}

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function truncateText(
  value,
  maximumLength = 170
) {
  const text = String(value || "").trim();

  if (!text) {
    return "No description has been added.";
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

function getApiBaseUrl() {
  return (
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api"
  ).replace(/\/$/, "");
}

async function templateRequest(
  path,
  options = {}
) {
  let token = "";

  try {
    token =
      window.localStorage.getItem(
        "token"
      ) || "";
  } catch {
    token = "";
  }

  const headers = {
    Accept: "application/json",
    ...(options.body
      ? {
          "Content-Type":
            "application/json",
        }
      : {}),
    ...(token
      ? {
          Authorization:
            `Bearer ${token}`,
        }
      : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(
    `${getApiBaseUrl()}${path}`,
    {
      ...options,
      headers,
    }
  );

  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  const responseData =
    contentType.includes(
      "application/json"
    )
      ? await response.json()
      : await response.text();

  if (!response.ok) {
    const message =
      typeof responseData === "string"
        ? responseData
        : responseData?.message ||
          responseData?.error ||
          "The template request failed.";

    const error = new Error(message);

    error.status = response.status;
    error.response = {
      status: response.status,
      data: responseData,
    };

    throw error;
  }

  return responseData;
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
}) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-500">
            {title}
          </p>

          {loading ? (
            <div className="mt-3 h-9 w-20 animate-pulse rounded bg-gray-100" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {formatNumber(value)}
            </p>
          )}

          <p className="mt-2 text-xs leading-5 text-gray-500">
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
          <Icon size={21} />
        </div>
      </div>
    </article>
  );
}

function TemplateCard({
  template,
  busyAction,
  onPreview,
  onEdit,
  onDuplicate,
  onToggleStatus,
  onDelete,
  onCreateCampaign,
}) {
  const [menuOpen, setMenuOpen] =
    useState(false);

  const channel =
    CHANNELS[template?.channel] ||
    CHANNELS.in_app;

  const ChannelIcon = channel.icon;

  const templateId =
    getTemplateId(template);

  const active =
    template?.active !== false;

  const variables = Array.isArray(
    template?.variables
  )
    ? template.variables
    : [];

  const usageCount =
    Number(
      template?.usageCount ??
        template?.timesUsed ??
        template?.useCount
    ) || 0;

  const isBusy = Boolean(busyAction);

  function runAction(callback) {
    setMenuOpen(false);
    callback?.(template);
  }

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <header className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${channel.iconClass}`}
          >
            <ChannelIcon size={21} />
          </div>

          <div className="min-w-0">
            <h2
              className="truncate text-lg font-bold text-gray-900"
              title={getTemplateName(
                template
              )}
            >
              {getTemplateName(template)}
            </h2>

            <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-500">
              {truncateText(
                template?.description
              )}
            </p>
          </div>
        </div>

        <div className="relative shrink-0">
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
            aria-label={`Open actions for ${getTemplateName(
              template
            )}`}
            aria-expanded={menuOpen}
          >
            {isBusy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
            ) : (
              <MoreVertical size={19} />
            )}
          </button>

          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-20 cursor-default"
                onClick={() =>
                  setMenuOpen(false)
                }
                aria-label="Close template actions"
              />

              <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                <button
                  type="button"
                  onClick={() =>
                    runAction(onPreview)
                  }
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  <Eye size={16} />
                  Preview template
                </button>

                <button
                  type="button"
                  onClick={() =>
                    runAction(onEdit)
                  }
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  <Edit3 size={16} />
                  Edit template
                </button>

                <button
                  type="button"
                  onClick={() =>
                    runAction(onDuplicate)
                  }
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  <Copy size={16} />
                  Duplicate template
                </button>

                <button
                  type="button"
                  onClick={() =>
                    runAction(
                      onToggleStatus
                    )
                  }
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  {active ? (
                    <Archive size={16} />
                  ) : (
                    <CheckCircle2
                      size={16}
                    />
                  )}

                  {active
                    ? "Deactivate template"
                    : "Activate template"}
                </button>

                <div className="my-1 border-t border-gray-100" />

                <button
                  type="button"
                  onClick={() =>
                    runAction(onDelete)
                  }
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 size={16} />
                  Delete template
                </button>
              </div>
            </>
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
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
              active
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-gray-200 bg-gray-100 text-gray-600"
            }`}
          >
            {active ? (
              <CheckCircle2 size={13} />
            ) : (
              <Archive size={13} />
            )}

            {active
              ? "Active"
              : "Inactive"}
          </span>

          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
            {getCampaignTypeLabel(
              template?.campaignType
            )}
          </span>
        </div>

        {template?.channel === "email" ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">
              Subject
            </p>

            <p
              className="mt-1 truncate text-sm font-semibold text-blue-900"
              title={template?.subject}
            >
              {template?.subject ||
                "No email subject"}
            </p>
          </div>
        ) : null}

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Message preview
          </p>

          <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-gray-600">
            {template?.body ||
              "No message content"}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-900">
              Personalisation variables
            </p>

            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">
              {variables.length}
            </span>
          </div>

          {variables.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {variables
                .slice(0, 6)
                .map((variable) => (
                  <span
                    key={variable}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-mono text-xs font-semibold text-indigo-700"
                  >
                    {`{{${variable}}}`}
                  </span>
                ))}

              {variables.length > 6 ? (
                <span className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600">
                  +{variables.length - 6} more
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              This template has no variables.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              Times used
            </p>

            <p className="mt-1 text-lg font-bold text-gray-900">
              {formatNumber(usageCount)}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              Updated
            </p>

            <p className="mt-1 text-sm font-bold text-gray-900">
              {formatDate(
                template?.updatedAt
              )}
            </p>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-100 bg-gray-50/70 p-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              onPreview?.(template)
            }
            disabled={isBusy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Eye size={16} />
            Preview
          </button>

          <button
            type="button"
            onClick={() =>
              onCreateCampaign?.(template)
            }
            disabled={isBusy || !active}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={16} />
            Use in Campaign
          </button>
        </div>

        <span className="sr-only">
          Template ID: {templateId}
        </span>
      </footer>
    </article>
  );
}

function LoadingCards() {
  return (
    <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map(
        (item) => (
          <div
            key={item}
            className="h-[38rem] animate-pulse overflow-hidden rounded-2xl border border-gray-200 bg-white"
          >
            <div className="border-b border-gray-100 p-5">
              <div className="h-5 w-2/3 rounded bg-gray-100" />
              <div className="mt-3 h-4 w-full rounded bg-gray-100" />
              <div className="mt-2 h-4 w-4/5 rounded bg-gray-100" />
            </div>

            <div className="space-y-4 p-5">
              <div className="h-7 w-3/4 rounded bg-gray-100" />
              <div className="h-24 rounded bg-gray-100" />
              <div className="h-32 rounded bg-gray-100" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-20 rounded bg-gray-100" />
                <div className="h-20 rounded bg-gray-100" />
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default function CommunicationTemplatesPage() {
  const navigate = useNavigate();

  const [templates, setTemplates] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [searchInput, setSearchInput] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [filters, setFilters] =
    useState(DEFAULT_FILTERS);

  const [page, setPage] = useState(1);

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    editingTemplate,
    setEditingTemplate,
  ] = useState(null);

  const [
    previewTemplate,
    setPreviewTemplate,
  ] = useState(null);

  const [
    busyActions,
    setBusyActions,
  ] = useState({});

  const loadTemplates = useCallback(
    async ({
      initialLoad = false,
    } = {}) => {
      try {
        if (initialLoad) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        const response =
          await getCommunicationTemplates({
            limit: 250,
            sort: "name_asc",
          });

        setTemplates(
          normalizeTemplatesResponse(
            response
          )
        );
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            "Unable to load communication templates."
          )
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadTemplates({
      initialLoad: true,
    });
  }, [loadTemplates]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        setSearch(
          searchInput.trim().toLowerCase()
        );
        setPage(1);
      },
      350
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  const filteredTemplates = useMemo(() => {
    const result = templates.filter(
      (template) => {
        const searchableText = [
          template?.name,
          template?.title,
          template?.description,
          template?.subject,
          template?.body,
          template?.channel,
          template?.campaignType,
          ...(template?.variables || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (
          search &&
          !searchableText.includes(search)
        ) {
          return false;
        }

        if (
          filters.channel &&
          template?.channel !==
            filters.channel
        ) {
          return false;
        }

        if (
          filters.campaignType &&
          template?.campaignType !==
            filters.campaignType
        ) {
          return false;
        }

        if (
          filters.status === "active" &&
          template?.active === false
        ) {
          return false;
        }

        if (
          filters.status === "inactive" &&
          template?.active !== false
        ) {
          return false;
        }

        return true;
      }
    );

    return result.sort(
      (firstTemplate, secondTemplate) => {
        switch (filters.sort) {
          case "name_desc":
            return getTemplateName(
              secondTemplate
            ).localeCompare(
              getTemplateName(firstTemplate)
            );

          case "recently_updated":
            return (
              new Date(
                secondTemplate.updatedAt || 0
              ).getTime() -
              new Date(
                firstTemplate.updatedAt || 0
              ).getTime()
            );

          case "newest":
            return (
              new Date(
                secondTemplate.createdAt || 0
              ).getTime() -
              new Date(
                firstTemplate.createdAt || 0
              ).getTime()
            );

          case "most_used":
            return (
              Number(
                secondTemplate.usageCount ||
                  secondTemplate.timesUsed ||
                  0
              ) -
              Number(
                firstTemplate.usageCount ||
                  firstTemplate.timesUsed ||
                  0
              )
            );

          case "name_asc":
          default:
            return getTemplateName(
              firstTemplate
            ).localeCompare(
              getTemplateName(secondTemplate)
            );
        }
      }
    );
  }, [templates, search, filters]);

  const pageCount = Math.max(
    1,
    Math.ceil(
      filteredTemplates.length /
        PAGE_SIZE
    )
  );

  const paginatedTemplates =
    useMemo(() => {
      const safePage = Math.min(
        page,
        pageCount
      );

      const startIndex =
        (safePage - 1) * PAGE_SIZE;

      return filteredTemplates.slice(
        startIndex,
        startIndex + PAGE_SIZE
      );
    }, [
      filteredTemplates,
      page,
      pageCount,
    ]);

  const statistics = useMemo(() => {
    return templates.reduce(
      (summary, template) => {
        summary.total += 1;

        if (template?.active === false) {
          summary.inactive += 1;
        } else {
          summary.active += 1;
        }

        summary.totalUsage +=
          Number(
            template?.usageCount ||
              template?.timesUsed ||
              0
          ) || 0;

        if (
          template?.channel === "email"
        ) {
          summary.email += 1;
        }

        return summary;
      },
      {
        total: 0,
        active: 0,
        inactive: 0,
        email: 0,
        totalUsage: 0,
      }
    );
  }, [templates]);

  const activeFilterCount = [
    search,
    filters.channel,
    filters.campaignType,
    filters.status,
  ].filter(Boolean).length;

  function setBusyAction(
    template,
    action
  ) {
    const templateId =
      getTemplateId(template);

    setBusyActions(
      (currentActions) => {
        const nextActions = {
          ...currentActions,
        };

        if (action) {
          nextActions[templateId] =
            action;
        } else {
          delete nextActions[
            templateId
          ];
        }

        return nextActions;
      }
    );
  }

  function updateFilter(field, value) {
    setFilters(
      (currentFilters) => ({
        ...currentFilters,
        [field]: value,
      })
    );

    setPage(1);
    setSuccessMessage("");
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    setSuccessMessage("");
  }

  function openCreateModal() {
    setEditingTemplate(null);
    setModalOpen(true);
    setSuccessMessage("");
  }

  function openEditModal(template) {
    setPreviewTemplate(null);
    setEditingTemplate(template);
    setModalOpen(true);
    setSuccessMessage("");
  }

  function closeTemplateModal() {
    setModalOpen(false);
    setEditingTemplate(null);
  }

  async function handleTemplateSaved(
    savedTemplate
  ) {
    const wasEditing = Boolean(
      getTemplateId(editingTemplate)
    );

    const templateName =
      savedTemplate?.name ||
      editingTemplate?.name ||
      "Communication template";

    closeTemplateModal();

    setSuccessMessage(
      wasEditing
        ? `${templateName} was updated successfully.`
        : `${templateName} was created successfully.`
    );

    await loadTemplates();
  }

  async function runTemplateAction({
    template,
    action,
    request,
    message,
  }) {
    try {
      setBusyAction(template, action);
      setError("");
      setSuccessMessage("");

      const response =
        await request();

      setSuccessMessage(
        typeof message === "function"
          ? message(response)
          : message
      );

      await loadTemplates();

      return response;
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          `Unable to ${action} the communication template.`
        )
      );

      return null;
    } finally {
      setBusyAction(template, "");
    }
  }

  async function handleDuplicate(
    template
  ) {
    const templateId =
      getTemplateId(template);

    if (!templateId) {
      setError(
        "The selected template does not have a valid ID."
      );
      return;
    }

    const templateName =
      getTemplateName(template);

    await runTemplateAction({
      template,
      action: "duplicate",

      request: () =>
        templateRequest(
          `/communication-templates/${templateId}/duplicate`,
          {
            method: "POST",
            body: JSON.stringify({
              name: `${templateName} Copy`,
            }),
          }
        ),

      message: `${templateName} was duplicated successfully.`,
    });
  }

  async function handleToggleStatus(
    template
  ) {
    const templateId =
      getTemplateId(template);

    if (!templateId) {
      setError(
        "The selected template does not have a valid ID."
      );
      return;
    }

    const currentlyActive =
      template?.active !== false;

    const actionLabel =
      currentlyActive
        ? "deactivate"
        : "activate";

    const confirmed =
      window.confirm(
        `${currentlyActive ? "Deactivate" : "Activate"} “${getTemplateName(
          template
        )}”?`
      );

    if (!confirmed) {
      return;
    }

    await runTemplateAction({
      template,
      action: actionLabel,

      request: () =>
        templateRequest(
          `/communication-templates/${templateId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              active:
                !currentlyActive,
            }),
          }
        ),

      message: `${getTemplateName(
        template
      )} was ${currentlyActive ? "deactivated" : "activated"} successfully.`,
    });
  }

  async function handleDelete(template) {
    const templateId =
      getTemplateId(template);

    if (!templateId) {
      setError(
        "The selected template does not have a valid ID."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Delete “${getTemplateName(
          template
        )}”?\n\nThis action permanently removes the message template.`
      );

    if (!confirmed) {
      return;
    }

    await runTemplateAction({
      template,
      action: "delete",

      request: () =>
        templateRequest(
          `/communication-templates/${templateId}`,
          {
            method: "DELETE",
          }
        ),

      message: `${getTemplateName(
        template
      )} was deleted successfully.`,
    });
  }

  function handleCreateCampaign(
    template
  ) {
    const templatePayload = {
      ...template,
      _id: getTemplateId(template),
    };

    try {
      window.sessionStorage.setItem(
        "salonai-campaign-template",
        JSON.stringify(templatePayload)
      );
    } catch {
      // React Router state remains available.
    }

    navigate(
      "/communication-campaigns",
      {
        state: {
          initialTemplate:
            templatePayload,
          openComposer: true,
          source:
            "communication-templates",
        },
      }
    );
  }

  return (
    <main className="space-y-8 p-6">
      <header className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-blue-50 p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <FileText size={27} />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Message Templates
              </h1>

              <p className="mt-2 max-w-2xl text-gray-600">
                Create reusable customer
                communications and send them
                directly to the Campaign
                Composer for audience targeting,
                personalisation and scheduling.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus size={18} />
            Create Template
          </button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 shrink-0 text-red-600"
              size={20}
            />

            <div>
              <p className="font-semibold text-red-800">
                Template request failed
              </p>

              <p className="mt-1 text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-500 transition hover:text-red-700"
            aria-label="Dismiss error"
          >
            <X size={18} />
          </button>
        </div>
      ) : null}

      {successMessage ? (
        <div
          role="status"
          className="flex items-start justify-between gap-4 rounded-xl border border-green-200 bg-green-50 p-4"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 shrink-0 text-green-600"
              size={20}
            />

            <p className="text-sm font-medium text-green-800">
              {successMessage}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setSuccessMessage("")
            }
            className="text-green-500 transition hover:text-green-700"
            aria-label="Dismiss message"
          >
            <X size={18} />
          </button>
        </div>
      ) : null}

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Total Templates"
          value={statistics.total}
          description="All reusable messages"
          icon={FileText}
          loading={loading}
        />

        <SummaryCard
          title="Active"
          value={statistics.active}
          description="Available for campaigns"
          icon={CheckCircle2}
          loading={loading}
        />

        <SummaryCard
          title="Inactive"
          value={statistics.inactive}
          description="Archived templates"
          icon={Archive}
          loading={loading}
        />

        <SummaryCard
          title="Email Templates"
          value={statistics.email}
          description="Templates with subjects"
          icon={Mail}
          loading={loading}
        />

        <SummaryCard
          title="Total Uses"
          value={statistics.totalUsage}
          description="Recorded template usage"
          icon={Send}
          loading={loading}
        />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative md:col-span-2">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />

            <input
              type="search"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(
                  event.target.value
                )
              }
              placeholder="Search templates..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <select
            value={filters.channel}
            onChange={(event) =>
              updateFilter(
                "channel",
                event.target.value
              )
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            {CHANNEL_FILTER_OPTIONS.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              )
            )}
          </select>

          <select
            value={
              filters.campaignType
            }
            onChange={(event) =>
              updateFilter(
                "campaignType",
                event.target.value
              )
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            {TYPE_FILTER_OPTIONS.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              )
            )}
          </select>

          <select
            value={filters.status}
            onChange={(event) =>
              updateFilter(
                "status",
                event.target.value
              )
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            {STATUS_FILTER_OPTIONS.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              )
            )}
          </select>

          <select
            value={filters.sort}
            onChange={(event) =>
              updateFilter(
                "sort",
                event.target.value
              )
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            {SORT_OPTIONS.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              )
            )}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            {formatNumber(
              filteredTemplates.length
            )}{" "}
            templates · {activeFilterCount} active
            filter
            {activeFilterCount === 1
              ? ""
              : "s"}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={clearFilters}
              disabled={
                loading || refreshing
              }
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Clear Filters
            </button>

            <button
              type="button"
              onClick={() =>
                loadTemplates()
              }
              disabled={
                loading || refreshing
              }
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCcw
                size={16}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>
          </div>
        </div>
      </section>

      <section aria-label="Message templates">
        {loading ? (
          <LoadingCards />
        ) : paginatedTemplates.length ===
          0 ? (
          <div className="flex min-h-96 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <FileText size={27} />
            </div>

            <h2 className="mt-5 text-xl font-bold text-gray-900">
              No templates found
            </h2>

            <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
              Create a reusable customer
              message or adjust the current
              filters.
            </p>

            <button
              type="button"
              onClick={openCreateModal}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <Plus size={17} />
              Create Template
            </button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {paginatedTemplates.map(
              (template) => {
                const templateId =
                  getTemplateId(template);

                return (
                  <TemplateCard
                    key={templateId}
                    template={template}
                    busyAction={
                      busyActions[
                        templateId
                      ] || ""
                    }
                    onPreview={
                      setPreviewTemplate
                    }
                    onEdit={
                      openEditModal
                    }
                    onDuplicate={
                      handleDuplicate
                    }
                    onToggleStatus={
                      handleToggleStatus
                    }
                    onDelete={
                      handleDelete
                    }
                    onCreateCampaign={
                      handleCreateCampaign
                    }
                  />
                );
              }
            )}
          </div>
        )}
      </section>

      {pageCount > 1 ? (
        <nav
          className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
          aria-label="Template pagination"
        >
          <p className="text-sm text-gray-500">
            Page {page} of {pageCount} ·{" "}
            {formatNumber(
              filteredTemplates.length
            )}{" "}
            templates
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setPage(
                  (currentPage) =>
                    Math.max(
                      1,
                      currentPage - 1
                    )
                )
              }
              disabled={
                page <= 1 || refreshing
              }
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>

            <button
              type="button"
              onClick={() =>
                setPage(
                  (currentPage) =>
                    Math.min(
                      pageCount,
                      currentPage + 1
                    )
                )
              }
              disabled={
                page >= pageCount ||
                refreshing
              }
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </nav>
      ) : null}

      <CommunicationTemplateModal
        open={modalOpen}
        template={editingTemplate}
        onClose={closeTemplateModal}
        onSaved={handleTemplateSaved}
      />

      <CommunicationTemplatePreviewModal
        open={Boolean(
          previewTemplate
        )}
        template={previewTemplate}
        onClose={() =>
          setPreviewTemplate(null)
        }
        onEdit={openEditModal}
        onCreateCampaign={
          handleCreateCampaign
        }
      />
    </main>
  );
}