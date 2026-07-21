import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle,
  Filter,
  MessagesSquare,
  RefreshCcw,
} from "lucide-react";

import CommunicationCampaignChart from "./CommunicationCampaignChart";
import CommunicationChannelChart from "./CommunicationChannelChart";
import CommunicationPerformanceInsights from "./CommunicationPerformanceInsights";
import CommunicationStatusChart from "./CommunicationStatusChart";
import CustomerContactHistoryTable from "./CustomerContactHistoryTable";
import CustomerContactStats from "./CustomerContactStats";

import {
  deleteCustomerContactLog,
  getCustomerContactCampaignSummary,
  getCustomerContactLogs,
  updateCustomerContactStatus,
} from "../../services/customerContactApi";

const CAMPAIGN_OPTIONS = [
  {
    value: "",
    label: "All campaigns",
  },
  {
    value: "dormant_customer",
    label: "Dormant Customer",
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
    value: "promotion",
    label: "Promotion",
  },
  {
    value: "birthday",
    label: "Birthday",
  },
  {
    value: "general",
    label: "General",
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
    value: "queued",
    label: "Queued",
  },
  {
    value: "sent",
    label: "Sent",
  },
  {
    value: "delivered",
    label: "Delivered",
  },
  {
    value: "opened",
    label: "Opened",
  },
  {
    value: "responded",
    label: "Responded",
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

const PERIOD_OPTIONS = [
  {
    value: 7,
    label: "Last 7 days",
  },
  {
    value: 30,
    label: "Last 30 days",
  },
  {
    value: 90,
    label: "Last 90 days",
  },
  {
    value: 365,
    label: "Last year",
  },
];

function getContactLogId(contactLog) {
  return contactLog?._id ?? contactLog?.id ?? "";
}

function getCustomerName(contactLog) {
  const customer = contactLog?.customer;

  return (
    customer?.fullName?.trim() ||
    customer?.name?.trim() ||
    [customer?.firstName, customer?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    contactLog?.customerName?.trim() ||
    "Customer"
  );
}

function getStartDate(days) {
  const date = new Date();

  date.setHours(0, 0, 0, 0);
  date.setDate(
    date.getDate() - (Number(days) - 1)
  );

  return date.toISOString().split("T")[0];
}

function getEndDate() {
  return new Date().toISOString().split("T")[0];
}

function normalizeSummaryResponse(response) {
  const payload = response?.data ?? response ?? {};

  return {
    summary:
      payload.summary &&
      typeof payload.summary === "object"
        ? payload.summary
        : {},

    byChannel: Array.isArray(payload.byChannel)
      ? payload.byChannel
      : [],

    byStatus: Array.isArray(payload.byStatus)
      ? payload.byStatus
      : [],

    byCampaign: Array.isArray(payload.byCampaign)
      ? payload.byCampaign
      : [],

    period:
      payload.period &&
      typeof payload.period === "object"
        ? payload.period
        : {},
  };
}

function normalizeHistoryResponse(
  response,
  fallbackLimit
) {
  const payload = response?.data ?? response ?? {};

  const contactLogs = Array.isArray(
    payload.contactLogs
  )
    ? payload.contactLogs
    : Array.isArray(payload.logs)
      ? payload.logs
      : [];

  const suppliedPagination =
    payload.pagination ?? {};

  return {
    contactLogs,

    pagination: {
      page:
        Number(suppliedPagination.page) || 1,

      limit:
        Number(suppliedPagination.limit) ||
        fallbackLimit,

      total:
        Number(suppliedPagination.total) ||
        contactLogs.length,

      pages: Math.max(
        1,
        Number(suppliedPagination.pages) || 1
      ),
    },
  };
}

function normalizeUpdatedContactLog(response) {
  const payload = response?.data ?? response ?? {};

  return payload.contactLog ?? payload;
}

function getRequestErrorMessage(
  error,
  fallbackMessage
) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallbackMessage
  );
}

export default function CustomerContactAnalyticsPanel({
  defaultDays = 30,
  recordsPerPage = 10,
}) {
  const [summaryData, setSummaryData] = useState({
    summary: {},
    byChannel: [],
    byStatus: [],
    byCampaign: [],
    period: {},
  });

  const [contactLogs, setContactLogs] =
    useState([]);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: recordsPerPage,
    total: 0,
    pages: 1,
  });

  const [days, setDays] =
    useState(defaultDays);

  const [campaignType, setCampaignType] =
    useState("");

  const [channel, setChannel] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [summaryError, setSummaryError] =
    useState("");

  const [historyError, setHistoryError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [
    updatingContactLogId,
    setUpdatingContactLogId,
  ] = useState("");

  const [
    deletingContactLogId,
    setDeletingContactLogId,
  ] = useState("");

  const queryDates = useMemo(
    () => ({
      startDate: getStartDate(days),
      endDate: getEndDate(),
    }),
    [days]
  );

  const summary =
    summaryData.summary ?? {};

  const byChannel =
    summaryData.byChannel ?? [];

  const byStatus =
    summaryData.byStatus ?? [];

  const byCampaign =
    summaryData.byCampaign ?? [];

  const loadContactAnalytics = useCallback(
    async ({
      page = 1,
      showInitialLoader = false,
    } = {}) => {
      try {
        if (showInitialLoader) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setSummaryError("");
        setHistoryError("");

        const summaryRequest =
          getCustomerContactCampaignSummary({
            days,
            campaignType:
              campaignType || undefined,
            channel: channel || undefined,
          });

        const historyRequest =
          getCustomerContactLogs({
            page,
            limit: recordsPerPage,
            campaignType:
              campaignType || undefined,
            channel: channel || undefined,
            status: status || undefined,
            startDate: queryDates.startDate,
            endDate: queryDates.endDate,
          });

        const [
          summaryResult,
          historyResult,
        ] = await Promise.allSettled([
          summaryRequest,
          historyRequest,
        ]);

        if (
          summaryResult.status === "fulfilled"
        ) {
          setSummaryData(
            normalizeSummaryResponse(
              summaryResult.value
            )
          );
        } else {
          setSummaryError(
            getRequestErrorMessage(
              summaryResult.reason,
              "Unable to load communication statistics."
            )
          );
        }

        if (
          historyResult.status === "fulfilled"
        ) {
          const normalizedHistory =
            normalizeHistoryResponse(
              historyResult.value,
              recordsPerPage
            );

          setContactLogs(
            normalizedHistory.contactLogs
          );

          setPagination(
            normalizedHistory.pagination
          );
        } else {
          setHistoryError(
            getRequestErrorMessage(
              historyResult.reason,
              "Unable to load customer contact history."
            )
          );
        }
      } catch (requestError) {
        const message = getRequestErrorMessage(
          requestError,
          "Unable to load communication analytics."
        );

        setSummaryError(message);
        setHistoryError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      days,
      campaignType,
      channel,
      status,
      recordsPerPage,
      queryDates.startDate,
      queryDates.endDate,
    ]
  );

  useEffect(() => {
    loadContactAnalytics({
      page: 1,
      showInitialLoader: true,
    });
  }, [loadContactAnalytics]);

  function handleDaysChange(event) {
    setDays(Number(event.target.value));
    setSuccessMessage("");
  }

  function handleCampaignChange(event) {
    setCampaignType(event.target.value);
    setSuccessMessage("");
  }

  function handleChannelChange(event) {
    setChannel(event.target.value);
    setSuccessMessage("");
  }

  function handleStatusFilterChange(event) {
    setStatus(event.target.value);
    setSuccessMessage("");
  }

  function clearFilters() {
    setDays(defaultDays);
    setCampaignType("");
    setChannel("");
    setStatus("");
    setSuccessMessage("");
  }

  function handleRefresh() {
    setSuccessMessage("");

    loadContactAnalytics({
      page: pagination.page,
      showInitialLoader: false,
    });
  }

  function handlePageChange(page) {
    const safePage = Math.min(
      Math.max(1, Number(page) || 1),
      Math.max(1, pagination.pages)
    );

    loadContactAnalytics({
      page: safePage,
      showInitialLoader: false,
    });
  }

  async function refreshSummary() {
    const response =
      await getCustomerContactCampaignSummary({
        days,
        campaignType:
          campaignType || undefined,
        channel: channel || undefined,
      });

    setSummaryData(
      normalizeSummaryResponse(response)
    );
  }

  async function handleStatusChange(
    contactLog,
    newStatus
  ) {
    const contactLogId =
      getContactLogId(contactLog);

    if (!contactLogId) {
      setHistoryError(
        "The selected contact record does not have a valid ID."
      );

      return;
    }

    if (newStatus === contactLog.status) {
      return;
    }

    try {
      setUpdatingContactLogId(contactLogId);
      setHistoryError("");
      setSummaryError("");
      setSuccessMessage("");

      const response =
        await updateCustomerContactStatus(
          contactLogId,
          {
            status: newStatus,
          }
        );

      const updatedContactLog =
        normalizeUpdatedContactLog(response);

      setContactLogs(
        (currentContactLogs) =>
          currentContactLogs.map((item) =>
            String(getContactLogId(item)) ===
            String(contactLogId)
              ? updatedContactLog
              : item
          )
      );

      setSuccessMessage(
        `Contact status for ${getCustomerName(
          contactLog
        )} was updated to ${newStatus.replaceAll(
          "_",
          " "
        )}.`
      );

      try {
        await refreshSummary();
      } catch (summaryRequestError) {
        setSummaryError(
          getRequestErrorMessage(
            summaryRequestError,
            "The contact status was updated, but the analytics could not be refreshed."
          )
        );
      }
    } catch (requestError) {
      setHistoryError(
        getRequestErrorMessage(
          requestError,
          "Unable to update the contact status."
        )
      );
    } finally {
      setUpdatingContactLogId("");
    }
  }

  async function handleDelete(contactLog) {
    const contactLogId =
      getContactLogId(contactLog);

    if (!contactLogId) {
      setHistoryError(
        "The selected contact record does not have a valid ID."
      );

      return;
    }

    const customerName =
      getCustomerName(contactLog);

    const confirmed = window.confirm(
      `Delete the contact record for ${customerName}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingContactLogId(contactLogId);
      setHistoryError("");
      setSummaryError("");
      setSuccessMessage("");

      await deleteCustomerContactLog(
        contactLogId
      );

      const remainingRecords =
        contactLogs.length - 1;

      const targetPage =
        remainingRecords <= 0 &&
        pagination.page > 1
          ? pagination.page - 1
          : pagination.page;

      setSuccessMessage(
        `The contact record for ${customerName} was deleted.`
      );

      await loadContactAnalytics({
        page: targetPage,
        showInitialLoader: false,
      });
    } catch (requestError) {
      setHistoryError(
        getRequestErrorMessage(
          requestError,
          "Unable to delete the contact record."
        )
      );
    } finally {
      setDeletingContactLogId("");
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100">
            <MessagesSquare
              className="text-indigo-700"
              size={23}
            />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Communication Analytics
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Monitor customer outreach, campaign
              performance and communication outcomes.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw
            size={17}
            className={
              loading || refreshing
                ? "animate-spin"
                : ""
            }
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </header>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Filter
            className="text-gray-500"
            size={18}
          />

          <h3 className="font-semibold text-gray-900">
            Communication filters
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <label
              htmlFor="contact-period-filter"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Period
            </label>

            <select
              id="contact-period-filter"
              value={days}
              onChange={handleDaysChange}
              disabled={loading || refreshing}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
            >
              {PERIOD_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="contact-campaign-filter"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Campaign
            </label>

            <select
              id="contact-campaign-filter"
              value={campaignType}
              onChange={handleCampaignChange}
              disabled={loading || refreshing}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
            >
              {CAMPAIGN_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="contact-channel-filter"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Channel
            </label>

            <select
              id="contact-channel-filter"
              value={channel}
              onChange={handleChannelChange}
              disabled={loading || refreshing}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
            >
              {CHANNEL_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="contact-status-filter"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Status
            </label>

            <select
              id="contact-status-filter"
              value={status}
              onChange={handleStatusFilterChange}
              disabled={loading || refreshing}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
            >
              {STATUS_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              disabled={loading || refreshing}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {summaryError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
        >
          <AlertTriangle
            className="mt-0.5 shrink-0 text-red-600"
            size={20}
          />

          <div>
            <p className="font-semibold text-red-800">
              Communication analytics unavailable
            </p>

            <p className="mt-1 text-sm text-red-700">
              {summaryError}
            </p>
          </div>
        </div>
      ) : null}

      {successMessage ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4"
        >
          <CheckCircle
            className="mt-0.5 shrink-0 text-green-600"
            size={20}
          />

          <p className="text-sm text-green-700">
            {successMessage}
          </p>
        </div>
      ) : null}

      <CustomerContactStats
        summary={summary}
        loading={loading}
      />

      <CommunicationPerformanceInsights
        summary={summary}
        byChannel={byChannel}
        byStatus={byStatus}
        byCampaign={byCampaign}
        loading={loading}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <CommunicationChannelChart
          data={byChannel}
          loading={loading}
        />

        <CommunicationStatusChart
          data={byStatus}
          loading={loading}
        />
      </div>

      <CommunicationCampaignChart
        data={byCampaign}
        loading={loading}
      />

      <CustomerContactHistoryTable
        contactLogs={contactLogs}
        loading={loading}
        error={historyError}
        pagination={pagination}
        updatingContactLogId={
          updatingContactLogId
        }
        deletingContactLogId={
          deletingContactLogId
        }
        onPageChange={handlePageChange}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
      />
    </section>
  );
}