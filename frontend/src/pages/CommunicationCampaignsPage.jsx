import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Filter,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";

import CampaignComposerModal from "../components/communications/CampaignComposerModal.jsx";
import CampaignPreviewModal from "../components/communications/CampaignPreviewModal.jsx";
import CommunicationCampaignCard from "../components/communications/CommunicationCampaignCard.jsx";

import {
  cancelCommunicationCampaign,
  deleteCommunicationCampaign,
  duplicateCommunicationCampaign,
  getCommunicationCampaignErrorMessage,
  getCommunicationCampaigns,
  getCommunicationCampaignSummary,
  launchCommunicationCampaign,
  pauseCommunicationCampaign,
  refreshCommunicationCampaignDeliveryCounts,
  resumeCommunicationCampaign,
} from "../Services/communicationCampaignApi.js";

const TEMPLATE_STORAGE_KEY =
  "salonai-campaign-template";

const STATUS_OPTIONS = [
  {
    value: "",
    label: "All statuses",
  },
  {
    value: "draft",
    label: "Draft",
  },
  {
    value: "scheduled",
    label: "Scheduled",
  },
  {
    value: "queued",
    label: "Queued",
  },
  {
    value: "processing",
    label: "Processing",
  },
  {
    value: "paused",
    label: "Paused",
  },
  {
    value: "completed",
    label: "Completed",
  },
  {
    value: "partially_completed",
    label: "Partially Completed",
  },
  {
    value: "failed",
    label: "Failed",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
];

const CAMPAIGN_TYPE_OPTIONS = [
  {
    value: "",
    label: "All campaign types",
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

const CHANNEL_OPTIONS = [
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

const SEND_MODE_OPTIONS = [
  {
    value: "",
    label: "All send modes",
  },
  {
    value: "draft",
    label: "Draft",
  },
  {
    value: "immediate",
    label: "Immediate",
  },
  {
    value: "scheduled",
    label: "Scheduled",
  },
];

const SORT_OPTIONS = [
  {
    value: "recently_updated",
    label: "Recently updated",
  },
  {
    value: "newest",
    label: "Newest first",
  },
  {
    value: "oldest",
    label: "Oldest first",
  },
  {
    value: "name_asc",
    label: "Name A–Z",
  },
  {
    value: "name_desc",
    label: "Name Z–A",
  },
  {
    value: "scheduled_first",
    label: "Scheduled first",
  },
  {
    value: "most_recipients",
    label: "Most recipients",
  },
];

const DEFAULT_FILTERS = {
  status: "",
  campaignType: "",
  channel: "",
  sendMode: "",
  sort: "recently_updated",
};

const EMPTY_SUMMARY = {
  total: 0,
  totalRecipients: 0,
  sent: 0,
  delivered: 0,
  opened: 0,
  responded: 0,
  failed: 0,
  scheduled: 0,
  active: 0,
  completed: 0,
};

function getCampaignId(campaign) {
  return String(
    campaign?._id ||
      campaign?.id ||
      campaign ||
      ""
  ).trim();
}

function getCampaignName(campaign) {
  return (
    campaign?.name ||
    "Communication campaign"
  );
}

function getTemplateId(template) {
  return String(
    template?._id ||
      template?.id ||
      template ||
      ""
  ).trim();
}

function normalizeCampaignsResponse(
  response,
  fallbackLimit
) {
  const payload =
    response?.data ?? response ?? {};

  const campaigns = Array.isArray(
    payload.campaigns
  )
    ? payload.campaigns
    : [];

  const suppliedPagination =
    payload.pagination || {};

  const total =
    Number(suppliedPagination.total) ||
    campaigns.length;

  const limit =
    Number(suppliedPagination.limit) ||
    fallbackLimit;

  return {
    campaigns,

    pagination: {
      page:
        Number(suppliedPagination.page) ||
        1,

      limit,

      total,

      pages: Math.max(
        1,
        Number(
          suppliedPagination.pages
        ) ||
          Math.ceil(total / limit) ||
          1
      ),
    },
  };
}

function normalizeSummaryResponse(
  response
) {
  const payload =
    response?.data ?? response ?? {};

  return {
    summary: {
      ...EMPTY_SUMMARY,
      ...(payload.summary || {}),
    },

    byStatus: Array.isArray(
      payload.byStatus
    )
      ? payload.byStatus
      : [],

    byChannel: Array.isArray(
      payload.byChannel
    )
      ? payload.byChannel
      : [],

    byCampaignType: Array.isArray(
      payload.byCampaignType
    )
      ? payload.byCampaignType
      : [],

    upcomingScheduled: Array.isArray(
      payload.upcomingScheduled
    )
      ? payload.upcomingScheduled
      : [],
  };
}

function readStoredTemplate() {
  try {
    const storedValue =
      window.sessionStorage.getItem(
        TEMPLATE_STORAGE_KEY
      );

    if (!storedValue) {
      return null;
    }

    const parsedTemplate =
      JSON.parse(storedValue);

    if (
      !parsedTemplate ||
      typeof parsedTemplate !==
        "object"
    ) {
      return null;
    }

    return parsedTemplate;
  } catch {
    return null;
  }
}

function removeStoredTemplate() {
  try {
    window.sessionStorage.removeItem(
      TEMPLATE_STORAGE_KEY
    );
  } catch {
    // Continue when session storage is unavailable.
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat(
    "en-GB"
  ).format(Number(value) || 0);
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
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-500">
            {title}
          </p>

          {loading ? (
            <div className="mt-3 h-9 w-24 animate-pulse rounded bg-gray-100" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {value}
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

function LoadingCampaignCards() {
  return (
    <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map(
        (item) => (
          <div
            key={item}
            className="h-[42rem] animate-pulse overflow-hidden rounded-2xl border border-gray-200 bg-white"
          >
            <div className="border-b border-gray-100 p-5">
              <div className="h-5 w-2/3 rounded bg-gray-100" />

              <div className="mt-3 h-4 w-full rounded bg-gray-100" />

              <div className="mt-2 h-4 w-4/5 rounded bg-gray-100" />
            </div>

            <div className="space-y-4 p-5">
              <div className="h-7 w-3/4 rounded bg-gray-100" />

              <div className="h-20 rounded bg-gray-100" />

              <div className="grid grid-cols-2 gap-3">
                <div className="h-24 rounded bg-gray-100" />

                <div className="h-24 rounded bg-gray-100" />
              </div>

              <div className="h-24 rounded bg-gray-100" />

              <div className="h-20 rounded bg-gray-100" />
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default function CommunicationCampaignsPage({
  recordsPerPage = 12,
  initialTemplate = null,
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const consumedTemplateRef =
    useRef("");

  const [campaigns, setCampaigns] =
    useState([]);

  const [summaryData, setSummaryData] =
    useState({
      summary: EMPTY_SUMMARY,
      byStatus: [],
      byChannel: [],
      byCampaignType: [],
      upcomingScheduled: [],
    });

  const [pagination, setPagination] =
    useState({
      page: 1,
      limit: recordsPerPage,
      total: 0,
      pages: 1,
    });

  const [searchInput, setSearchInput] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [filters, setFilters] =
    useState(DEFAULT_FILTERS);

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

  const [
    composerOpen,
    setComposerOpen,
  ] = useState(false);

  const [
    editingCampaign,
    setEditingCampaign,
  ] = useState(null);

  const [
    composerTemplate,
    setComposerTemplate,
  ] = useState(null);

  const [
    previewCampaign,
    setPreviewCampaign,
  ] = useState(null);

  const [
    busyActions,
    setBusyActions,
  ] = useState({});

  const summary =
    summaryData.summary ||
    EMPTY_SUMMARY;

  const activeFilterCount =
    useMemo(() => {
      return [
        search,
        filters.status,
        filters.campaignType,
        filters.channel,
        filters.sendMode,
      ].filter(Boolean).length;
    }, [
      search,
      filters.status,
      filters.campaignType,
      filters.channel,
      filters.sendMode,
    ]);

  const setCampaignBusyAction =
    useCallback(
      (campaignId, action) => {
        setBusyActions(
          (currentActions) => {
            if (!action) {
              const nextActions = {
                ...currentActions,
              };

              delete nextActions[
                campaignId
              ];

              return nextActions;
            }

            return {
              ...currentActions,
              [campaignId]: action,
            };
          }
        );
      },
      []
    );

  const loadCampaigns = useCallback(
    async ({
      page = 1,
      initialLoad = false,
    } = {}) => {
      try {
        if (initialLoad) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        const commonFilters = {
          search: search || undefined,

          status:
            filters.status ||
            undefined,

          campaignType:
            filters.campaignType ||
            undefined,

          channel:
            filters.channel ||
            undefined,

          sendMode:
            filters.sendMode ||
            undefined,
        };

        const campaignRequest =
          getCommunicationCampaigns({
            ...commonFilters,
            page,
            limit: recordsPerPage,
            sort: filters.sort,
          });

        const summaryRequest =
          getCommunicationCampaignSummary(
            commonFilters
          );

        const [
          campaignResult,
          summaryResult,
        ] = await Promise.allSettled(
          [
            campaignRequest,
            summaryRequest,
          ]
        );

        if (
          campaignResult.status ===
          "fulfilled"
        ) {
          const normalizedCampaigns =
            normalizeCampaignsResponse(
              campaignResult.value,
              recordsPerPage
            );

          setCampaigns(
            normalizedCampaigns.campaigns
          );

          setPagination(
            normalizedCampaigns.pagination
          );
        } else {
          setError(
            getCommunicationCampaignErrorMessage(
              campaignResult.reason,
              "Unable to load communication campaigns."
            )
          );
        }

        if (
          summaryResult.status ===
          "fulfilled"
        ) {
          setSummaryData(
            normalizeSummaryResponse(
              summaryResult.value
            )
          );
        } else if (
          campaignResult.status ===
          "fulfilled"
        ) {
          setError(
            getCommunicationCampaignErrorMessage(
              summaryResult.reason,
              "Campaigns loaded, but campaign analytics are unavailable."
            )
          );
        }
      } catch (requestError) {
        setError(
          getCommunicationCampaignErrorMessage(
            requestError,
            "Unable to load communication campaigns."
          )
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      search,
      filters.status,
      filters.campaignType,
      filters.channel,
      filters.sendMode,
      filters.sort,
      recordsPerPage,
    ]
  );

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        setSearch(
          searchInput.trim()
        );
      }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    loadCampaigns({
      page: 1,
      initialLoad: true,
    });
  }, [loadCampaigns]);

  /*
  |--------------------------------------------------------------------------
  | Message Template → Campaign Composer integration
  |--------------------------------------------------------------------------
  |
  | The template page transfers a template using React Router state and
  | sessionStorage. Router state is the primary source. sessionStorage acts
  | as a fallback if the navigation state is lost during a page refresh.
  |
  */

  useEffect(() => {
    const routeTemplate =
      location.state?.initialTemplate;

    const storedTemplate =
      readStoredTemplate();

    const transferredTemplate =
      routeTemplate ||
      storedTemplate ||
      initialTemplate;

    const shouldOpenComposer =
      location.state?.openComposer ===
        true ||
      Boolean(routeTemplate) ||
      Boolean(storedTemplate) ||
      Boolean(initialTemplate);

    if (
      !shouldOpenComposer ||
      !transferredTemplate
    ) {
      return;
    }

    const templateId =
      getTemplateId(
        transferredTemplate
      );

    const transferKey = [
      location.key,
      templateId,
      transferredTemplate.name ||
        transferredTemplate.title ||
        "template",
    ].join(":");

    if (
      consumedTemplateRef.current ===
      transferKey
    ) {
      return;
    }

    consumedTemplateRef.current =
      transferKey;

    setEditingCampaign(null);

    setComposerTemplate(
      transferredTemplate
    );

    setComposerOpen(true);

    setPreviewCampaign(null);

    setError("");

    setSuccessMessage(
      `${transferredTemplate.name || transferredTemplate.title || "The selected template"} was loaded into the Campaign Composer.`
    );

    removeStoredTemplate();

    if (
      location.state
        ?.initialTemplate ||
      location.state?.openComposer
    ) {
      navigate(location.pathname, {
        replace: true,
        state: null,
      });
    }
  }, [
    initialTemplate,
    location.key,
    location.pathname,
    location.state,
    navigate,
  ]);

  function updateFilter(
    field,
    value
  ) {
    setFilters(
      (currentFilters) => ({
        ...currentFilters,
        [field]: value,
      })
    );

    setSuccessMessage("");
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setFilters(DEFAULT_FILTERS);
    setSuccessMessage("");
  }

  function handleRefresh() {
    setSuccessMessage("");

    loadCampaigns({
      page: pagination.page,
      initialLoad: false,
    });
  }

  function handlePageChange(
    page
  ) {
    const safePage = Math.min(
      Math.max(
        1,
        Number(page) || 1
      ),
      Math.max(
        1,
        pagination.pages
      )
    );

    loadCampaigns({
      page: safePage,
      initialLoad: false,
    });
  }

  function openCreateComposer() {
    setEditingCampaign(null);

    setComposerTemplate(null);

    setComposerOpen(true);

    setSuccessMessage("");
  }

  function openEditComposer(
    campaign
  ) {
    setPreviewCampaign(null);

    setEditingCampaign(campaign);

    setComposerTemplate(null);

    setComposerOpen(true);

    setSuccessMessage("");
  }

  function closeComposer() {
    setComposerOpen(false);

    setEditingCampaign(null);

    setComposerTemplate(null);

    removeStoredTemplate();
  }

  async function handleCampaignSaved(
    savedCampaign
  ) {
    const wasEditing = Boolean(
      getCampaignId(
        editingCampaign
      )
    );

    const campaignName =
      savedCampaign?.name ||
      editingCampaign?.name ||
      "Communication campaign";

    closeComposer();

    setSuccessMessage(
      wasEditing
        ? `${campaignName} was updated successfully.`
        : `${campaignName} was created successfully.`
    );

    await loadCampaigns({
      page: wasEditing
        ? pagination.page
        : 1,

      initialLoad: false,
    });
  }

  async function runCampaignAction({
    campaign,
    action,
    request,
    successMessage: message,
    targetPage = pagination.page,
  }) {
    const campaignId =
      getCampaignId(campaign);

    if (!campaignId) {
      setError(
        "The selected campaign does not have a valid ID."
      );

      return null;
    }

    try {
      setCampaignBusyAction(
        campaignId,
        action
      );

      setError("");

      setSuccessMessage("");

      const response =
        await request();

      setSuccessMessage(
        typeof message ===
          "function"
          ? message(response)
          : message
      );

      await loadCampaigns({
        page: targetPage,
        initialLoad: false,
      });

      return response;
    } catch (requestError) {
      setError(
        getCommunicationCampaignErrorMessage(
          requestError,
          `Unable to ${action} the communication campaign.`
        )
      );

      return null;
    } finally {
      setCampaignBusyAction(
        campaignId,
        ""
      );
    }
  }

  async function handleDuplicate(
    campaign
  ) {
    const campaignName =
      getCampaignName(campaign);

    await runCampaignAction({
      campaign,
      action: "duplicate",

      request: () =>
        duplicateCommunicationCampaign(
          campaign,
          {
            name: `${campaignName} Copy`,
          }
        ),

      successMessage: (
        response
      ) => {
        const duplicatedCampaign =
          response?.campaign ||
          response?.data
            ?.campaign ||
          response?.data ||
          response;

        return `${
          duplicatedCampaign?.name ||
          `${campaignName} Copy`
        } was created successfully.`;
      },

      targetPage: 1,
    });
  }

  async function handleLaunch(
    campaign
  ) {
    const confirmed =
      window.confirm(
        `Launch “${getCampaignName(
          campaign
        )}” now?\n\nEligible recipients will be prepared and queued for delivery.`
      );

    if (!confirmed) {
      return;
    }

    setPreviewCampaign(null);

    await runCampaignAction({
      campaign,
      action: "launch",

      request: () =>
        launchCommunicationCampaign(
          campaign
        ),

      successMessage: `${getCampaignName(
        campaign
      )} was queued for delivery successfully.`,
    });
  }

  async function handlePause(
    campaign
  ) {
    const confirmed =
      window.confirm(
        `Pause “${getCampaignName(
          campaign
        )}”?\n\nQueued recipients will be returned to a pending state.`
      );

    if (!confirmed) {
      return;
    }

    await runCampaignAction({
      campaign,
      action: "pause",

      request: () =>
        pauseCommunicationCampaign(
          campaign
        ),

      successMessage: `${getCampaignName(
        campaign
      )} was paused successfully.`,
    });
  }

  async function handleResume(
    campaign
  ) {
    const confirmed =
      window.confirm(
        `Resume “${getCampaignName(
          campaign
        )}” and return its pending recipients to the delivery queue?`
      );

    if (!confirmed) {
      return;
    }

    await runCampaignAction({
      campaign,
      action: "resume",

      request: () =>
        resumeCommunicationCampaign(
          campaign
        ),

      successMessage: `${getCampaignName(
        campaign
      )} was resumed successfully.`,
    });
  }

  async function handleCancel(
    campaign
  ) {
    const reason =
      window.prompt(
        `Cancel “${getCampaignName(
          campaign
        )}”?\n\nEnter an optional cancellation reason:`,
        ""
      );

    if (reason === null) {
      return;
    }

    await runCampaignAction({
      campaign,
      action: "cancel",

      request: () =>
        cancelCommunicationCampaign(
          campaign,
          reason
        ),

      successMessage: `${getCampaignName(
        campaign
      )} was cancelled successfully.`,
    });
  }

  async function handleRefreshCounts(
    campaign
  ) {
    await runCampaignAction({
      campaign,
      action: "refresh",

      request: () =>
        refreshCommunicationCampaignDeliveryCounts(
          campaign
        ),

      successMessage: `${getCampaignName(
        campaign
      )} statistics were refreshed successfully.`,
    });
  }

  async function handleDelete(
    campaign
  ) {
    const confirmed =
      window.confirm(
        `Delete “${getCampaignName(
          campaign
        )}”?\n\nThe campaign and its recipient records will be permanently removed.`
      );

    if (!confirmed) {
      return;
    }

    const targetPage =
      campaigns.length === 1 &&
      pagination.page > 1
        ? pagination.page - 1
        : pagination.page;

    await runCampaignAction({
      campaign,
      action: "delete",

      request: () =>
        deleteCommunicationCampaign(
          campaign
        ),

      successMessage: `${getCampaignName(
        campaign
      )} was deleted successfully.`,

      targetPage,
    });
  }

  return (
    <main className="space-y-8 p-6">
      <header className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-blue-50 p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <Send size={27} />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Campaign Composer
              </h1>

              <p className="mt-2 max-w-2xl text-gray-600">
                Create, schedule and
                manage personalised
                customer communication
                campaigns across email,
                SMS, WhatsApp, phone and
                in-app channels.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={
              openCreateComposer
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus size={18} />
            Create Campaign
          </button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 shrink-0 text-red-600"
              size={20}
            />

            <div>
              <p className="font-semibold text-red-800">
                Campaign request
                failed
              </p>

              <p className="mt-1 text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
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
            aria-label="Dismiss success message"
          >
            <X size={18} />
          </button>
        </div>
      ) : null}

      <section
        aria-label="Campaign statistics"
        className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5"
      >
        <SummaryCard
          title="Total Campaigns"
          value={formatNumber(
            summary.total
          )}
          description="All communication campaigns"
          icon={Send}
          loading={loading}
        />

        <SummaryCard
          title="Scheduled"
          value={formatNumber(
            summary.scheduled
          )}
          description="Campaigns awaiting delivery"
          icon={CalendarClock}
          loading={loading}
        />

        <SummaryCard
          title="Active"
          value={formatNumber(
            summary.active
          )}
          description="Queued, processing or paused"
          icon={Activity}
          loading={loading}
        />

        <SummaryCard
          title="Completed"
          value={formatNumber(
            summary.completed
          )}
          description="Completed campaign runs"
          icon={CheckCircle2}
          loading={loading}
        />

        <SummaryCard
          title="Recipients"
          value={formatNumber(
            summary.totalRecipients
          )}
          description="Total campaign recipients"
          icon={Users}
          loading={loading}
        />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Filter
                className="text-gray-500"
                size={19}
              />

              <div>
                <h2 className="font-semibold text-gray-900">
                  Campaign filters
                </h2>

                <p className="mt-0.5 text-xs text-gray-500">
                  {activeFilterCount}{" "}
                  active filter
                  {activeFilterCount ===
                  1
                    ? ""
                    : "s"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={clearFilters}
                disabled={
                  loading ||
                  refreshing
                }
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear Filters
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={
                  loading ||
                  refreshing
                }
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                placeholder="Search campaigns..."
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

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
              {STATUS_OPTIONS.map(
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
              {CAMPAIGN_TYPE_OPTIONS.map(
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
              value={filters.channel}
              onChange={(event) =>
                updateFilter(
                  "channel",
                  event.target.value
                )
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {CHANNEL_OPTIONS.map(
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
                filters.sendMode
              }
              onChange={(event) =>
                updateFilter(
                  "sendMode",
                  event.target.value
                )
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {SEND_MODE_OPTIONS.map(
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

          <div className="flex justify-end">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Sort by

              <select
                value={filters.sort}
                onChange={(event) =>
                  updateFilter(
                    "sort",
                    event.target.value
                  )
                }
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
            </label>
          </div>
        </div>
      </section>

      <section aria-label="Communication campaigns">
        {loading ? (
          <LoadingCampaignCards />
        ) : campaigns.length === 0 ? (
          <div className="flex min-h-96 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <Send size={27} />
            </div>

            <h2 className="mt-5 text-xl font-bold text-gray-900">
              No campaigns found
            </h2>

            <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
              Create your first
              customer communication
              campaign or adjust the
              current filters.
            </p>

            <button
              type="button"
              onClick={
                openCreateComposer
              }
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <Plus size={17} />
              Create Campaign
            </button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {campaigns.map(
              (campaign) => {
                const campaignId =
                  getCampaignId(
                    campaign
                  );

                return (
                  <CommunicationCampaignCard
                    key={campaignId}
                    campaign={
                      campaign
                    }
                    busyAction={
                      busyActions[
                        campaignId
                      ] || ""
                    }
                    onPreview={
                      setPreviewCampaign
                    }
                    onEdit={
                      openEditComposer
                    }
                    onDuplicate={
                      handleDuplicate
                    }
                    onLaunch={
                      handleLaunch
                    }
                    onPause={
                      handlePause
                    }
                    onResume={
                      handleResume
                    }
                    onCancel={
                      handleCancel
                    }
                    onDelete={
                      handleDelete
                    }
                    onRefreshCounts={
                      handleRefreshCounts
                    }
                  />
                );
              }
            )}
          </div>
        )}
      </section>

      {pagination.pages > 1 ? (
        <nav
          className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
          aria-label="Campaign pagination"
        >
          <p className="text-sm text-gray-500">
            Page {pagination.page} of{" "}
            {pagination.pages} ·{" "}
            {formatNumber(
              pagination.total
            )}{" "}
            campaigns
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                handlePageChange(
                  pagination.page - 1
                )
              }
              disabled={
                pagination.page <=
                  1 || refreshing
              }
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <button
              type="button"
              onClick={() =>
                handlePageChange(
                  pagination.page + 1
                )
              }
              disabled={
                pagination.page >=
                  pagination.pages ||
                refreshing
              }
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </nav>
      ) : null}

      <CampaignComposerModal
        open={composerOpen}
        campaign={
          editingCampaign
        }
        initialTemplate={
          composerTemplate
        }
        onClose={closeComposer}
        onSaved={
          handleCampaignSaved
        }
      />

      <CampaignPreviewModal
        open={Boolean(
          previewCampaign
        )}
        campaign={
          previewCampaign
        }
        onClose={() =>
          setPreviewCampaign(null)
        }
        onEdit={
          openEditComposer
        }
        onLaunch={
          handleLaunch
        }
      />
    </main>
  );
}