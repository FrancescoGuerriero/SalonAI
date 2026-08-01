import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Filter,
  Layers3,
  Mail,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  UserCheck,
  UserMinus,
  Users,
  X,
} from "lucide-react";

import {
  communicationCampaignClient,
  getCommunicationCampaignErrorMessage,
} from "../../Services/communicationCampaignApi";

const AUDIENCE_TYPES = [
  {
    value: "all_customers",
    label: "All Customers",
    description:
      "Include every customer who satisfies the contact and consent requirements.",
    icon: Users,
  },
  {
    value: "segments",
    label: "Customer Segments",
    description:
      "Target one or more predefined customer groups.",
    icon: Layers3,
  },
  {
    value: "selected_customers",
    label: "Selected Customers",
    description:
      "Choose individual customers for this campaign.",
    icon: UserCheck,
  },
  {
    value: "custom_filters",
    label: "Custom Filters",
    description:
      "Build an audience using spend, appointment, date and contact criteria.",
    icon: SlidersHorizontal,
  },
];

const CUSTOMER_SEGMENTS = [
  {
    value: "new_customers",
    label: "New Customers",
    description:
      "Customers added during the last 90 days.",
  },
  {
    value: "returning_customers",
    label: "Returning Customers",
    description:
      "Customers who have made at least two appointments.",
  },
  {
    value: "dormant_customers",
    label: "Dormant Customers",
    description:
      "Customers who have not visited recently.",
  },
  {
    value: "high_value_customers",
    label: "High-Value Customers",
    description:
      "Customers whose recorded spend exceeds the selected threshold.",
  },
  {
    value: "upcoming_appointments",
    label: "Upcoming Appointments",
    description:
      "Customers with a future appointment.",
  },
  {
    value: "birthday_customers",
    label: "Birthday Customers",
    description:
      "Customers whose birthday falls within the selected month.",
  },
  {
    value: "inactive_customers",
    label: "Inactive Customers",
    description:
      "Customers currently marked as inactive or archived.",
  },
  {
    value: "vip_customers",
    label: "VIP Customers",
    description:
      "Customers marked as VIP or tagged as VIP.",
  },
];

const BIRTHDAY_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DEFAULT_FILTERS = {
  dormantDays: 60,
  minimumSpend: null,
  maximumSpend: null,
  minimumAppointments: null,
  maximumAppointments: null,
  lastAppointmentBefore: null,
  lastAppointmentAfter: null,
  appointmentDateFrom: null,
  appointmentDateTo: null,
  preferredStylist: null,
  preferredService: null,
  tags: [],
  excludeTags: [],
  hasEmail: null,
  hasPhone: null,
  birthdayMonth: null,
  customQuery: {},
};

const DEFAULT_AUDIENCE = {
  type: "all_customers",
  segments: [],
  customerIds: [],
  excludedCustomerIds: [],
  filters: DEFAULT_FILTERS,
  estimatedRecipients: 0,
  calculatedAt: null,
};

function getCustomerId(customer) {
  return String(
    customer?._id ||
      customer?.id ||
      customer ||
      ""
  ).trim();
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
    customer.phone ||
    "Unknown customer"
  );
}

function getCustomerEmail(customer) {
  if (
    !customer ||
    typeof customer === "string"
  ) {
    return "";
  }

  return String(customer.email || "").trim();
}

function getCustomerPhone(customer) {
  if (
    !customer ||
    typeof customer === "string"
  ) {
    return "";
  }

  return String(
    customer.phone ||
      customer.phoneNumber ||
      customer.mobile ||
      customer.telephone ||
      ""
  ).trim();
}

function normalizeAudience(value) {
  const audience =
    value &&
    typeof value === "object"
      ? value
      : {};

  return {
    ...DEFAULT_AUDIENCE,
    ...audience,

    segments: Array.isArray(
      audience.segments
    )
      ? audience.segments
      : [],

    customerIds: Array.isArray(
      audience.customerIds
    )
      ? audience.customerIds
      : [],

    excludedCustomerIds: Array.isArray(
      audience.excludedCustomerIds
    )
      ? audience.excludedCustomerIds
      : [],

    filters: {
      ...DEFAULT_FILTERS,
      ...(audience.filters || {}),

      tags: Array.isArray(
        audience.filters?.tags
      )
        ? audience.filters.tags
        : [],

      excludeTags: Array.isArray(
        audience.filters?.excludeTags
      )
        ? audience.filters.excludeTags
        : [],

      customQuery:
        audience.filters?.customQuery &&
        typeof audience.filters
          .customQuery === "object"
          ? audience.filters.customQuery
          : {},
    },
  };
}

