import {
  AlertCircle,
  Archive,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Gem,
  Mail,
  MessageSquareText,
  RefreshCw,
  Repeat2,
  Search,
  Settings2,
  Sparkles,
  UserCheck,
  UserMinus,
  UserRound,
  Users,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import customerSegmentationService from "../Services/customerSegmentationService.js";

const DEFAULT_SETTINGS = {
  newCustomerDays: 30,
  recentVisitDays: 90,
  dormantDays: 180,
  frequentVisitCount: 5,
  highValueSpend: 500,
};

const SORT_OPTIONS = [
  {
    value: "createdAt:desc",
    label: "Newest customers",
  },
  {
    value: "createdAt:asc",
    label: "Oldest customers",
  },
  {
    value: "lastVisit:desc",
    label: "Most recent visit",
  },
  {
    value: "lastVisit:asc",
    label: "Oldest visit",
  },
  {
    value: "visitCount:desc",
    label: "Most visits",
  },
  {
    value: "totalSpent:desc",
    label: "Highest spending",
  },
  {
    value: "firstName:asc",
    label: "Name A–Z",
  },
  {
    value: "firstName:desc",
    label: "Name Z–A",
  },
];

const SEGMENT_ICONS = {
  all: Users,
  active: UserCheck,
  new: Sparkles,
  recent: CalendarClock,
  dormant: CalendarClock,
  "never-visited": UserMinus,
  frequent: Repeat2,
  "high-value": Gem,
  "email-consent": Mail,
  "sms-consent": MessageSquareText,
  archived: Archive,
};

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function formatCurrency(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "£0.00";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat(
    "en-GB"
  ).format(number);
}

function formatDate(value) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
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

function getCustomerName(customer) {
  const firstName = String(
    customer?.firstName || ""
  ).trim();

  const lastName = String(
    customer?.lastName || ""
  ).trim();

  return (
    String(
      customer?.fullName ||
        customer?.name ||
        `${firstName} ${lastName}`
    ).trim() || "Unnamed customer"
  );
}

function getCustomerInitials(customer) {
  return getCustomerName(customer)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");
}

function getPreferredStylistName(customer) {
  const stylist =
    customer?.preferredStylist;

  if (
    !stylist ||
    typeof stylist !== "object"
  ) {
    return "Not selected";
  }

  return (
    String(
      stylist.fullName ||
        stylist.name ||
        `${stylist.firstName || ""} ${
          stylist.lastName || ""
        }`
    ).trim() || "Not selected"
  );
}

function formatStatus(status) {
  const value = String(
    status || "active"
  ).toLowerCase();

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

function getStatusClasses(status) {
  switch (
    String(status || "active").toLowerCase()
  ) {
    case "archived":
      return "border-slate-200 bg-slate-100 text-slate-700";

    case "deleted":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

function normaliseSettings(settings) {
  return {
    newCustomerDays: Math.max(
      0,
      Number(settings.newCustomerDays) ||
        DEFAULT_SETTINGS.newCustomerDays
    ),

    recentVisitDays: Math.max(
      0,
      Number(settings.recentVisitDays) ||
        DEFAULT_SETTINGS.recentVisitDays
    ),

    dormantDays: Math.max(
      0,
      Number(settings.dormantDays) ||
        DEFAULT_SETTINGS.dormantDays
    ),

    frequentVisitCount: Math.max(
      0,
      Number(
        settings.frequentVisitCount
      ) ||
        DEFAULT_SETTINGS.frequentVisitCount
    ),

    highValueSpend: Math.max(
      0,
      Number(settings.highValueSpend) ||
        DEFAULT_SETTINGS.highValueSpend
    ),
  };
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  description,
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">
            {label}
          </p>

          <p className="mt-2 truncate text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={21} />
        </div>
      </div>
    </article>
  );
}

function SegmentCard({
  definition,
  count,
  selected,
  onSelect,
}) {
  const Icon =
    SEGMENT_ICONS[definition.key] ||
    Users;

  return (
    <button
      type="button"
      onClick={() =>
        onSelect(definition.key)
      }
      className={`rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-indigo-500 bg-indigo-50 shadow-sm ring-1 ring-indigo-500"
          : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            selected
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          <Icon size={19} />
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            selected
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {formatNumber(count)}
        </span>
      </div>

      <h3 className="mt-4 text-sm font-bold text-slate-900">
        {definition.name}
      </h3>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {definition.description}
      </p>
    </button>
  );
}

function ConsentBadge({
  type,
  enabled,
}) {
  const Icon =
    type === "email"
      ? Mail
      : MessageSquareText;

  const label =
    type === "email"
      ? "Email"
      : "SMS";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        enabled
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-500"
      }`}
    >
      <Icon size={13} />
      {label}
    </span>
  );
}

function CustomerRow({ customer }) {
  return (
    <tr className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
      <td className="px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
            {getCustomerInitials(
              customer
            ) || <UserRound size={18} />}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {getCustomerName(customer)}
            </p>

            <p className="mt-0.5 text-xs text-slate-500">
              Joined{" "}
              {formatDate(
                customer.createdAt
              )}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4">
        <p className="max-w-56 truncate text-sm text-slate-700">
          {customer.email ||
            "No email address"}
        </p>

        <p className="mt-1 max-w-56 truncate text-xs text-slate-500">
          {customer.phone ||
            "No phone number"}
        </p>
      </td>

      <td className="px-5 py-4">
        <p className="text-sm font-bold text-slate-900">
          {formatNumber(
            customer.visitCount
          )}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Last:{" "}
          {formatDate(
            customer.lastVisit
          )}
        </p>
      </td>

      <td className="px-5 py-4">
        <p className="text-sm font-bold text-slate-900">
          {formatCurrency(
            customer.totalSpent
          )}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          {formatNumber(
            customer.loyaltyPoints
          )}{" "}
          points
        </p>
      </td>

      <td className="px-5 py-4 text-sm text-slate-700">
        {getPreferredStylistName(
          customer
        )}
      </td>

      <td className="px-5 py-4">
        <div className="flex flex-wrap gap-1.5">
          <ConsentBadge
            type="email"
            enabled={
              customer.marketing
                ?.emailConsent === true
            }
          />

          <ConsentBadge
            type="sms"
            enabled={
              customer.marketing
                ?.smsConsent === true
            }
          />
        </div>
      </td>

      <td className="px-5 py-4">
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
            customer.status
          )}`}
        >
          {formatStatus(
            customer.status
          )}
        </span>
      </td>
    </tr>
  );
}

function CustomerCard({ customer }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
          {getCustomerInitials(
            customer
          ) || <UserRound size={18} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-slate-900">
                {getCustomerName(customer)}
              </h3>

              <p className="mt-1 truncate text-sm text-slate-500">
                {customer.email ||
                  "No email address"}
              </p>
            </div>

            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                customer.status
              )}`}
            >
              {formatStatus(
                customer.status
              )}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">
                Visits
              </p>

              <p className="mt-1 text-sm font-bold text-slate-900">
                {formatNumber(
                  customer.visitCount
                )}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">
                Total spent
              </p>

              <p className="mt-1 text-sm font-bold text-slate-900">
                {formatCurrency(
                  customer.totalSpent
                )}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p>
              Phone:{" "}
              {customer.phone ||
                "Not recorded"}
            </p>

            <p>
              Last visit:{" "}
              {formatDate(
                customer.lastVisit
              )}
            </p>

            <p>
              Preferred stylist:{" "}
              {getPreferredStylistName(
                customer
              )}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <ConsentBadge
              type="email"
              enabled={
                customer.marketing
                  ?.emailConsent === true
              }
            />

            <ConsentBadge
              type="sms"
              enabled={
                customer.marketing
                  ?.smsConsent === true
              }
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function CustomerSegmentationPage() {
  const [
    definitions,
    setDefinitions,
  ] = useState([]);

  const [overview, setOverview] =
    useState({
      counts: {},
      values: {},
    });

  const [customers, setCustomers] =
    useState([]);

  const [
    selectedSegment,
    setSelectedSegment,
  ] = useState("all");

  const [
    searchInput,
    setSearchInput,
  ] = useState("");

  const [search, setSearch] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [limit, setLimit] =
    useState(20);

  const [sortValue, setSortValue] =
    useState("createdAt:desc");

  const [
    draftSettings,
    setDraftSettings,
  ] = useState(DEFAULT_SETTINGS);

  const [
    appliedSettings,
    setAppliedSettings,
  ] = useState(DEFAULT_SETTINGS);

  const [
    metadataLoading,
    setMetadataLoading,
  ] = useState(true);

  const [
    customersLoading,
    setCustomersLoading,
  ] = useState(true);

  const [
    metadataError,
    setMetadataError,
  ] = useState("");

  const [
    customersError,
    setCustomersError,
  ] = useState("");

  const [
    pagination,
    setPagination,
  ] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const loadMetadata =
    useCallback(async () => {
      setMetadataLoading(true);
      setMetadataError("");

      try {
        const [
          definitionsResponse,
          overviewResponse,
        ] = await Promise.all([
          customerSegmentationService.getDefinitions(
            appliedSettings
          ),

          customerSegmentationService.getOverview(
            appliedSettings
          ),
        ]);

        setDefinitions(
          Array.isArray(
            definitionsResponse
              ?.definitions
          )
            ? definitionsResponse.definitions
            : []
        );

        setOverview(
          overviewResponse?.overview || {
            counts: {},
            values: {},
          }
        );
      } catch (error) {
        setDefinitions([]);
        setOverview({
          counts: {},
          values: {},
        });

        setMetadataError(
          getErrorMessage(
            error,
            "Unable to load customer segments."
          )
        );
      } finally {
        setMetadataLoading(false);
      }
    }, [appliedSettings]);

  const loadCustomers =
    useCallback(async () => {
      setCustomersLoading(true);
      setCustomersError("");

      const [
        sortBy,
        sortDirection,
      ] = sortValue.split(":");

      try {
        const response =
          await customerSegmentationService.getCustomers(
            {
              segment:
                selectedSegment,
              search,
              page,
              limit,
              sortBy,
              sortDirection,
              settings:
                appliedSettings,
            }
          );

        setCustomers(
          Array.isArray(
            response?.customers
          )
            ? response.customers
            : []
        );

        setPagination(
          response?.pagination || {
            page,
            limit,
            total: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        );
      } catch (error) {
        setCustomers([]);

        setCustomersError(
          getErrorMessage(
            error,
            "Unable to load segmented customers."
          )
        );
      } finally {
        setCustomersLoading(false);
      }
    }, [
      selectedSegment,
      search,
      page,
      limit,
      sortValue,
      appliedSettings,
    ]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const selectedDefinition =
    useMemo(() => {
      return (
        definitions.find(
          (definition) =>
            definition.key ===
            selectedSegment
        ) || {
          key: selectedSegment,
          name: "Customer Segment",
          description:
            "Customers matching the selected segment.",
        }
      );
    }, [
      definitions,
      selectedSegment,
    ]);

  const counts =
    overview?.counts || {};

  function selectSegment(segment) {
    setSelectedSegment(segment);
    setPage(1);
  }

  function submitSearch(event) {
    event.preventDefault();

    setSearch(
      searchInput.trim()
    );

    setPage(1);
  }

  function applySettings() {
    const settings =
      normaliseSettings(
        draftSettings
      );

    setDraftSettings(settings);
    setAppliedSettings(settings);
    setPage(1);
  }

  function resetSettings() {
    setDraftSettings(
      DEFAULT_SETTINGS
    );

    setAppliedSettings(
      DEFAULT_SETTINGS
    );

    setPage(1);
  }

  function updateSetting(
    field,
    value
  ) {
    setDraftSettings(
      (currentSettings) => ({
        ...currentSettings,
        [field]: value,
      })
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={Users}
            label="Total customers"
            value={formatNumber(
              counts.all
            )}
            description="All non-deleted customer records"
          />

          <SummaryCard
            icon={Gem}
            label="High-value customers"
            value={formatNumber(
              counts["high-value"]
            )}
            description={`Spending at least ${formatCurrency(
              appliedSettings.highValueSpend
            )}`}
          />

          <SummaryCard
            icon={CalendarClock}
            label="Dormant customers"
            value={formatNumber(
              counts.dormant
            )}
            description={`No visit for more than ${appliedSettings.dormantDays} days`}
          />

          <SummaryCard
            icon={Repeat2}
            label="Recorded visits"
            value={formatNumber(
              overview?.values
                ?.totalVisits
            )}
            description={formatCurrency(
              overview?.values
                ?.totalSpent
            )}
          />
        </section>

        {metadataError && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle
              size={19}
              className="mt-0.5 shrink-0"
            />

            <div>
              <p className="font-semibold">
                Customer segments could
                not be loaded
              </p>

              <p className="mt-1">
                {metadataError}
              </p>
            </div>
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-slate-200 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Settings2 size={20} />
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-900">
                Segment rules
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Adjust the thresholds used
                to calculate customer
                audiences.
              </p>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-5">
            <label>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                New customer days
              </span>

              <input
                type="number"
                min="0"
                value={
                  draftSettings.newCustomerDays
                }
                onChange={(event) =>
                  updateSetting(
                    "newCustomerDays",
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Recent visit days
              </span>

              <input
                type="number"
                min="0"
                value={
                  draftSettings.recentVisitDays
                }
                onChange={(event) =>
                  updateSetting(
                    "recentVisitDays",
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Dormant days
              </span>

              <input
                type="number"
                min="0"
                value={
                  draftSettings.dormantDays
                }
                onChange={(event) =>
                  updateSetting(
                    "dormantDays",
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Frequent visits
              </span>

              <input
                type="number"
                min="0"
                value={
                  draftSettings.frequentVisitCount
                }
                onChange={(event) =>
                  updateSetting(
                    "frequentVisitCount",
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                High-value spend
              </span>

              <input
                type="number"
                min="0"
                value={
                  draftSettings.highValueSpend
                }
                onChange={(event) =>
                  updateSetting(
                    "highValueSpend",
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 p-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={resetSettings}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reset defaults
            </button>

            <button
              type="button"
              onClick={applySettings}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Apply rules
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Customer segments
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select a segment to view
                matching customers.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                loadMetadata();
                loadCustomers();
              }}
              disabled={
                metadataLoading ||
                customersLoading
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={
                  metadataLoading ||
                  customersLoading
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>
          </div>

          {metadataLoading ? (
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({
                length: 8,
              }).map((_, index) => (
                <div
                  key={index}
                  className="h-40 animate-pulse rounded-2xl bg-slate-100"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {definitions.map(
                (definition) => (
                  <SegmentCard
                    key={definition.key}
                    definition={
                      definition
                    }
                    count={
                      counts[
                        definition.key
                      ] || 0
                    }
                    selected={
                      selectedSegment ===
                      definition.key
                    }
                    onSelect={
                      selectSegment
                    }
                  />
                )
              )}
            </div>
          )}
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900">
                {selectedDefinition.name}
              </h2>

              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                {formatNumber(
                  pagination.total
                )}{" "}
                customers
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {
                selectedDefinition.description
              }
            </p>
          </div>

          <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[1fr_220px_140px]">
            <form
              onSubmit={submitSearch}
              className="flex gap-2"
            >
              <div className="relative min-w-0 flex-1">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) =>
                    setSearchInput(
                      event.target.value
                    )
                  }
                  placeholder="Search name, email, phone or notes"
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                />
              </div>

              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Search
              </button>
            </form>

            <select
              value={sortValue}
              onChange={(event) => {
                setSortValue(
                  event.target.value
                );
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
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

            <select
              value={limit}
              onChange={(event) => {
                setLimit(
                  Number(
                    event.target.value
                  )
                );
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            >
              <option value={10}>
                10 per page
              </option>

              <option value={20}>
                20 per page
              </option>

              <option value={50}>
                50 per page
              </option>

              <option value={100}>
                100 per page
              </option>
            </select>
          </div>

          {customersError && (
            <div className="m-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <p>{customersError}</p>
            </div>
          )}

          {customersLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({
                length: 6,
              }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : customers.length > 0 ? (
            <>
              <div className="hidden overflow-x-auto xl:block">
                <table className="min-w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Customer
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Contact
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Visits
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Value
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Stylist
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Marketing
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {customers.map(
                      (customer) => (
                        <CustomerRow
                          key={
                            customer._id ||
                            customer.id
                          }
                          customer={
                            customer
                          }
                        />
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 p-4 sm:grid-cols-2 xl:hidden">
                {customers.map(
                  (customer) => (
                    <CustomerCard
                      key={
                        customer._id ||
                        customer.id
                      }
                      customer={
                        customer
                      }
                    />
                  )
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Page{" "}
                  <span className="font-semibold text-slate-700">
                    {pagination.page}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-700">
                    {
                      pagination.totalPages
                    }
                  </span>
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
                      !pagination.hasPreviousPage
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPage(
                        (currentPage) =>
                          currentPage + 1
                      )
                    }
                    disabled={
                      !pagination.hasNextPage
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="px-6 py-16 text-center">
              <Users
                size={38}
                className="mx-auto text-slate-300"
              />

              <h3 className="mt-4 text-base font-bold text-slate-900">
                No matching customers
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                No customers currently
                satisfy the selected
                segment rules.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}