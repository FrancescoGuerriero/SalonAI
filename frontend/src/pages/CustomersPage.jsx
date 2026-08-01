import {
  AlertCircle,
  CalendarClock,
  Eye,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  listCustomerProfiles,
} from "../Services/customerProfileService.js";

function extractCustomers(responseData) {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  if (
    Array.isArray(
      responseData?.customers
    )
  ) {
    return responseData.customers;
  }

  if (
    Array.isArray(
      responseData?.data
    )
  ) {
    return responseData.data;
  }

  if (
    Array.isArray(
      responseData?.data?.customers
    )
  ) {
    return responseData.data.customers;
  }

  return [];
}

function getCustomerIdentifier(
  customer
) {
  return String(
    customer?._id ||
      customer?.id ||
      ""
  ).trim();
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
      customer?.displayName ||
        customer?.fullName ||
        customer?.name ||
        `${firstName} ${lastName}`
    ).trim() ||
    "Unnamed customer"
  );
}

function getInitials(customer) {
  return getCustomerName(customer)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part
        .charAt(0)
        .toUpperCase()
    )
    .join("");
}

function normaliseStatus(status) {
  return String(
    status || "active"
  )
    .trim()
    .toLowerCase();
}

function formatStatus(status) {
  const normalised =
    normaliseStatus(status);

  return normalised
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function getStatusStyles(status) {
  switch (
    normaliseStatus(status)
  ) {
    case "inactive":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "dormant":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "archived":
      return "border-slate-300 bg-slate-100 text-slate-700";

    case "blocked":
    case "deleted":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

function formatCurrency(value) {
  const amount =
    Number(value);

  if (
    !Number.isFinite(amount)
  ) {
    return "£0.00";
  }

  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    }
  ).format(amount);
}

function formatDate(value) {
  if (!value) {
    return "No visit recorded";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "No visit recorded";
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

function getVisitCount(customer) {
  return Number(
    customer?.visitCount ??
      customer?.totalVisits ??
      customer?.appointmentCount ??
      0
  );
}

function getTotalSpent(customer) {
  return Number(
    customer?.totalSpent ??
      customer?.lifetimeValue ??
      customer?.totalRevenue ??
      0
  );
}

function getLastVisit(customer) {
  return (
    customer?.lastVisit ||
    customer?.lastVisitAt ||
    customer?.lastAppointment ||
    customer
      ?.lastAppointmentDate ||
    null
  );
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
        <div>
          <p className="text-sm font-semibold text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
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

function CustomerRow({
  customer,
  onOpen,
}) {
  const name =
    getCustomerName(customer);

  const status =
    normaliseStatus(
      customer.status
    );

  const identifier =
    getCustomerIdentifier(
      customer
    );

  function handleOpen() {
    if (identifier) {
      onOpen(customer);
    }
  }

  function handleKeyDown(event) {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      handleOpen();
    }
  }

  return (
    <tr
      role={
        identifier
          ? "link"
          : undefined
      }
      tabIndex={
        identifier ? 0 : -1
      }
      onClick={handleOpen}
      onKeyDown={
        handleKeyDown
      }
      className={[
        "border-b border-slate-100 last:border-b-0",
        identifier
          ? "cursor-pointer transition hover:bg-indigo-50/60 focus:bg-indigo-50 focus:outline-none"
          : "",
      ].join(" ")}
      aria-label={
        identifier
          ? `Open ${name} profile`
          : undefined
      }
    >
      <td className="px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
            {getInitials(
              customer
            ) || (
              <UserRound
                size={18}
              />
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {name}
            </p>

            <p className="mt-0.5 truncate text-xs text-slate-500">
              Customer ID:{" "}
              {identifier ||
                "Not available"}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="space-y-1.5">
          <div className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
            <Mail
              size={15}
              className="shrink-0 text-slate-400"
            />

            <span className="truncate">
              {customer.email ||
                "No email address"}
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
            <Phone
              size={15}
              className="shrink-0 text-slate-400"
            />

            <span className="truncate">
              {customer.phone ||
                "No phone number"}
            </span>
          </div>
        </div>
      </td>

      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
        {getVisitCount(
          customer
        )}
      </td>

      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
        {formatCurrency(
          getTotalSpent(
            customer
          )
        )}
      </td>

      <td className="px-5 py-4 text-sm text-slate-600">
        {formatDate(
          getLastVisit(
            customer
          )
        )}
      </td>

      <td className="px-5 py-4">
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusStyles(
            status
          )}`}
        >
          {formatStatus(
            status
          )}
        </span>
      </td>

      <td className="px-5 py-4 text-right">
        <button
          type="button"
          disabled={!identifier}
          onClick={(event) => {
            event.stopPropagation();
            handleOpen();
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Eye size={15} />
          Profile
        </button>
      </td>
    </tr>
  );
}

function CustomerMobileCard({
  customer,
  onOpen,
}) {
  const name =
    getCustomerName(customer);

  const status =
    normaliseStatus(
      customer.status
    );

  const identifier =
    getCustomerIdentifier(
      customer
    );

  function handleOpen() {
    if (identifier) {
      onOpen(customer);
    }
  }

  function handleKeyDown(event) {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      handleOpen();
    }
  }

  return (
    <article
      role={
        identifier
          ? "link"
          : undefined
      }
      tabIndex={
        identifier ? 0 : -1
      }
      onClick={handleOpen}
      onKeyDown={
        handleKeyDown
      }
      className={[
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
        identifier
          ? "cursor-pointer transition hover:border-indigo-200 hover:bg-indigo-50/30 focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-50"
          : "",
      ].join(" ")}
      aria-label={
        identifier
          ? `Open ${name} profile`
          : undefined
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
          {getInitials(
            customer
          ) || (
            <UserRound
              size={18}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-slate-900">
                {name}
              </h2>

              <p className="mt-1 truncate text-sm text-slate-500">
                {customer.email ||
                  "No email address"}
              </p>
            </div>

            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusStyles(
                status
              )}`}
            >
              {formatStatus(
                status
              )}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">
                Visits
              </p>

              <p className="mt-1 text-sm font-bold text-slate-900">
                {getVisitCount(
                  customer
                )}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">
                Total spent
              </p>

              <p className="mt-1 text-sm font-bold text-slate-900">
                {formatCurrency(
                  getTotalSpent(
                    customer
                  )
                )}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Phone
                size={15}
                className="text-slate-400"
              />

              <span>
                {customer.phone ||
                  "No phone number"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <CalendarClock
                size={15}
                className="text-slate-400"
              />

              <span>
                Last visit:{" "}
                {formatDate(
                  getLastVisit(
                    customer
                  )
                )}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={!identifier}
            onClick={(event) => {
              event.stopPropagation();
              handleOpen();
            }}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Eye size={17} />
            View complete profile
          </button>
        </div>
      </div>
    </article>
  );
}

export default function CustomersPage() {
  const navigate =
    useNavigate();

  const [
    customers,
    setCustomers,
  ] = useState([]);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState("all");

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const loadCustomers =
    useCallback(async () => {
      setIsLoading(true);
      setError("");

      try {
        const response =
          await listCustomerProfiles({
            page: 1,
            limit: 100,
            sortBy: "createdAt",
            sortDirection: "desc",
          });

        setCustomers(
          extractCustomers(
            response
          )
        );
      } catch (requestError) {
        setCustomers([]);

        setError(
          requestError?.message ||
            requestError
              ?.response?.data
              ?.message ||
            "Unable to load customer records."
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  function openCustomerProfile(
    customer
  ) {
    const identifier =
      getCustomerIdentifier(
        customer
      );

    if (!identifier) {
      setError(
        "This customer record does not have a valid identifier."
      );

      return;
    }

    navigate(
      `/customers/${encodeURIComponent(
        identifier
      )}`
    );
  }

  const availableStatuses =
    useMemo(() => {
      const statuses =
        customers
          .map((customer) =>
            normaliseStatus(
              customer.status
            )
          )
          .filter(Boolean);

      return [
        "all",
        ...Array.from(
          new Set(statuses)
        ).sort(),
      ];
    }, [customers]);

  const filteredCustomers =
    useMemo(() => {
      const query =
        searchTerm
          .trim()
          .toLowerCase();

      return customers.filter(
        (customer) => {
          const status =
            normaliseStatus(
              customer.status
            );

          const statusMatches =
            selectedStatus ===
              "all" ||
            status ===
              selectedStatus;

          const textMatches =
            !query ||
            [
              getCustomerName(
                customer
              ),
              customer.email,
              customer.phone,
              customer._id,
              customer.id,
              customer.referralCode,
              Array.isArray(
                customer.tags
              )
                ? customer.tags.join(
                    " "
                  )
                : "",
              status,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(query)
            );

          return (
            statusMatches &&
            textMatches
          );
        }
      );
    }, [
      customers,
      searchTerm,
      selectedStatus,
    ]);

  const summary =
    useMemo(() => {
      return customers.reduce(
        (
          totals,
          customer
        ) => {
          const status =
            normaliseStatus(
              customer.status
            );

          totals.total += 1;

          totals.totalSpent +=
            getTotalSpent(
              customer
            );

          if (
            status === "active"
          ) {
            totals.active += 1;
          }

          totals.totalVisits +=
            getVisitCount(
              customer
            );

          return totals;
        },
        {
          total: 0,
          active: 0,
          totalVisits: 0,
          totalSpent: 0,
        }
      );
    }, [customers]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={Users}
            label="Total customers"
            value={summary.total}
            description="All customer records"
          />

          <SummaryCard
            icon={UserRound}
            label="Active customers"
            value={summary.active}
            description="Customers marked active"
          />

          <SummaryCard
            icon={CalendarClock}
            label="Recorded visits"
            value={
              summary.totalVisits
            }
            description="Combined customer visits"
          />

          <SummaryCard
            icon={WalletCards}
            label="Customer value"
            value={formatCurrency(
              summary.totalSpent
            )}
            description="Combined customer spending"
          />
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Customer directory
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Search, create and
                manage complete customer
                profiles.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/customers/new"
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Plus size={17} />
                Add customer
              </button>

              <button
                type="button"
                onClick={() =>
                  void loadCustomers()
                }
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={17}
                  className={
                    isLoading
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh
              </button>
            </div>
          </div>

          <div className="grid gap-3 border-b border-slate-200 p-5 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                placeholder="Search by name, email, phone, tag or referral code"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </div>

            <select
              value={
                selectedStatus
              }
              onChange={(event) =>
                setSelectedStatus(
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium capitalize text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            >
              {availableStatuses.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status === "all"
                      ? "All statuses"
                      : formatStatus(
                          status
                        )}
                  </option>
                )
              )}
            </select>
          </div>

          {error ? (
            <div className="m-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <div>
                <p className="font-semibold">
                  Customers could not
                  be loaded
                </p>

                <p className="mt-1">
                  {error}
                </p>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({
                length: 6,
              }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="h-16 animate-pulse rounded-xl bg-slate-100"
                  />
                )
              )}
            </div>
          ) : filteredCustomers.length >
            0 ? (
            <>
              <div className="hidden overflow-x-auto md:block">
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
                        Total spent
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Last visit
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Status
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredCustomers.map(
                      (customer) => (
                        <CustomerRow
                          key={
                            getCustomerIdentifier(
                              customer
                            ) ||
                            `${customer.email}-${customer.phone}`
                          }
                          customer={
                            customer
                          }
                          onOpen={
                            openCustomerProfile
                          }
                        />
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 p-4 md:hidden">
                {filteredCustomers.map(
                  (customer) => (
                    <CustomerMobileCard
                      key={
                        getCustomerIdentifier(
                          customer
                        ) ||
                        `${customer.email}-${customer.phone}`
                      }
                      customer={
                        customer
                      }
                      onOpen={
                        openCustomerProfile
                      }
                    />
                  )
                )}
              </div>

              <div className="border-t border-slate-200 px-5 py-3 text-sm text-slate-500">
                Showing{" "}
                <span className="font-semibold text-slate-700">
                  {
                    filteredCustomers.length
                  }
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700">
                  {customers.length}
                </span>{" "}
                customers
              </div>
            </>
          ) : (
            <div className="px-6 py-16 text-center">
              <Users
                size={38}
                className="mx-auto text-slate-300"
              />

              <h3 className="mt-4 text-base font-bold text-slate-900">
                No customers found
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                {searchTerm ||
                selectedStatus !==
                  "all"
                  ? "No customers match the selected search and status filters."
                  : "Create the first customer profile to begin building the salon directory."}
              </p>

              {!searchTerm &&
              selectedStatus ===
                "all" ? (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/customers/new"
                    )
                  }
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  <Plus size={17} />
                  Add first customer
                </button>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}