function normalizeCustomerResults(response) {
  const payload =
    response?.data ?? response ?? {};

  const possibleCollections = [
    payload.customers,
    payload.results,
    payload.items,
    payload.data?.customers,
    payload.data?.results,
    payload.data?.items,
    payload.data,
  ];

  const customers =
    possibleCollections.find(Array.isArray) ||
    [];

  return customers.filter(
    (customer) => getCustomerId(customer)
  );
}

function parseOptionalNumber(value) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const parsedValue = Number(value);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < 0
  ) {
    return null;
  }

  return parsedValue;
}

function parseCommaSeparatedValues(value) {
  return Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((item) =>
          item.trim().toLowerCase()
        )
        .filter(Boolean)
    )
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-GB").format(
    Number(value) || 0
  );
}

function CustomerSummary({
  customer,
  onRemove,
  disabled,
  exclusion = false,
}) {
  const email = getCustomerEmail(customer);
  const phone = getCustomerPhone(customer);

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${
        exclusion
          ? "border-red-200 bg-red-50"
          : "border-indigo-200 bg-indigo-50"
      }`}
    >
      <div className="min-w-0">
        <p
          className={`truncate text-sm font-semibold ${
            exclusion
              ? "text-red-900"
              : "text-indigo-900"
          }`}
        >
          {getCustomerName(customer)}
        </p>

        <div
          className={`mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs ${
            exclusion
              ? "text-red-700"
              : "text-indigo-700"
          }`}
        >
          {email ? (
            <span className="inline-flex items-center gap-1">
              <Mail size={12} />
              {email}
            </span>
          ) : null}

          {phone ? (
            <span className="inline-flex items-center gap-1">
              <Phone size={12} />
              {phone}
            </span>
          ) : null}

          {!email && !phone ? (
            <span>
              Contact details unavailable
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRemove?.(customer)}
        disabled={disabled}
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${
          exclusion
            ? "text-red-600 hover:bg-red-100"
            : "text-indigo-600 hover:bg-indigo-100"
        }`}
        aria-label={`Remove ${getCustomerName(
          customer
        )}`}
      >
        <X size={16} />
      </button>
    </div>
  );
}

