import {
  CalendarClock,
  Mail,
  Phone,
  RefreshCcw,
  UserRound,
  WalletCards,
} from "lucide-react";

import Card from "../ui/Card";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const numberFormatter = new Intl.NumberFormat("en-GB");

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) {
    return "No visit recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function CustomerAvatar({ name = "Customer" }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">
      {initials || <UserRound size={18} />}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="h-16 animate-pulse rounded-lg bg-gray-100"
        />
      ))}
    </div>
  );
}

function getDormancyStatus(daysSinceLastVisit) {
  const days = Number(daysSinceLastVisit) || 0;

  if (days >= 180) {
    return {
      label: "High risk",
      className: "bg-red-100 text-red-700",
    };
  }

  if (days >= 90) {
    return {
      label: "At risk",
      className: "bg-orange-100 text-orange-700",
    };
  }

  return {
    label: "Inactive",
    className: "bg-yellow-100 text-yellow-700",
  };
}

export default function DormantCustomersTable({
  customers = [],
  loading = false,
  dormantDays = 60,
  onCustomerSelect,
}) {
  const normalizedCustomers = Array.isArray(customers)
    ? customers.map((customer, index) => ({
        ...customer,

        customerId:
          customer.customerId ??
          customer._id ??
          `dormant-customer-${index}`,

        customerName:
          customer.customerName?.trim() ||
          customer.fullName?.trim() ||
          customer.name?.trim() ||
          "Customer",

        daysSinceLastVisit:
          Number(customer.daysSinceLastVisit) || 0,

        totalAppointments:
          Number(customer.totalAppointments) || 0,

        lifetimeValue:
          Number(customer.lifetimeValue) || 0,
      }))
    : [];

  return (
    <Card
      title="Dormant Customers"
      subtitle={`Customers who have not visited in at least ${dormantDays} days`}
      actions={
        <div className="flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1.5 text-sm font-semibold text-orange-700">
          <RefreshCcw size={16} />
          Re-engagement
        </div>
      }
    >
      {loading ? (
        <LoadingRows />
      ) : normalizedCustomers.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <RefreshCcw
              className="text-green-600"
              size={24}
            />
          </div>

          <h3 className="mt-4 font-semibold text-gray-900">
            No dormant customers
          </h3>

          <p className="mt-2 max-w-md text-sm text-gray-500">
            All customers with appointment history have visited
            within the selected dormancy period.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="text-left">
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Customer
                </th>

                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Last Visit
                </th>

                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Inactive For
                </th>

                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Appointments
                </th>

                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Lifetime Value
                </th>

                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>

                {onCustomerSelect ? (
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Action
                  </th>
                ) : null}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {normalizedCustomers.map((customer) => {
                const dormancyStatus = getDormancyStatus(
                  customer.daysSinceLastVisit
                );

                return (
                  <tr
                    key={customer.customerId}
                    className="transition hover:bg-gray-50"
                  >
                    <td className="px-3 py-4">
                      <div className="flex min-w-64 items-center gap-3">
                        <CustomerAvatar
                          name={customer.customerName}
                        />

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">
                            {customer.customerName}
                          </p>

                          <div className="mt-1 flex flex-col gap-1 text-xs text-gray-500">
                            {customer.email ? (
                              <div className="flex items-center gap-1.5">
                                <Mail size={13} />

                                <span className="truncate">
                                  {customer.email}
                                </span>
                              </div>
                            ) : null}

                            {customer.phone ? (
                              <div className="flex items-center gap-1.5">
                                <Phone size={13} />

                                <span>{customer.phone}</span>
                              </div>
                            ) : null}

                            {!customer.email &&
                            !customer.phone ? (
                              <span className="text-gray-400">
                                No contact details available
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-3 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CalendarClock
                          className="text-orange-500"
                          size={17}
                        />

                        <span>
                          {formatDate(
                            customer.lastAppointmentDate
                          )}
                        </span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-3 py-4">
                      <span className="font-semibold text-gray-900">
                        {formatNumber(
                          customer.daysSinceLastVisit
                        )}{" "}
                        days
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-gray-700">
                      {formatNumber(
                        customer.totalAppointments
                      )}
                    </td>

                    <td className="whitespace-nowrap px-3 py-4">
                      <div className="flex items-center gap-2">
                        <WalletCards
                          className="text-green-600"
                          size={17}
                        />

                        <span className="font-bold text-gray-900">
                          {formatCurrency(
                            customer.lifetimeValue
                          )}
                        </span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-3 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${dormancyStatus.className}`}
                      >
                        {dormancyStatus.label}
                      </span>
                    </td>

                    {onCustomerSelect ? (
                      <td className="whitespace-nowrap px-3 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onCustomerSelect(customer)
                          }
                          className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                        >
                          Contact
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}