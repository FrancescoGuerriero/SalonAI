import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";

import API from "../api/axios.js";

import {
  WAITLIST_CONTACT_CHANNELS,
  WAITLIST_STATUSES,
  WAITLIST_TIME_PREFERENCES,
  convertWaitlistEntry,
  createWaitlistEntry,
  deleteWaitlistEntry,
  expireWaitlistEntries,
  getWaitlistEntries,
  getWaitlistSummary,
  matchWaitlistEntries,
  updateWaitlistEntry,
} from "../Services/waitlistService.js";

const PAGE_SIZE = 15;

const STATUS_LABELS = {
  waiting: "Waiting",
  notified: "Notified",
  accepted: "Accepted",
  booked: "Booked",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

const STATUS_CLASSES = {
  waiting:
    "border-amber-200 bg-amber-50 text-amber-700",
  notified:
    "border-blue-200 bg-blue-50 text-blue-700",
  accepted:
    "border-emerald-200 bg-emerald-50 text-emerald-700",
  booked:
    "border-indigo-200 bg-indigo-50 text-indigo-700",
  declined:
    "border-rose-200 bg-rose-50 text-rose-700",
  expired:
    "border-slate-200 bg-slate-100 text-slate-600",
  cancelled:
    "border-slate-200 bg-slate-50 text-slate-500",
};

const TIME_LABELS = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  any: "Any time",
};

const CHANNEL_LABELS = {
  email: "Email",
  sms: "SMS",
  phone: "Phone",
  whatsapp: "WhatsApp",
};

const INITIAL_FILTERS = {
  search: "",
  status: "all",
  service: "",
  stylist: "",
  sort: "priority",
};

const INITIAL_CREATE_FORM = {
  customer: "",
  service: "",
  stylist: "",
  preferredDate: "",
  dateRangeStart: "",
  dateRangeEnd: "",
  timePreference: "any",
  earliestTime: "",
  latestTime: "",
  priority: "0",
  preferredContactChannel: "email",
  expiresAt: "",
  notes: "",
};

const INITIAL_CONVERT_FORM = {
  stylist: "",
  appointmentDate: "",
  appointmentTime: "",
  duration: "60",
  totalPrice: "",
  status: "pending",
  notes: "",
  reason: "Converted from waiting list.",
  force: false,
};

const INITIAL_MATCH_FORM = {
  service: "",
  stylist: "",
  appointmentDate: "",
  appointmentTime: "",
};

function normaliseArrayResponse(
  responseData
) {
  if (
    Array.isArray(responseData)
  ) {
    return responseData;
  }

  const candidates = [
    responseData?.items,
    responseData?.customers,
    responseData?.services,
    responseData?.stylists,
    responseData?.data,
    responseData?.data?.items,
    responseData?.data?.customers,
    responseData?.data?.services,
    responseData?.data?.stylists,
  ];

  return (
    candidates.find(
      Array.isArray
    ) || []
  );
}

function getEntityId(entity) {
  return String(
    entity?._id ||
      entity?.id ||
      ""
  );
}