function CustomerPicker({
  title,
  description,
  selectedCustomers,
  blockedCustomerIds = [],
  onAdd,
  disabled,
  exclusion = false,
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] =
    useState(false);
  const [searchError, setSearchError] =
    useState("");

  const selectedIds = useMemo(
    () =>
      new Set(
        selectedCustomers
          .map(getCustomerId)
          .filter(Boolean)
      ),
    [selectedCustomers]
  );

  const blockedIds = useMemo(
    () =>
      new Set(
        blockedCustomerIds
          .map(getCustomerId)
          .filter(Boolean)
      ),
    [blockedCustomerIds]
  );

  useEffect(() => {
    const query = search.trim();

    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError("");
      return undefined;
    }

    let cancelled = false;

    const timer = window.setTimeout(
      async () => {
        try {
          setSearching(true);
          setSearchError("");

          const response =
            await communicationCampaignClient.get(
              "/customers",
              {
                params: {
                  search: query,
                  q: query,
                  page: 1,
                  limit: 10,
                },
              }
            );

          if (cancelled) {
            return;
          }

          const customers =
            normalizeCustomerResults(response);

          setResults(
            customers.filter((customer) => {
              const customerId =
                getCustomerId(customer);

              return (
                !selectedIds.has(customerId) &&
                !blockedIds.has(customerId)
              );
            })
          );
        } catch (error) {
          if (cancelled) {
            return;
          }

          setResults([]);

          setSearchError(
            getCommunicationCampaignErrorMessage(
              error,
              "Unable to search for customers."
            )
          );
        } finally {
          if (!cancelled) {
            setSearching(false);
          }
        }
      },
      350
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    search,
    selectedIds,
    blockedIds,
  ]);

  function handleAdd(customer) {
    onAdd?.(customer);
    setSearch("");
    setResults([]);
    setSearchError("");
  }

  return (
    <div
      className={`rounded-xl border p-4 ${
        exclusion
          ? "border-red-200 bg-red-50/40"
          : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            exclusion
              ? "bg-red-100 text-red-700"
              : "bg-indigo-100 text-indigo-700"
          }`}
        >
          {exclusion ? (
            <UserMinus size={18} />
          ) : (
            <UserCheck size={18} />
          )}
        </div>

        <div>
          <h4
            className={`font-semibold ${
              exclusion
                ? "text-red-900"
                : "text-gray-900"
            }`}
          >
            {title}
          </h4>

          <p
            className={`mt-1 text-xs leading-5 ${
              exclusion
                ? "text-red-700"
                : "text-gray-500"
            }`}
          >
            {description}
          </p>
        </div>
      </div>

      <div className="relative mt-4">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          size={17}
        />

        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          disabled={disabled}
          placeholder="Search by name, email or phone..."
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-gray-100"
        />

        {searching ? (
          <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
        ) : null}
      </div>

      {search.trim().length === 1 ? (
        <p className="mt-2 text-xs text-gray-500">
          Enter at least 2 characters.
        </p>
      ) : null}

      {searchError ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle
            className="mt-0.5 shrink-0"
            size={15}
          />
          {searchError}
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
          {results.map((customer) => (
            <button
              key={getCustomerId(customer)}
              type="button"
              onClick={() =>
                handleAdd(customer)
              }
              disabled={disabled}
              className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {getCustomerName(customer)}
                </p>

                <p className="mt-1 truncate text-xs text-gray-500">
                  {getCustomerEmail(customer) ||
                    getCustomerPhone(customer) ||
                    "No contact details"}
                </p>
              </div>

              <Plus
                className={
                  exclusion
                    ? "text-red-600"
                    : "text-indigo-600"
                }
                size={17}
              />
            </button>
          ))}
        </div>
      ) : null}

      {search.trim().length >= 2 &&
      !searching &&
      !searchError &&
      results.length === 0 ? (
        <p className="mt-3 text-center text-xs text-gray-500">
          No matching customers found.
        </p>
      ) : null}
    </div>
  );
}

