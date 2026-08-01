import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleStop,
  Clock3,
  Eye,
  LoaderCircle,
  MailCheck,
  MessageCircle,
  Play,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  Smartphone,
  X,
  XCircle,
} from "lucide-react";

import * as messageDeliveryService from "../services/messageDeliveryService.js";

import * as scheduledCommunicationService from "../services/scheduledCommunicationService.js";

const STATUS_OPTIONS = [
  {
    value: "all",
    label: "All statuses",
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

const CHANNEL_OPTIONS = [
  {
    value: "all",
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

const STATUS_CLASSES = {
  queued:
    "border-amber-200 bg-amber-50 text-amber-700",

  processing:
    "border-blue-200 bg-blue-50 text-blue-700",

  sent:
    "border-indigo-200 bg-indigo-50 text-indigo-700",

  delivered:
    "border-emerald-200 bg-emerald-50 text-emerald-700",

  opened:
    "border-violet-200 bg-violet-50 text-violet-700",

  responded:
    "border-green-200 bg-green-50 text-green-700",

  failed:
    "border-red-200 bg-red-50 text-red-700",

  cancelled:
    "border-slate-200 bg-slate-50 text-slate-600",
};

const DELIVERY_FUNCTIONS = {
  list: [
    "getMessageDeliveryRecords",
    "listMessageDeliveryRecords",
    "getDeliveryRecords",
    "getScheduledCommunications",
    "listScheduledCommunications",
    "getScheduledCommunicationJobs",
    "listScheduledJobs",
  ],

  summary: [
    "getMessageDeliverySummary",
    "getDeliverySummary",
    "getScheduledCommunicationSummary",
    "getCommunicationDeliverySummary",
  ],

  schedulerStatus: [
    "getMessageDeliverySchedulerStatus",
    "getSchedulerStatus",
    "fetchMessageDeliverySchedulerStatus",
    "getDeliverySchedulerStatus",
  ],

  runCycle: [
    "runMessageDeliverySchedulerCycle",
    "runSchedulerCycle",
    "processMessageDeliveryQueue",
    "processDueMessages",
    "processScheduledCommunications",
  ],

  startScheduler: [
    "startMessageDeliveryScheduler",
    "startScheduler",
    "startDeliveryScheduler",
  ],

  stopScheduler: [
    "stopMessageDeliveryScheduler",
    "stopScheduler",
    "stopDeliveryScheduler",
  ],

  restartScheduler: [
    "restartMessageDeliveryScheduler",
    "restartScheduler",
    "restartDeliveryScheduler",
  ],

  retry: [
    "retryMessageDelivery",
    "retryDeliveryRecord",
    "retryScheduledCommunication",
    "retryCommunication",
    "retryMessage",
  ],

  cancel: [
    "cancelMessageDelivery",
    "cancelDeliveryRecord",
    "cancelScheduledCommunication",
    "cancelScheduledJob",
    "cancelCommunication",
  ],
};

const SERVICE_SOURCES = [
  messageDeliveryService,
  scheduledCommunicationService,
].filter(Boolean);

function findServiceFunction(
  candidateNames
) {
  for (
    const source of
    SERVICE_SOURCES
  ) {
    for (
      const functionName of
      candidateNames
    ) {
      if (
        typeof source?.[
          functionName
        ] === "function"
      ) {
        return source[
          functionName
        ].bind(source);
      }
    }
  }

  return null;
}

function hasServiceFunction(
  candidateNames
) {
  return Boolean(
    findServiceFunction(
      candidateNames
    )
  );
}

async function callServiceFunction(
  candidateNames,
  args = [],
  {
    optional = false,
  } = {}
) {
  const serviceFunction =
    findServiceFunction(
      candidateNames
    );

  if (!serviceFunction) {
    if (optional) {
      return null;
    }

    throw new Error(
      `No compatible service function was found. Expected one of: ${candidateNames.join(
        ", "
      )}.`
    );
  }

  return serviceFunction(
    ...args
  );
}

function unwrapPayload(value) {
  return (
    value?.data?.data ??
    value?.data ??
    value ??
    null
  );
}

function extractRecords(value) {
  const payload =
    unwrapPayload(value);

  if (
    Array.isArray(payload)
  ) {
    return payload;
  }

  const possibleArrays = [
    payload?.items,
    payload?.records,
    payload?.deliveries,
    payload?.messages,
    payload?.communications,
    payload?.scheduledCommunications,
    payload?.jobs,
    payload?.results,
  ];

  return (
    possibleArrays.find(
      Array.isArray
    ) || []
  );
}

function extractScheduler(value) {
  const payload =
    unwrapPayload(value);

  return (
    payload?.scheduler ||
    payload?.status ||
    payload ||
    {}
  );
}

function extractSummary(value) {
  const payload =
    unwrapPayload(value);

  return (
    payload?.summary ||
    payload?.statistics ||
    payload?.totals ||
    {}
  );
}

function normaliseStatus(value) {
  return String(
    value || "queued"
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function formatLabel(value) {
  return String(value || "â€”")
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function formatNumber(value) {
  return new Intl.NumberFormat(
    "en-GB"
  ).format(
    Number(value) || 0
  );
}

function formatDateTime(value) {
  if (!value) {
    return "â€”";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "â€”";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function formatDuration(value) {
  const milliseconds =
    Number(value);

  if (
    !Number.isFinite(
      milliseconds
    ) ||
    milliseconds < 0
  ) {
    return "â€”";
  }

  if (
    milliseconds < 1000
  ) {
    return `${milliseconds} ms`;
  }

  return `${(
    milliseconds / 1000
  ).toFixed(1)} seconds`;
}

function getRecordId(record) {
  return String(
    record?._id ||
      record?.id ||
      record?.deliveryId ||
      record?.messageId ||
      ""
  );
}

function getCustomerName(record) {
  const customer =
    record?.customer;

  if (
    customer &&
    typeof customer ===
      "object"
  ) {
    return (
      customer.preferredName ||
      customer.fullName ||
      customer.name ||
      [
        customer.firstName,
        customer.lastName,
      ]
        .filter(Boolean)
        .join(" ") ||
      "Unknown customer"
    );
  }

  return (
    record?.customerName ||
    record?.recipientName ||
    "Unknown customer"
  );
}

function getRecipient(record) {
  return (
    record?.recipient ||
    record?.to ||
    record?.email ||
    record?.phone ||
    record?.customer?.email ||
    record?.customer?.phone ||
    record?.customer
      ?.phoneNumber ||
    "No recipient"
  );
}

function getMessage(record) {
  return (
    record?.message ||
    record?.body ||
    record?.content ||
    ""
  );
}

function getErrorMessage(
  error,
  fallback =
    "The message-delivery request failed."
) {
  if (
    typeof error === "string"
  ) {
    return error;
  }

  return (
    error?.response?.data
      ?.message ||
    error?.response?.data
      ?.error ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function StatusBadge({
  status,
}) {
  const normalised =
    normaliseStatus(status);

  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-bold",
        STATUS_CLASSES[
          normalised
        ] ||
          STATUS_CLASSES.queued,
      ].join(" ")}
    >
      {formatLabel(
        normalised
      )}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">
            {title}
          </p>

          {loading ? (
            <div className="mt-3 h-9 w-20 animate-pulse rounded bg-slate-100" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {value}
            </p>
          )}

          <p className="mt-2 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={21} />
        </span>
      </div>
    </article>
  );
}

export default function MessageDeliveryPage() {
  const [
    records,
    setRecords,
  ] = useState([]);

  const [
    serverSummary,
    setServerSummary,
  ] = useState({});

  const [
    scheduler,
    setScheduler,
  ] = useState({});

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    channelFilter,
    setChannelFilter,
  ] = useState("all");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    busyAction,
    setBusyAction,
  ] = useState("");

  const [
    busyRecordId,
    setBusyRecordId,
  ] = useState("");

  const [
    selectedRecord,
    setSelectedRecord,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const loadData =
    useCallback(
      async ({
        initialLoad = false,
      } = {}) => {
        if (initialLoad) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        try {
          const [
            recordsOutcome,
            summaryOutcome,
            schedulerOutcome,
          ] =
            await Promise.allSettled(
              [
                callServiceFunction(
                  DELIVERY_FUNCTIONS.list,
                  [
                    {
                      limit: 500,
                    },
                  ],
                  {
                    optional: true,
                  }
                ),

                callServiceFunction(
                  DELIVERY_FUNCTIONS.summary,
                  [],
                  {
                    optional: true,
                  }
                ),

                callServiceFunction(
                  DELIVERY_FUNCTIONS.schedulerStatus,
                  [],
                  {
                    optional: true,
                  }
                ),
              ]
            );

          let availableResponse =
            false;

          if (
            recordsOutcome.status ===
              "fulfilled" &&
            recordsOutcome.value !==
              null
          ) {
            setRecords(
              extractRecords(
                recordsOutcome.value
              )
            );

            availableResponse =
              true;
          } else if (
            recordsOutcome.status ===
            "rejected"
          ) {
            throw recordsOutcome.reason;
          }

          if (
            summaryOutcome.status ===
              "fulfilled" &&
            summaryOutcome.value !==
              null
          ) {
            setServerSummary(
              extractSummary(
                summaryOutcome.value
              )
            );

            availableResponse =
              true;
          }

          if (
            schedulerOutcome.status ===
              "fulfilled" &&
            schedulerOutcome.value !==
              null
          ) {
            setScheduler(
              extractScheduler(
                schedulerOutcome.value
              )
            );

            availableResponse =
              true;
          }

          if (
            !availableResponse
          ) {
            throw new Error(
              "The message-delivery service does not expose compatible list, summary or scheduler functions."
            );
          }
        } catch (
          requestError
        ) {
          setError(
            getErrorMessage(
              requestError,
              "Unable to load message-delivery information."
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
    loadData({
      initialLoad: true,
    });
  }, [loadData]);

  const filteredRecords =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return records.filter(
        (record) => {
          const status =
            normaliseStatus(
              record.status
            );

          const channel =
            String(
              record.channel ||
                ""
            )
              .trim()
              .toLowerCase();

          const matchesStatus =
            statusFilter ===
              "all" ||
            status ===
              statusFilter;

          const matchesChannel =
            channelFilter ===
              "all" ||
            channel ===
              channelFilter;

          const matchesSearch =
            !query ||
            [
              getCustomerName(
                record
              ),
              getRecipient(record),
              record.subject,
              getMessage(record),
              record.provider,
              record.providerMessageId,
              record.campaign?.name,
              record.communicationType,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(query)
            );

          return (
            matchesStatus &&
            matchesChannel &&
            matchesSearch
          );
        }
      );
    }, [
      records,
      search,
      statusFilter,
      channelFilter,
    ]);

  const calculatedSummary =
    useMemo(() => {
      const values =
        records.reduce(
          (
            summary,
            record
          ) => {
            const status =
              normaliseStatus(
                record.status
              );

            summary.total += 1;

            if (
              Object.hasOwn(
                summary,
                status
              )
            ) {
              summary[
                status
              ] += 1;
            }

            return summary;
          },
          {
            total: 0,
            queued: 0,
            processing: 0,
            sent: 0,
            delivered: 0,
            opened: 0,
            responded: 0,
            failed: 0,
            cancelled: 0,
          }
        );

      return {
        ...values,
        ...serverSummary,
      };
    }, [
      records,
      serverSummary,
    ]);

  const schedulerRunning =
    Boolean(
      scheduler.started ||
        scheduler.running ||
        scheduler.enabled
    );

  const runningCycle =
    Boolean(
      scheduler.runningCycle ||
        scheduler.processing
    );

  async function runAction({
    action,
    functionNames,
    args = [],
    success,
  }) {
    try {
      setBusyAction(
        action
      );

      setError("");
      setSuccessMessage("");

      const response =
        await callServiceFunction(
          functionNames,
          args
        );

      const payload =
        unwrapPayload(
          response
        );

      setSuccessMessage(
        payload?.message ||
          success
      );

      await loadData();
    } catch (
      requestError
    ) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setBusyAction("");
    }
  }

  async function handleRunCycle() {
    await runAction({
      action: "cycle",

      functionNames:
        DELIVERY_FUNCTIONS.runCycle,

      args: [
        {
          force: true,
          source: "manual",
        },
      ],

      success:
        "The message-delivery cycle completed.",
    });
  }

  async function handleStartScheduler() {
    await runAction({
      action: "start",

      functionNames:
        DELIVERY_FUNCTIONS.startScheduler,

      args: [
        {
          force: true,
          runImmediately: true,
        },
      ],

      success:
        "The message-delivery scheduler started.",
    });
  }

  async function handleStopScheduler() {
    const confirmed =
      window.confirm(
        "Stop the message-delivery scheduler?"
      );

    if (!confirmed) {
      return;
    }

    await runAction({
      action: "stop",

      functionNames:
        DELIVERY_FUNCTIONS.stopScheduler,

      args: [
        {
          waitForCycle: true,
        },
      ],

      success:
        "The message-delivery scheduler stopped.",
    });
  }

  async function handleRestartScheduler() {
    await runAction({
      action: "restart",

      functionNames:
        DELIVERY_FUNCTIONS.restartScheduler,

      args: [
        {
          force: true,
          runImmediately: true,
          waitForCycle: true,
        },
      ],

      success:
        "The message-delivery scheduler restarted.",
    });
  }

  async function handleRetry(
    record
  ) {
    const recordId =
      getRecordId(record);

    if (!recordId) {
      setError(
        "The selected delivery record does not have a valid ID."
      );

      return;
    }

    try {
      setBusyRecordId(
        recordId
      );

      setError("");
      setSuccessMessage("");

      await callServiceFunction(
        DELIVERY_FUNCTIONS.retry,
        [recordId]
      );

      setSuccessMessage(
        "The failed delivery was queued for another attempt."
      );

      await loadData();
    } catch (
      requestError
    ) {
      setError(
        getErrorMessage(
          requestError,
          "Unable to retry the message."
        )
      );
    } finally {
      setBusyRecordId("");
    }
  }

  async function handleCancel(
    record
  ) {
    const recordId =
      getRecordId(record);

    if (!recordId) {
      setError(
        "The selected delivery record does not have a valid ID."
      );

      return;
    }

    const confirmed =
      window.confirm(
        "Cancel this queued communication?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setBusyRecordId(
        recordId
      );

      setError("");
      setSuccessMessage("");

      await callServiceFunction(
        DELIVERY_FUNCTIONS.cancel,
        [recordId]
      );

      setSuccessMessage(
        "The queued communication was cancelled."
      );

      await loadData();
    } catch (
      requestError
    ) {
      setError(
        getErrorMessage(
          requestError,
          "Unable to cancel the communication."
        )
      );
    } finally {
      setBusyRecordId("");
    }
  }

  return (
    <main className="space-y-7 p-6">
      <header className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-blue-50 p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <Send size={27} />
            </span>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Message Delivery
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Monitor queued, processing,
                delivered and failed customer
                communications. Run delivery cycles
                and manage the automatic scheduler.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                loadData()
              }
              disabled={
                refreshing ||
                Boolean(
                  busyAction
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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

            {hasServiceFunction(
              DELIVERY_FUNCTIONS.runCycle
            ) && (
              <button
                type="button"
                onClick={
                  handleRunCycle
                }
                disabled={
                  Boolean(
                    busyAction
                  ) ||
                  runningCycle
                }
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {busyAction ===
                "cycle" ? (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Play
                    size={16}
                  />
                )}

                Run delivery cycle
              </button>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={19}
              className="mt-0.5 shrink-0 text-red-600"
            />

            <p className="text-sm text-red-700">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            className="text-red-400 hover:text-red-700"
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2
              size={19}
              className="mt-0.5 shrink-0 text-emerald-600"
            />

            <p className="text-sm text-emerald-700">
              {successMessage}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setSuccessMessage(
                ""
              )
            }
            className="text-emerald-400 hover:text-emerald-700"
            aria-label="Dismiss success message"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Total messages"
          value={formatNumber(
            calculatedSummary.total
          )}
          description="All delivery records"
          icon={Send}
          loading={loading}
        />

        <SummaryCard
          title="Queued"
          value={formatNumber(
            calculatedSummary.queued
          )}
          description="Waiting for processing"
          icon={Clock3}
          loading={loading}
        />

        <SummaryCard
          title="Processing"
          value={formatNumber(
            calculatedSummary.processing
          )}
          description="Currently being sent"
          icon={Activity}
          loading={loading}
        />

        <SummaryCard
          title="Delivered"
          value={formatNumber(
            calculatedSummary.delivered
          )}
          description="Confirmed deliveries"
          icon={MailCheck}
          loading={loading}
        />

        <SummaryCard
          title="Failed"
          value={formatNumber(
            calculatedSummary.failed
          )}
          description="Require review or retry"
          icon={XCircle}
          loading={loading}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span
                className={[
                  "h-3 w-3 rounded-full",
                  schedulerRunning
                    ? "bg-emerald-500"
                    : "bg-slate-300",
                ].join(" ")}
              />

              <h2 className="text-lg font-bold text-slate-900">
                Delivery scheduler
              </h2>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              {schedulerRunning
                ? runningCycle
                  ? "The scheduler is running and a delivery cycle is active."
                  : "The automatic delivery scheduler is running."
                : "The automatic delivery scheduler is stopped or disabled."}
            </p>

            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
              <span>
                Interval:{" "}
                <strong className="text-slate-700">
                  {scheduler.intervalMs
                    ? `${formatNumber(
                        scheduler.intervalMs
                      )} ms`
                    : "â€”"}
                </strong>
              </span>

              <span>
                Last successful cycle:{" "}
                <strong className="text-slate-700">
                  {formatDateTime(
                    scheduler.lastSuccessfulCycleAt
                  )}
                </strong>
              </span>

              <span>
                Total cycles:{" "}
                <strong className="text-slate-700">
                  {formatNumber(
                    scheduler.counters
                      ?.total ||
                      scheduler.totalCycles
                  )}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!schedulerRunning &&
              hasServiceFunction(
                DELIVERY_FUNCTIONS.startScheduler
              ) && (
                <button
                  type="button"
                  onClick={
                    handleStartScheduler
                  }
                  disabled={
                    Boolean(
                      busyAction
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Play size={16} />
                  Start
                </button>
              )}

            {schedulerRunning &&
              hasServiceFunction(
                DELIVERY_FUNCTIONS.stopScheduler
              ) && (
                <button
                  type="button"
                  onClick={
                    handleStopScheduler
                  }
                  disabled={
                    Boolean(
                      busyAction
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <CircleStop
                    size={16}
                  />
                  Stop
                </button>
              )}

            {hasServiceFunction(
              DELIVERY_FUNCTIONS.restartScheduler
            ) && (
              <button
                type="button"
                onClick={
                  handleRestartScheduler
                }
                disabled={
                  Boolean(
                    busyAction
                  )
                }
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RotateCcw
                  size={16}
                />
                Restart
              </button>
            )}
          </div>
        </div>

        {scheduler.lastError && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">
              Last scheduler error
            </p>

            <p className="mt-1 text-sm text-red-700">
              {scheduler.lastError
                .message ||
                String(
                  scheduler.lastError
                )}
            </p>
          </div>
        )}

        {scheduler.lastCycle && (
          <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Last cycle
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-800">
                {scheduler.lastCycle
                  .success
                  ? "Successful"
                  : scheduler.lastCycle
                      .skipped
                    ? "Skipped"
                    : "Failed"}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Completed
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-800">
                {formatDateTime(
                  scheduler.lastCycle
                    .completedAt
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Duration
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-800">
                {formatDuration(
                  scheduler.lastCycle
                    .durationMs
                )}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative xl:col-span-2">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-3 text-slate-400"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search customer, recipient, campaign or message"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <select
              value={
                statusFilter
              }
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              {STATUS_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>

            <select
              value={
                channelFilter
              }
              onChange={(event) =>
                setChannelFilter(
                  event.target.value
                )
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              {CHANNEL_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-80 items-center justify-center">
            <LoaderCircle
              size={34}
              className="animate-spin text-indigo-600"
            />
          </div>
        ) : filteredRecords.length ===
          0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
            <MessageCircle
              size={46}
              className="text-slate-300"
            />

            <h2 className="mt-4 text-lg font-semibold text-slate-800">
              No delivery records found
            </h2>

            <p className="mt-2 max-w-md text-sm text-slate-500">
              There are no messages matching
              the current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Customer",
                    "Channel",
                    "Status",
                    "Message",
                    "Delivery",
                    "Actions",
                  ].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500"
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map(
                  (record) => {
                    const recordId =
                      getRecordId(
                        record
                      );

                    const status =
                      normaliseStatus(
                        record.status
                      );

                    const busy =
                      busyRecordId ===
                      recordId;

                    return (
                      <tr
                        key={
                          recordId
                        }
                        className="align-top hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {getCustomerName(
                              record
                            )}
                          </p>

                          <p className="mt-1 max-w-56 break-all text-xs text-slate-500">
                            {getRecipient(
                              record
                            )}
                          </p>

                          {record.campaign
                            ?.name && (
                            <p className="mt-1 text-xs text-indigo-600">
                              {
                                record
                                  .campaign
                                  .name
                              }
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            {record.channel ===
                            "email" ? (
                              <MailCheck
                                size={16}
                              />
                            ) : (
                              <Smartphone
                                size={16}
                              />
                            )}

                            {formatLabel(
                              record.channel
                            )}
                          </div>

                          <p className="mt-2 text-xs text-slate-400">
                            {formatLabel(
                              record.communicationType ||
                                record.campaignType ||
                                "general"
                            )}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            status={
                              status
                            }
                          />

                          <p className="mt-2 text-xs text-slate-500">
                            Attempts:{" "}
                            {Number(
                              record.attempts ||
                                record.attemptCount ||
                                0
                            )}
                          </p>
                        </td>

                        <td className="max-w-sm px-5 py-4">
                          {record.subject && (
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {
                                record.subject
                              }
                            </p>
                          )}

                          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-slate-500">
                            {getMessage(
                              record
                            ) ||
                              "No message content"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-500">
                          <p>
                            Scheduled:{" "}
                            {formatDateTime(
                              record.scheduledFor ||
                                record.scheduledAt
                            )}
                          </p>

                          <p className="mt-1">
                            Sent:{" "}
                            {formatDateTime(
                              record.sentAt
                            )}
                          </p>

                          {record.provider && (
                            <p className="mt-1">
                              Provider:{" "}
                              {formatLabel(
                                record.provider
                              )}
                            </p>
                          )}

                          {record.failureReason && (
                            <p className="mt-2 max-w-xs text-red-600">
                              {
                                record.failureReason
                              }
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex min-w-32 flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedRecord(
                                  record
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Eye
                                size={13}
                              />
                              Details
                            </button>

                            {status ===
                              "failed" &&
                              hasServiceFunction(
                                DELIVERY_FUNCTIONS.retry
                              ) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRetry(
                                      record
                                    )
                                  }
                                  disabled={
                                    busy
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                >
                                  <RotateCcw
                                    size={13}
                                    className={
                                      busy
                                        ? "animate-spin"
                                        : ""
                                    }
                                  />
                                  Retry
                                </button>
                              )}

                            {[
                              "queued",
                              "processing",
                            ].includes(
                              status
                            ) &&
                              hasServiceFunction(
                                DELIVERY_FUNCTIONS.cancel
                              ) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCancel(
                                      record
                                    )
                                  }
                                  disabled={
                                    busy
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                  <XCircle
                                    size={13}
                                  />
                                  Cancel
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-200 px-5 py-4">
          <p className="text-sm text-slate-500">
            Showing{" "}
            {formatNumber(
              filteredRecords.length
            )}{" "}
            of{" "}
            {formatNumber(
              records.length
            )}{" "}
            delivery records
          </p>
        </div>
      </section>

      {selectedRecord && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <header className="sticky top-0 flex items-start justify-between border-b border-slate-200 bg-white p-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Delivery details
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {getCustomerName(
                    selectedRecord
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedRecord(
                    null
                  )
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close delivery details"
              >
                <X size={19} />
              </button>
            </header>

            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Status
                  </p>

                  <div className="mt-2">
                    <StatusBadge
                      status={
                        selectedRecord.status
                      }
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Channel
                  </p>

                  <p className="mt-2 font-semibold text-slate-900">
                    {formatLabel(
                      selectedRecord.channel
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Recipient
                  </p>

                  <p className="mt-2 break-all text-sm font-semibold text-slate-900">
                    {getRecipient(
                      selectedRecord
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Provider
                  </p>

                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {formatLabel(
                      selectedRecord.provider
                    )}
                  </p>
                </div>
              </div>

              {selectedRecord.subject && (
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Subject
                  </p>

                  <p className="mt-2 font-semibold text-slate-900">
                    {
                      selectedRecord.subject
                    }
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Message
                </p>

                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                  {getMessage(
                    selectedRecord
                  ) ||
                    "No message content"}
                </p>
              </div>

              <dl className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">
                    Scheduled
                  </dt>

                  <dd className="mt-1 font-semibold text-slate-900">
                    {formatDateTime(
                      selectedRecord.scheduledFor ||
                        selectedRecord.scheduledAt
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">
                    Last attempt
                  </dt>

                  <dd className="mt-1 font-semibold text-slate-900">
                    {formatDateTime(
                      selectedRecord.lastAttemptAt
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">
                    Sent
                  </dt>

                  <dd className="mt-1 font-semibold text-slate-900">
                    {formatDateTime(
                      selectedRecord.sentAt
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">
                    Delivered
                  </dt>

                  <dd className="mt-1 font-semibold text-slate-900">
                    {formatDateTime(
                      selectedRecord.deliveredAt
                    )}
                  </dd>
                </div>
              </dl>

              {selectedRecord.failureReason && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="font-semibold text-red-800">
                    Failure reason
                  </p>

                  <p className="mt-2 text-sm text-red-700">
                    {
                      selectedRecord.failureReason
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