function getCustomerName(
  customer
) {
  if (!customer) {
    return "Unknown customer";
  }

  return (
    customer.preferredName ||
    customer.fullName ||
    customer.displayName ||
    customer.name ||
    [
      customer.firstName,
      customer.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Unnamed customer"
  );
}

function getServiceName(service) {
  if (!service) {
    return "Unknown service";
  }

  return (
    service.name ||
    service.title ||
    "Unnamed service"
  );
}

function getStylistName(stylist) {
  if (!stylist) {
    return "Any stylist";
  }

  return (
    stylist.name ||
    stylist.fullName ||
    [
      stylist.firstName,
      stylist.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Unnamed stylist"
  );
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
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

function getErrorMessage(error) {
  return (
    error?.details?.message ||
    error?.response?.data
      ?.message ||
    error?.message ||
    "The request could not be completed."
  );
}

function getPaginationValue(
  pagination,
  keys,
  fallback
) {
  for (const key of keys) {
    const value =
      Number(
        pagination?.[key]
      );

    if (
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return fallback;
}

function WaitlistStatusBadge({
  status,
}) {
  const safeStatus =
    status || "waiting";

  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
        STATUS_CLASSES[
          safeStatus
        ] ||
          STATUS_CLASSES.waiting,
      ].join(" ")}
    >
      {STATUS_LABELS[
        safeStatus
      ] || safeStatus}
    </span>
  );
}

function Modal({
  title,
  description,
  onClose,
  children,
  widthClass =
    "max-w-3xl",
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div
        className={[
          "max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl",
          widthClass,
        ].join(" ")}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {title}
            </h2>

            {description && (
              <p className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {value}
          </p>
        </div>

        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={22} />
        </span>
      </div>
    </div>
  );
}

export default function WaitlistPage() {
  const [
    entries,
    setEntries,
  ] = useState([]);

  const [
    summary,
    setSummary,
  ] = useState({
    total: 0,
    active: 0,
    overdueResponses: 0,
    expiringSoon: 0,
    byStatus: {},
  });

  const [
    filters,
    setFilters,
  ] = useState(
    INITIAL_FILTERS
  );

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    pagination,
    setPagination,
  ] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 0,
  });

  const [
    customers,
    setCustomers,
  ] = useState([]);

  const [
    services,
    setServices,
  ] = useState([]);

  const [
    stylists,
    setStylists,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    referenceLoading,
    setReferenceLoading,
  ] = useState(true);

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    createOpen,
    setCreateOpen,
  ] = useState(false);

  const [
    createForm,
    setCreateForm,
  ] = useState(
    INITIAL_CREATE_FORM
  );

  const [
    convertEntry,
    setConvertEntry,
  ] = useState(null);

  const [
    convertForm,
    setConvertForm,
  ] = useState(
    INITIAL_CONVERT_FORM
  );

  const [
    matchOpen,
    setMatchOpen,
  ] = useState(false);

  const [
    matchForm,
    setMatchForm,
  ] = useState(
    INITIAL_MATCH_FORM
  );

  const [
    matchResults,
    setMatchResults,
  ] = useState([]);

  const [
    matchLoading,
    setMatchLoading,
  ] = useState(false);

  const totalPages =
    Math.max(
      1,
      getPaginationValue(
        pagination,
        [
          "pages",
          "totalPages",
        ],
        1
      )
    );

  const customerOptions =
    useMemo(
      () =>
        [...customers].sort(
          (
            left,
            right
          ) =>
            getCustomerName(
              left
            ).localeCompare(
              getCustomerName(
                right
              )
            )
        ),
      [customers]
    );

  const serviceOptions =
    useMemo(
      () =>
        [...services]
          .filter(
            (
              service
            ) =>
              service.active !==
              false
          )
          .sort(
            (
              left,
              right
            ) =>
              getServiceName(
                left
              ).localeCompare(
                getServiceName(
                  right
                )
              )
          ),
      [services]
    );

  const stylistOptions =
    useMemo(
      () =>
        [...stylists]
          .filter(
            (
              stylist
            ) =>
              stylist.active !==
              false
          )
          .sort(
            (
              left,
              right
            ) =>
              getStylistName(
                left
              ).localeCompare(
                getStylistName(
                  right
                )
              )
          ),
      [stylists]
    );

  const loadReferenceData =
    useCallback(
      async () => {
        setReferenceLoading(
          true
        );

        const results =
          await Promise.allSettled([
            API.get(
              "/customer-profiles",
              {
                params: {
                  page: 1,
                  limit: 200,
                },
              }
            ),

            API.get(
              "/services"
            ),

            API.get(
              "/stylists"
            ),
          ]);

        const [
          customerResult,
          serviceResult,
          stylistResult,
        ] = results;

        if (
          customerResult.status ===
          "fulfilled"
        ) {
          setCustomers(
            normaliseArrayResponse(
              customerResult.value
                .data
            )
          );
        }

        if (
          serviceResult.status ===
          "fulfilled"
        ) {
          setServices(
            normaliseArrayResponse(
              serviceResult.value
                .data
            )
          );
        }

        if (
          stylistResult.status ===
          "fulfilled"
        ) {
          setStylists(
            normaliseArrayResponse(
              stylistResult.value
                .data
            )
          );
        }

        setReferenceLoading(
          false
        );
      },
      []
    );

  const loadWaitlist =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const [
            listResult,
            summaryResult,
          ] =
            await Promise.all([
              getWaitlistEntries({
                ...filters,
                page,
                limit:
                  PAGE_SIZE,
              }),

              getWaitlistSummary(),
            ]);

          setEntries(
            listResult.items ||
              []
          );

          setPagination(
            listResult.pagination ||
              {
                page,
                limit:
                  PAGE_SIZE,
                total:
                  listResult.items
                    ?.length ||
                  0,
                pages: 1,
              }
          );

          setSummary({
            total:
              Number(
                summaryResult.total
              ) || 0,

            active:
              Number(
                summaryResult.active
              ) || 0,

            overdueResponses:
              Number(
                summaryResult
                  .overdueResponses
              ) || 0,

            expiringSoon:
              Number(
                summaryResult
                  .expiringSoon
              ) || 0,

            byStatus:
              summaryResult.byStatus ||
              {},
          });
        } catch (requestError) {
          setError(
            getErrorMessage(
              requestError
            )
          );
        } finally {
          setLoading(false);
        }
      },
      [
        filters,
        page,
      ]
    );

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    loadWaitlist();
  }, [loadWaitlist]);

  function showSuccess(
    message
  ) {
    setSuccessMessage(
      message
    );

    window.setTimeout(
      () => {
        setSuccessMessage(
          ""
        );
      },
      4000
    );
  }

  function updateFilter(
    field,
    value
  ) {
    setFilters(
      (
        current
      ) => ({
        ...current,
        [field]:
          value,
      })
    );

    setPage(1);
  }

  async function handleCreate(
    event
  ) {
    event.preventDefault();

    setActionLoading(
      true
    );

    setError("");

    try {
      await createWaitlistEntry({
        ...createForm,

        preferredDates:
          createForm
            .preferredDate
            ? [
                createForm
                  .preferredDate,
              ]
            : [],
      });

      setCreateOpen(false);

      setCreateForm(
        INITIAL_CREATE_FORM
      );

      showSuccess(
        "Customer added to the waiting list."
      );

      await loadWaitlist();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setActionLoading(
        false
      );
    }
  }

  async function handleStatusChange(
    entry,
    status
  ) {
    const reason =
      status ===
      "notified"
        ? "Customer notified about an available appointment."
        : status ===
            "accepted"
          ? "Customer accepted the available appointment."
          : status ===
              "declined"
            ? "Customer declined the available appointment."
            : status ===
                "cancelled"
              ? "Waiting-list request cancelled."
              : "";

    setActionLoading(
      true
    );

    setError("");

    try {
      await updateWaitlistEntry(
        entry._id,
        {
          status,
          statusReason:
            reason,
        }
      );

      showSuccess(
        `Entry marked as ${
          STATUS_LABELS[
            status
          ]?.toLowerCase() ||
          status
        }.`
      );

      await loadWaitlist();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setActionLoading(
        false
      );
    }
  }

  function openConversion(
    entry
  ) {
    const serviceDuration =
      Number(
        entry.service
          ?.duration
      ) || 60;

    const servicePrice =
      entry.service?.price;

    setConvertEntry(
      entry
    );

    setConvertForm({
      ...INITIAL_CONVERT_FORM,

      stylist:
        getEntityId(
          entry.stylist
        ),

      duration:
        String(
          serviceDuration
        ),

      totalPrice:
        servicePrice ===
          undefined ||
        servicePrice ===
          null
          ? ""
          : String(
              servicePrice
            ),

      notes:
        entry.notes ||
        "",
    });
  }

  async function handleConvert(
    event
  ) {
    event.preventDefault();

    if (
      !convertEntry
    ) {
      return;
    }

    setActionLoading(
      true
    );

    setError("");

    try {
      await convertWaitlistEntry(
        convertEntry._id,
        convertForm
      );

      setConvertEntry(
        null
      );

      setConvertForm(
        INITIAL_CONVERT_FORM
      );

      showSuccess(
        "Waiting-list entry converted into an appointment."
      );

      await loadWaitlist();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setActionLoading(
        false
      );
    }
  }

  async function handleDelete(
    entry
  ) {
    const confirmed =
      window.confirm(
        `Delete the waiting-list entry for ${getCustomerName(
          entry.customer
        )}?`
      );

    if (!confirmed) {
      return;
    }

    setActionLoading(
      true
    );

    setError("");

    try {
      await deleteWaitlistEntry(
        entry._id
      );

      showSuccess(
        "Waiting-list entry deleted."
      );

      await loadWaitlist();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setActionLoading(
        false
      );
    }
  }

  async function handleExpire() {
    setActionLoading(
      true
    );

    setError("");

    try {
      const result =
        await expireWaitlistEntries();

      showSuccess(
        `${result.expired} expired waiting-list entr${
          result.expired ===
          1
            ? "y"
            : "ies"
        } updated.`
      );

      await loadWaitlist();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setActionLoading(
        false
      );
    }
  }

  async function handleMatch(
    event
  ) {
    event.preventDefault();

    setMatchLoading(
      true
    );

    setError("");

    try {
      const result =
        await matchWaitlistEntries(
          matchForm
        );

      setMatchResults(
        result.items ||
          []
      );
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );

      setMatchResults([]);
    } finally {
      setMatchLoading(
        false
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">
              Booking Operations
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Waiting List
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Track customer appointment requests,
              match cancellations to suitable
              customers and convert accepted requests
              into bookings.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                setMatchOpen(
                  true
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50"
            >
              <CalendarCheck
                size={17}
              />
              Match open slot
            </button>

            <button
              type="button"
              onClick={() =>
                setCreateOpen(
                  true
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus size={17} />
              Add to waiting list
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <AlertTriangle
              className="mt-0.5 shrink-0"
              size={18}
            />

            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <Check
              className="mt-0.5 shrink-0"
              size={18}
            />

            <span>
              {successMessage}
            </span>
          </div>
        )}

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total requests"
            value={
              summary.total
            }
            icon={
              UsersRound
            }
          />

          <SummaryCard
            label="Active requests"
            value={
              summary.active
            }
            icon={
              CalendarClock
            }
          />

          <SummaryCard
            label="Awaiting response"
            value={
              summary.overdueResponses
            }
            icon={Clock3}
          />

          <SummaryCard
            label="Expiring soon"
            value={
              summary.expiringSoon
            }
            icon={
              AlertTriangle
            }
          />
        </div>

        <div className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="relative xl:col-span-2">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-3 text-slate-400"
                />

                <input
                  type="search"
                  value={
                    filters.search
                  }
                  onChange={(
                    event
                  ) =>
                    updateFilter(
                      "search",
                      event.target
                        .value
                    )
                  }
                  placeholder="Search customer, service or notes"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <select
                value={
                  filters.status
                }
                onChange={(
                  event
                ) =>
                  updateFilter(
                    "status",
                    event.target
                      .value
                  )
                }
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              >
                <option value="all">
                  All statuses
                </option>

                {WAITLIST_STATUSES.map(
                  (
                    status
                  ) => (
                    <option
                      key={
                        status
                      }
                      value={
                        status
                      }
                    >
                      {
                        STATUS_LABELS[
                          status
                        ]
                      }
                    </option>
                  )
                )}
              </select>

              <select
                value={
                  filters.service
                }
                onChange={(
                  event
                ) =>
                  updateFilter(
                    "service",
                    event.target
                      .value
                  )
                }
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              >
                <option value="">
                  All services
                </option>

                {serviceOptions.map(
                  (
                    service
                  ) => (
                    <option
                      key={getEntityId(
                        service
                      )}
                      value={getEntityId(
                        service
                      )}
                    >
                      {getServiceName(
                        service
                      )}
                    </option>
                  )
                )}
              </select>

              <select
                value={
                  filters.stylist
                }
                onChange={(
                  event
                ) =>
                  updateFilter(
                    "stylist",
                    event.target
                      .value
                  )
                }
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              >
                <option value="">
                  All stylists
                </option>

                {stylistOptions.map(
                  (
                    stylist
                  ) => (
                    <option
                      key={getEntityId(
                        stylist
                      )}
                      value={getEntityId(
                        stylist
                      )}
                    >
                      {getStylistName(
                        stylist
                      )}
                    </option>
                  )
                )}
              </select>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={
                    loadWaitlist
                  }
                  disabled={
                    loading
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={
                      loading
                        ? "animate-spin"
                        : ""
                    }
                  />
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={
                    handleExpire
                  }
                  disabled={
                    actionLoading
                  }
                  title="Process expired entries"
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Clock3
                    size={17}
                  />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <LoaderCircle
                className="animate-spin text-indigo-600"
                size={32}
              />
            </div>
          ) : entries.length ===
            0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <UsersRound
                size={42}
                className="text-slate-300"
              />

              <h2 className="mt-4 text-lg font-semibold text-slate-800">
                No waiting-list
                entries found
              </h2>

              <p className="mt-1 max-w-md text-sm text-slate-500">
                Add a customer or
                adjust the selected
                filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Customer",
                      "Request",
                      "Preferences",
                      "Status",
                      "Priority",
                      "Created",
                      "Actions",
                    ].map(
                      (
                        heading
                      ) => (
                        <th
                          key={
                            heading
                          }
                          className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500"
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {entries.map(
                    (
                      entry
                    ) => (
                      <tr
                        key={
                          entry._id
                        }
                        className="align-top hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {getCustomerName(
                              entry.customer
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {entry
                              .customer
                              ?.email ||
                              entry
                                .customer
                                ?.phone ||
                              "No contact details"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-medium text-slate-800">
                            {getServiceName(
                              entry.service
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {getStylistName(
                              entry.stylist
                            )}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          <p>
                            {TIME_LABELS[
                              entry
                                .timePreference
                            ] ||
                              "Any time"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {entry
                              .preferredDates
                              ?.length
                              ? entry.preferredDates
                                  .map(
                                    formatDate
                                  )
                                  .join(
                                    ", "
                                  )
                              : "Flexible dates"}
                          </p>

                          {entry.expiresAt && (
                            <p className="mt-1 text-xs text-slate-400">
                              Expires{" "}
                              {formatDate(
                                entry.expiresAt
                              )}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <WaitlistStatusBadge
                            status={
                              entry.status
                            }
                          />
                        </td>

                        <td className="px-5 py-4">
                          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-slate-100 px-2 text-sm font-bold text-slate-700">
                            {entry.priority ||
                              0}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-500">
                          {formatDateTime(
                            entry.createdAt
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex min-w-48 flex-wrap gap-2">
                            {entry.status ===
                              "waiting" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusChange(
                                    entry,
                                    "notified"
                                  )
                                }
                                disabled={
                                  actionLoading
                                }
                                className="rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                              >
                                Notify
                              </button>
                            )}

                            {entry.status ===
                              "notified" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleStatusChange(
                                      entry,
                                      "accepted"
                                    )
                                  }
                                  disabled={
                                    actionLoading
                                  }
                                  className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                >
                                  Accept
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleStatusChange(
                                      entry,
                                      "declined"
                                    )
                                  }
                                  disabled={
                                    actionLoading
                                  }
                                  className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                >
                                  Decline
                                </button>
                              </>
                            )}

                            {[
                              "waiting",
                              "notified",
                              "accepted",
                            ].includes(
                              entry.status
                            ) && (
                              <button
                                type="button"
                                onClick={() =>
                                  openConversion(
                                    entry
                                  )
                                }
                                disabled={
                                  actionLoading
                                }
                                className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                              >
                                Book
                              </button>
                            )}

                            {entry.status !==
                              "booked" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDelete(
                                    entry
                                  )
                                }
                                disabled={
                                  actionLoading
                                }
                                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                                aria-label="Delete entry"
                              >
                                <Trash2
                                  size={
                                    15
                                  }
                                />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
            <p className="text-sm text-slate-500">
              {getPaginationValue(
                pagination,
                ["total"],
                entries.length
              )}{" "}
              entr
              {getPaginationValue(
                pagination,
                ["total"],
                entries.length
              ) === 1
                ? "y"
                : "ies"}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={
                  page <= 1 ||
                  loading
                }
                onClick={() =>
                  setPage(
                    (
                      current
                    ) =>
                      Math.max(
                        1,
                        current -
                          1
                      )
                  )
                }
                className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft
                  size={17}
                />
              </button>

              <span className="min-w-24 text-center text-sm font-medium text-slate-600">
                Page {page} of{" "}
                {totalPages}
              </span>

              <button
                type="button"
                disabled={
                  page >=
                    totalPages ||
                  loading
                }
                onClick={() =>
                  setPage(
                    (
                      current
                    ) =>
                      Math.min(
                        totalPages,
                        current +
                          1
                      )
                  )
                }
                className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight
                  size={17}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {createOpen && (
        <Modal
          title="Add customer to waiting list"
          description="Record the customer’s preferred service, stylist, dates and contact method."
          onClose={() =>
            setCreateOpen(
              false
            )
          }
        >
          <form
            onSubmit={
              handleCreate
            }
            className="space-y-5 p-6"
          >
            {referenceLoading && (
              <p className="text-sm text-slate-500">
                Loading customers,
                services and
                stylists…
              </p>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>Customer</span>

                <select
                  required
                  value={
                    createForm.customer
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,
                        customer:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                >
                  <option value="">
                    Select customer
                  </option>

                  {customerOptions.map(
                    (
                      customer
                    ) => (
                      <option
                        key={getEntityId(
                          customer
                        )}
                        value={getEntityId(
                          customer
                        )}
                      >
                        {getCustomerName(
                          customer
                        )}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>Service</span>

                <select
                  required
                  value={
                    createForm.service
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,
                        service:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                >
                  <option value="">
                    Select service
                  </option>

                  {serviceOptions.map(
                    (
                      service
                    ) => (
                      <option
                        key={getEntityId(
                          service
                        )}
                        value={getEntityId(
                          service
                        )}
                      >
                        {getServiceName(
                          service
                        )}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>
                  Preferred stylist
                </span>

                <select
                  value={
                    createForm.stylist
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,
                        stylist:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                >
                  <option value="">
                    Any stylist
                  </option>

                  {stylistOptions.map(
                    (
                      stylist
                    ) => (
                      <option
                        key={getEntityId(
                          stylist
                        )}
                        value={getEntityId(
                          stylist
                        )}
                      >
                        {getStylistName(
                          stylist
                        )}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>
                  Preferred date
                </span>

                <input
                  type="date"
                  value={
                    createForm.preferredDate
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,
                        preferredDate:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>
                  Date range start
                </span>

                <input
                  type="date"
                  value={
                    createForm.dateRangeStart
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,
                        dateRangeStart:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>
                  Date range end
                </span>

                <input
                  type="date"
                  value={
                    createForm.dateRangeEnd
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,
                        dateRangeEnd:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>
                  Time preference
                </span>

                <select
                  value={
                    createForm.timePreference
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,
                        timePreference:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                >
                  {WAITLIST_TIME_PREFERENCES.map(
                    (
                      preference
                    ) => (
                      <option
                        key={
                          preference
                        }
                        value={
                          preference
                        }
                      >
                        {
                          TIME_LABELS[
                            preference
                          ]
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>
                  Contact channel
                </span>

                <select
                  value={
                    createForm.preferredContactChannel
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,
                        preferredContactChannel:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                >
                  {WAITLIST_CONTACT_CHANNELS.map(
                    (
                      channel
                    ) => (
                      <option
                        key={
                          channel
                        }
                        value={
                          channel
                        }
                      >
                        {
                          CHANNEL_LABELS[
                            channel
                          ]
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>
                  Earliest time
                </span>

                <input
                  type="time"
                  value={
                    createForm.earliestTime
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,
                        earliestTime:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>
                  Latest time
                </span>

                <input
                  type="time"
                  value={
                    createForm.latestTime
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,
                        latestTime:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>
                  Priority
                </span>

                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={
                    createForm.priority
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,
                        priority:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>
                  Expiry date
                </span>

                <input
                  type="datetime-local"
                  value={
                    createForm.expiresAt
                  }
                  onChange={(
                    event
                  ) =>
                    setCreateForm(
                      (
                        current
                      ) => ({
                        ...current,
                        expiresAt:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                />
              </label>
            </div>

            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              <span>Notes</span>

              <textarea
                rows={4}
                value={
                  createForm.notes
                }
                onChange={(
                  event
                ) =>
                  setCreateForm(
                    (
                      current
                    ) => ({
                      ...current,
                      notes:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
              />
            </label>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() =>
                  setCreateOpen(
                    false
                  )
                }
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  actionLoading
                }
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionLoading && (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                )}

                Add customer
              </button>
            </div>
          </form>
        </Modal>
      )}

      {convertEntry && (
        <Modal
          title="Convert to appointment"
          description={`Create an appointment for ${getCustomerName(
            convertEntry.customer
          )}.`}
          onClose={() =>
            setConvertEntry(
              null
            )
          }
        >
          <form
            onSubmit={
              handleConvert
            }
            className="space-y-5 p-6"
          >
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
              <p className="font-semibold text-indigo-900">
                {getServiceName(
                  convertEntry.service
                )}
              </p>

              <p className="mt-1 text-sm text-indigo-700">
                Requested stylist:{" "}
                {getStylistName(
                  convertEntry.stylist
                )}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>Stylist</span>

                <select
                  required
                  value={
                    convertForm.stylist
                  }
                  onChange={(
                    event
                  ) =>
                    setConvertForm(
                      (
                        current
                      ) => ({
                        ...current,
                        stylist:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                >
                  <option value="">
                    Select stylist
                  </option>

                  {stylistOptions.map(
                    (
                      stylist
                    ) => (
                      <option
                        key={getEntityId(
                          stylist
                        )}
                        value={getEntityId(
                          stylist
                        )}
                      >
                        {getStylistName(
                          stylist
                        )}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>
                  Initial status
                </span>

                <select
                  value={
                    convertForm.status
                  }
                  onChange={(
                    event
                  ) =>
                    setConvertForm(
                      (
                        current
                      ) => ({
                        ...current,
                        status:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                >
                  <option value="pending">
                    Pending
                  </option>

                  <option value="confirmed">
                    Confirmed
                  </option>
                </select>
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>Date</span>

                <input
                  required
                  type="date"
                  value={
                    convertForm.appointmentDate
                  }
                  onChange={(
                    event
                  ) =>
                    setConvertForm(
                      (
                        current
                      ) => ({
                        ...current,
                        appointmentDate:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>Time</span>

                <input
                  required
                  type="time"
                  value={
                    convertForm.appointmentTime
                  }
                  onChange={(
                    event
                  ) =>
                    setConvertForm(
                      (
                        current
                      ) => ({
                        ...current,
                        appointmentTime:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>
                  Duration in minutes
                </span>

                <input
                  required
                  type="number"
                  min="1"
                  max="1440"
                  value={
                    convertForm.duration
                  }
                  onChange={(
                    event
                  ) =>
                    setConvertForm(
                      (
                        current
                      ) => ({
                        ...current,
                        duration:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>
                  Total price
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    convertForm.totalPrice
                  }
                  onChange={(
                    event
                  ) =>
                    setConvertForm(
                      (
                        current
                      ) => ({
                        ...current,
                        totalPrice:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
                />
              </label>
            </div>

            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              <span>Notes</span>

              <textarea
                rows={3}
                value={
                  convertForm.notes
                }
                onChange={(
                  event
                ) =>
                  setConvertForm(
                    (
                      current
                    ) => ({
                      ...current,
                      notes:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={
                  convertForm.force
                }
                onChange={(
                  event
                ) =>
                  setConvertForm(
                    (
                      current
                    ) => ({
                      ...current,
                      force:
                        event
                          .target
                          .checked,
                    })
                  )
                }
              />

              Override waiting-list
              preferences when the
              selected slot does not
              match.
            </label>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() =>
                  setConvertEntry(
                    null
                  )
                }
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  actionLoading
                }
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionLoading && (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                )}

                <UserRoundCheck
                  size={17}
                />

                Create appointment
              </button>
            </div>
          </form>
        </Modal>
      )}

      {matchOpen && (
        <Modal
          title="Match an available slot"
          description="Find the highest-priority customers whose preferences match an available appointment."
          onClose={() => {
            setMatchOpen(
              false
            );

            setMatchResults(
              []
            );
          }}
          widthClass="max-w-4xl"
        >
          <form
            onSubmit={
              handleMatch
            }
            className="border-b border-slate-200 p-6"
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <select
                required
                value={
                  matchForm.service
                }
                onChange={(
                  event
                ) =>
                  setMatchForm(
                    (
                      current
                    ) => ({
                      ...current,
                      service:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              >
                <option value="">
                  Select service
                </option>

                {serviceOptions.map(
                  (
                    service
                  ) => (
                    <option
                      key={getEntityId(
                        service
                      )}
                      value={getEntityId(
                        service
                      )}
                    >
                      {getServiceName(
                        service
                      )}
                    </option>
                  )
                )}
              </select>

              <select
                value={
                  matchForm.stylist
                }
                onChange={(
                  event
                ) =>
                  setMatchForm(
                    (
                      current
                    ) => ({
                      ...current,
                      stylist:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              >
                <option value="">
                  Any stylist
                </option>

                {stylistOptions.map(
                  (
                    stylist
                  ) => (
                    <option
                      key={getEntityId(
                        stylist
                      )}
                      value={getEntityId(
                        stylist
                      )}
                    >
                      {getStylistName(
                        stylist
                      )}
                    </option>
                  )
                )}
              </select>

              <input
                required
                type="date"
                value={
                  matchForm.appointmentDate
                }
                onChange={(
                  event
                ) =>
                  setMatchForm(
                    (
                      current
                    ) => ({
                      ...current,
                      appointmentDate:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              />

              <input
                required
                type="time"
                value={
                  matchForm.appointmentTime
                }
                onChange={(
                  event
                ) =>
                  setMatchForm(
                    (
                      current
                    ) => ({
                      ...current,
                      appointmentTime:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={
                matchLoading
              }
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {matchLoading ? (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Search
                  size={17}
                />
              )}

              Find matches
            </button>
          </form>

          <div className="space-y-3 p-6">
            {!matchLoading &&
              matchResults.length ===
                0 && (
                <p className="py-10 text-center text-sm text-slate-500">
                  Enter an available
                  slot to find matching
                  customers.
                </p>
              )}

            {matchResults.map(
              (
                entry,
                index
              ) => (
                <div
                  key={
                    entry._id
                  }
                  className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                        {index + 1}
                      </span>

                      <p className="font-semibold text-slate-900">
                        {getCustomerName(
                          entry.customer
                        )}
                      </p>

                      <WaitlistStatusBadge
                        status={
                          entry.status
                        }
                      />
                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      Match score:{" "}
                      <strong className="text-slate-700">
                        {entry.matchScore ||
                          0}
                      </strong>
                    </p>

                    {entry
                      .matchReasons
                      ?.length >
                      0 && (
                      <p className="mt-1 text-xs text-slate-400">
                        {entry.matchReasons.join(
                          " • "
                        )}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMatchOpen(
                        false
                      );

                      openConversion(
                        entry
                      );

                      setConvertForm(
                        (
                          current
                        ) => ({
                          ...current,

                          stylist:
                            matchForm.stylist ||
                            getEntityId(
                              entry.stylist
                            ),

                          appointmentDate:
                            matchForm.appointmentDate,

                          appointmentTime:
                            matchForm.appointmentTime,
                        })
                      );
                    }}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Book customer
                  </button>
                </div>
              )
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}