export default function CampaignAudienceSelector({
  value,
  channel = "email",
  disabled = false,
  preview = null,
  previewing = false,
  previewError = "",
  onChange,
  onPreview,
}) {
  const audience = useMemo(
    () => normalizeAudience(value),
    [value]
  );

  const [tagsText, setTagsText] = useState(
    ""
  );

  const [
    excludeTagsText,
    setExcludeTagsText,
  ] = useState("");

  useEffect(() => {
    setTagsText(
      (audience.filters.tags || []).join(
        ", "
      )
    );

    setExcludeTagsText(
      (
        audience.filters.excludeTags ||
        []
      ).join(", ")
    );
  }, [
    audience.filters.tags,
    audience.filters.excludeTags,
  ]);

  const selectedCustomerIds = useMemo(
    () =>
      new Set(
        audience.customerIds
          .map(getCustomerId)
          .filter(Boolean)
      ),
    [audience.customerIds]
  );

  const excludedCustomerIds = useMemo(
    () =>
      new Set(
        audience.excludedCustomerIds
          .map(getCustomerId)
          .filter(Boolean)
      ),
    [audience.excludedCustomerIds]
  );

  function emitChange(nextAudience) {
    onChange?.(
      normalizeAudience(nextAudience)
    );
  }

  function updateAudienceField(
    field,
    nextValue
  ) {
    emitChange({
      ...audience,
      [field]: nextValue,
      calculatedAt: null,
    });
  }

  function updateFilter(
    field,
    nextValue
  ) {
    emitChange({
      ...audience,

      filters: {
        ...audience.filters,
        [field]: nextValue,
      },

      calculatedAt: null,
    });
  }

  function handleAudienceTypeChange(type) {
    emitChange({
      ...audience,
      type,
      calculatedAt: null,
    });
  }

  function toggleSegment(segment) {
    const segmentSelected =
      audience.segments.includes(segment);

    const nextSegments =
      segmentSelected
        ? audience.segments.filter(
            (currentSegment) =>
              currentSegment !== segment
          )
        : [
            ...audience.segments,
            segment,
          ];

    updateAudienceField(
      "segments",
      nextSegments
    );
  }

  function addSelectedCustomer(customer) {
    const customerId =
      getCustomerId(customer);

    if (
      !customerId ||
      selectedCustomerIds.has(customerId)
    ) {
      return;
    }

    emitChange({
      ...audience,

      customerIds: [
        ...audience.customerIds,
        customer,
      ],

      excludedCustomerIds:
        audience.excludedCustomerIds.filter(
          (excludedCustomer) =>
            getCustomerId(
              excludedCustomer
            ) !== customerId
        ),

      calculatedAt: null,
    });
  }

  function removeSelectedCustomer(customer) {
    const customerId =
      getCustomerId(customer);

    updateAudienceField(
      "customerIds",
      audience.customerIds.filter(
        (selectedCustomer) =>
          getCustomerId(
            selectedCustomer
          ) !== customerId
      )
    );
  }

  function addExcludedCustomer(customer) {
    const customerId =
      getCustomerId(customer);

    if (
      !customerId ||
      excludedCustomerIds.has(customerId)
    ) {
      return;
    }

    emitChange({
      ...audience,

      excludedCustomerIds: [
        ...audience.excludedCustomerIds,
        customer,
      ],

      customerIds:
        audience.customerIds.filter(
          (selectedCustomer) =>
            getCustomerId(
              selectedCustomer
            ) !== customerId
        ),

      calculatedAt: null,
    });
  }

  function removeExcludedCustomer(customer) {
    const customerId =
      getCustomerId(customer);

    updateAudienceField(
      "excludedCustomerIds",
      audience.excludedCustomerIds.filter(
        (excludedCustomer) =>
          getCustomerId(
            excludedCustomer
          ) !== customerId
      )
    );
  }

  function commitTags() {
    updateFilter(
      "tags",
      parseCommaSeparatedValues(tagsText)
    );
  }

  function commitExcludedTags() {
    updateFilter(
      "excludeTags",
      parseCommaSeparatedValues(
        excludeTagsText
      )
    );
  }

  const selectedCount =
    audience.customerIds.length;

  const excludedCount =
    audience.excludedCustomerIds.length;

  const previewData =
    preview?.preview ||
    preview?.data?.preview ||
    preview ||
    null;

  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Users
            className="text-indigo-600"
            size={20}
          />

          <div>
            <h3 className="font-semibold text-gray-900">
              Campaign audience
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Select the customers who should
              receive this {channel} campaign.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {AUDIENCE_TYPES.map((option) => {
            const Icon = option.icon;

            const selected =
              audience.type === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  handleAudienceTypeChange(
                    option.value
                  )
                }
                disabled={disabled}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    selected
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <Icon size={19} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`font-semibold ${
                        selected
                          ? "text-indigo-900"
                          : "text-gray-900"
                      }`}
                    >
                      {option.label}
                    </p>

                    {selected ? (
                      <Check
                        className="shrink-0 text-indigo-600"
                        size={18}
                      />
                    ) : null}
                  </div>

                  <p
                    className={`mt-1 text-xs leading-5 ${
                      selected
                        ? "text-indigo-700"
                        : "text-gray-500"
                    }`}
                  >
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {audience.type ===
      "all_customers" ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <Users
              className="mt-0.5 shrink-0 text-blue-700"
              size={20}
            />

            <div>
              <h4 className="font-semibold text-blue-900">
                All eligible customers
              </h4>

              <p className="mt-1 text-sm leading-6 text-blue-700">
                The campaign will include all
                customers who have valid contact
                details and satisfy the selected
                consent and unsubscribe settings.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {audience.type === "segments" ? (
        <div className="space-y-5">
          <div>
            <h4 className="font-semibold text-gray-900">
              Select customer segments
            </h4>

            <p className="mt-1 text-sm text-gray-500">
              Customers matching any selected
              segment will be included.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {CUSTOMER_SEGMENTS.map(
              (segment) => {
                const selected =
                  audience.segments.includes(
                    segment.value
                  );

                return (
                  <button
                    key={segment.value}
                    type="button"
                    onClick={() =>
                      toggleSegment(
                        segment.value
                      )
                    }
                    disabled={disabled}
                    className={`rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p
                          className={`font-semibold ${
                            selected
                              ? "text-indigo-900"
                              : "text-gray-900"
                          }`}
                        >
                          {segment.label}
                        </p>

                        <p
                          className={`mt-1 text-xs leading-5 ${
                            selected
                              ? "text-indigo-700"
                              : "text-gray-500"
                          }`}
                        >
                          {segment.description}
                        </p>
                      </div>

                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          selected
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {selected ? (
                          <Check size={13} />
                        ) : null}
                      </span>
                    </div>
                  </button>
                );
              }
            )}
          </div>

          {audience.segments.includes(
            "dormant_customers"
          ) ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <label
                htmlFor="campaign-dormant-days"
                className="block text-sm font-semibold text-gray-700"
              >
                Dormant after
              </label>

              <div className="mt-2 flex items-center gap-3">
                <input
                  id="campaign-dormant-days"
                  type="number"
                  min="1"
                  max="3650"
                  value={
                    audience.filters
                      .dormantDays ?? 60
                  }
                  onChange={(event) =>
                    updateFilter(
                      "dormantDays",
                      parseOptionalNumber(
                        event.target.value
                      ) || 60
                    )
                  }
                  disabled={disabled}
                  className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
                />

                <span className="text-sm text-gray-600">
                  days without an appointment
                </span>
              </div>
            </div>
          ) : null}

          {audience.segments.includes(
            "high_value_customers"
          ) ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <label
                htmlFor="campaign-high-value-spend"
                className="block text-sm font-semibold text-gray-700"
              >
                Minimum customer spend
              </label>

              <div className="relative mt-2 max-w-xs">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  £
                </span>

                <input
                  id="campaign-high-value-spend"
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    audience.filters
                      .minimumSpend ?? 500
                  }
                  onChange={(event) =>
                    updateFilter(
                      "minimumSpend",
                      parseOptionalNumber(
                        event.target.value
                      )
                    )
                  }
                  disabled={disabled}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-8 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
                />
              </div>
            </div>
          ) : null}

          {audience.segments.includes(
            "birthday_customers"
          ) ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <label
                htmlFor="campaign-birthday-month"
                className="block text-sm font-semibold text-gray-700"
              >
                Birthday month
              </label>

              <select
                id="campaign-birthday-month"
                value={
                  audience.filters
                    .birthdayMonth || ""
                }
                onChange={(event) =>
                  updateFilter(
                    "birthdayMonth",
                    event.target.value
                      ? Number(
                          event.target.value
                        )
                      : null
                  )
                }
                disabled={disabled}
                className="mt-2 w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
              >
                <option value="">
                  Current month
                </option>

                {BIRTHDAY_MONTHS.map(
                  (month, index) => (
                    <option
                      key={month}
                      value={index + 1}
                    >
                      {month}
                    </option>
                  )
                )}
              </select>
            </div>
          ) : null}

          {audience.segments.length ===
          0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertCircle
                className="mt-0.5 shrink-0 text-amber-600"
                size={19}
              />

              <p className="text-sm text-amber-800">
                Select at least one customer
                segment before saving the
                campaign.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {audience.type ===
      "selected_customers" ? (
        <div className="space-y-5">
          <CustomerPicker
            title="Add campaign customers"
            description="Search for individual customers to include in this campaign."
            selectedCustomers={
              audience.customerIds
            }
            blockedCustomerIds={
              audience.excludedCustomerIds
            }
            onAdd={addSelectedCustomer}
            disabled={disabled}
          />

          {selectedCount > 0 ? (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="font-semibold text-gray-900">
                  Selected customers
                </h4>

                <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">
                  {selectedCount}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {audience.customerIds.map(
                  (customer) => (
                    <CustomerSummary
                      key={getCustomerId(
                        customer
                      )}
                      customer={customer}
                      onRemove={
                        removeSelectedCustomer
                      }
                      disabled={disabled}
                    />
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertCircle
                className="mt-0.5 shrink-0 text-amber-600"
                size={19}
              />

              <p className="text-sm text-amber-800">
                Select at least one customer
                before saving this campaign.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {audience.type ===
      "custom_filters" ? (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Filter
              className="text-indigo-600"
              size={19}
            />

            <div>
              <h4 className="font-semibold text-gray-900">
                Audience filters
              </h4>

              <p className="mt-1 text-sm text-gray-500">
                Customers must satisfy the
                configured filter conditions.
              </p>
            </div>
          </div>

          <div className="grid gap-5 rounded-xl border border-gray-200 bg-gray-50 p-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Minimum spend
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  £
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    audience.filters
                      .minimumSpend ?? ""
                  }
                  onChange={(event) =>
                    updateFilter(
                      "minimumSpend",
                      parseOptionalNumber(
                        event.target.value
                      )
                    )
                  }
                  disabled={disabled}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-8 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Maximum spend
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  £
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    audience.filters
                      .maximumSpend ?? ""
                  }
                  onChange={(event) =>
                    updateFilter(
                      "maximumSpend",
                      parseOptionalNumber(
                        event.target.value
                      )
                    )
                  }
                  disabled={disabled}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-8 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Minimum appointments
              </label>

              <input
                type="number"
                min="0"
                value={
                  audience.filters
                    .minimumAppointments ?? ""
                }
                onChange={(event) =>
                  updateFilter(
                    "minimumAppointments",
                    parseOptionalNumber(
                      event.target.value
                    )
                  )
                }
                disabled={disabled}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Maximum appointments
              </label>

              <input
                type="number"
                min="0"
                value={
                  audience.filters
                    .maximumAppointments ?? ""
                }
                onChange={(event) =>
                  updateFilter(
                    "maximumAppointments",
                    parseOptionalNumber(
                      event.target.value
                    )
                  )
                }
                disabled={disabled}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Last appointment after
              </label>

              <input
                type="date"
                value={
                  audience.filters
                    .lastAppointmentAfter
                    ? String(
                        audience.filters
                          .lastAppointmentAfter
                      ).slice(0, 10)
                    : ""
                }
                onChange={(event) =>
                  updateFilter(
                    "lastAppointmentAfter",
                    event.target.value || null
                  )
                }
                disabled={disabled}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Last appointment before
              </label>

              <input
                type="date"
                value={
                  audience.filters
                    .lastAppointmentBefore
                    ? String(
                        audience.filters
                          .lastAppointmentBefore
                      ).slice(0, 10)
                    : ""
                }
                onChange={(event) =>
                  updateFilter(
                    "lastAppointmentBefore",
                    event.target.value || null
                  )
                }
                disabled={disabled}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Upcoming appointment from
              </label>

              <input
                type="date"
                value={
                  audience.filters
                    .appointmentDateFrom
                    ? String(
                        audience.filters
                          .appointmentDateFrom
                      ).slice(0, 10)
                    : ""
                }
                onChange={(event) =>
                  updateFilter(
                    "appointmentDateFrom",
                    event.target.value || null
                  )
                }
                disabled={disabled}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Upcoming appointment to
              </label>

              <input
                type="date"
                value={
                  audience.filters
                    .appointmentDateTo
                    ? String(
                        audience.filters
                          .appointmentDateTo
                      ).slice(0, 10)
                    : ""
                }
                onChange={(event) =>
                  updateFilter(
                    "appointmentDateTo",
                    event.target.value || null
                  )
                }
                disabled={disabled}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Must have email
              </label>

              <select
                value={
                  audience.filters.hasEmail ===
                  null
                    ? ""
                    : String(
                        audience.filters.hasEmail
                      )
                }
                onChange={(event) =>
                  updateFilter(
                    "hasEmail",
                    event.target.value === ""
                      ? null
                      : event.target.value ===
                          "true"
                  )
                }
                disabled={disabled}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
              >
                <option value="">
                  Any
                </option>
                <option value="true">
                  Yes
                </option>
                <option value="false">
                  No
                </option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Must have phone
              </label>

              <select
                value={
                  audience.filters.hasPhone ===
                  null
                    ? ""
                    : String(
                        audience.filters.hasPhone
                      )
                }
                onChange={(event) =>
                  updateFilter(
                    "hasPhone",
                    event.target.value === ""
                      ? null
                      : event.target.value ===
                          "true"
                  )
                }
                disabled={disabled}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
              >
                <option value="">
                  Any
                </option>
                <option value="true">
                  Yes
                </option>
                <option value="false">
                  No
                </option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Include customer tags
              </label>

              <input
                type="text"
                value={tagsText}
                onChange={(event) =>
                  setTagsText(
                    event.target.value
                  )
                }
                onBlur={commitTags}
                disabled={disabled}
                placeholder="vip, colour-client"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
              />

              <p className="mt-1 text-xs text-gray-500">
                Separate tags with commas.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Exclude customer tags
              </label>

              <input
                type="text"
                value={excludeTagsText}
                onChange={(event) =>
                  setExcludeTagsText(
                    event.target.value
                  )
                }
                onBlur={commitExcludedTags}
                disabled={disabled}
                placeholder="do-not-contact, archived"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
              />

              <p className="mt-1 text-xs text-gray-500">
                Separate tags with commas.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Birthday month
              </label>

              <select
                value={
                  audience.filters
                    .birthdayMonth || ""
                }
                onChange={(event) =>
                  updateFilter(
                    "birthdayMonth",
                    event.target.value
                      ? Number(
                          event.target.value
                        )
                      : null
                  )
                }
                disabled={disabled}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
              >
                <option value="">
                  Any month
                </option>

                {BIRTHDAY_MONTHS.map(
                  (month, index) => (
                    <option
                      key={month}
                      value={index + 1}
                    >
                      {month}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Dormant days
              </label>

              <input
                type="number"
                min="1"
                max="3650"
                value={
                  audience.filters
                    .dormantDays ?? 60
                }
                onChange={(event) =>
                  updateFilter(
                    "dormantDays",
                    parseOptionalNumber(
                      event.target.value
                    ) || 60
                  )
                }
                disabled={disabled}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-t border-gray-200 pt-6">
        <CustomerPicker
          title="Exclude individual customers"
          description="These customers will be removed even when they match the selected audience."
          selectedCustomers={
            audience.excludedCustomerIds
          }
          blockedCustomerIds={
            audience.customerIds
          }
          onAdd={addExcludedCustomer}
          disabled={disabled}
          exclusion
        />

        {excludedCount > 0 ? (
          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="font-semibold text-gray-900">
                Excluded customers
              </h4>

              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                {excludedCount}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {audience.excludedCustomerIds.map(
                (customer) => (
                  <CustomerSummary
                    key={getCustomerId(
                      customer
                    )}
                    customer={customer}
                    onRemove={
                      removeExcludedCustomer
                    }
                    disabled={disabled}
                    exclusion
                  />
                )
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2
                className="text-indigo-700"
                size={20}
              />

              <h4 className="font-semibold text-indigo-900">
                Audience preview
              </h4>
            </div>

            <p className="mt-2 text-sm text-indigo-700">
              Validate the audience before saving
              or launching the campaign.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              onPreview?.(audience)
            }
            disabled={
              disabled || previewing
            }
            className="inline-flex min-w-40 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw
              size={16}
              className={
                previewing
                  ? "animate-spin"
                  : ""
              }
            />

            {previewing
              ? "Calculating..."
              : "Preview Audience"}
          </button>
        </div>

        {previewError ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle
              className="mt-0.5 shrink-0 text-red-600"
              size={18}
            />

            <p className="text-sm text-red-700">
              {previewError}
            </p>
          </div>
        ) : null}

        {previewData ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-indigo-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Eligible recipients
              </p>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatNumber(
                  previewData.estimatedRecipients
                )}
              </p>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Matched customers
              </p>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatNumber(
                  previewData.totalMatchedCustomers
                )}
              </p>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Skipped customers
              </p>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatNumber(
                  previewData.skippedRecipients
                )}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}