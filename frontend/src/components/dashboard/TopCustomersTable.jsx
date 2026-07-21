import {
  CalendarDays,
  Crown,
  Mail,
  ReceiptPoundSterling,
  UserRound,
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
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
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

export default function TopCustomersTable({
  customers = [],
  loading = false,
}) {
  const normalizedCustomers = Array.isArray(customers)
    ? customers.map((customer, index) => ({
        ...customer,

        customerId:
          customer.customerId ??
          customer._id ??
          `customer-${index}`,

        customerName:
          customer.customerName?.trim() ||
          customer.fullName?.trim() ||
          customer.name?.trim() ||
          "Customer",

        appointments:
          Number(customer.appointments) || 0,

        revenue:
          Number(customer.revenue) || 0,

        averageAppointmentValue:
          Number(customer.averageAppointmentValue) || 0,
      }))
    : [];

  return (
    <Card
      title="Top Customers"
      subtitle="Highest-value customers by revenue"
      actions={
        <div className="flex items-center gap-2 rounded-full bg-yellow-100 px-3 py-1.5 text-sm font-semibold text-yellow-700">
          <Crown size={16} />
          VIP Customers
        </div>
      }
    >
      {loading ? (
        <LoadingRows />
      ) : normalizedCustomers.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <UserRound
              className="text-blue-600"
              size={24}
            />
          </div>

          <h3 className="mt-4 font-semibold text-gray-900">
            No customer ranking available
          </h3>

          <p className="mt-2 max-w-md text-sm text-gray-500">
            Customer revenue and appointment data will appear
            here after completed or paid appointments have been
            recorded.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="text-left">
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Rank
                </th>

                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Customer
                </th>

                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Appointments
                </th>

                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Revenue
                </th>

                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Average Value
                </th>

                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Last Visit
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {normalizedCustomers.map(
                (customer, index) => (
                  <tr
                    key={customer.customerId}
                    className="transition hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-3 py-4">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                          index === 0
                            ? "bg-yellow-100 text-yellow-700"
                            : index === 1
                              ? "bg-gray-200 text-gray-700"
                              : index === 2
                                ? "bg-orange-100 text-orange-700"
                                : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        {index + 1}
                      </div>
                    </td>

                    <td className="px-3 py-4">
                      <div className="flex min-w-56 items-center gap-3">
                        <CustomerAvatar
                          name={customer.customerName}
                        />

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">
                            {customer.customerName}
                          </p>

                          {customer.email ? (
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                              <Mail size={13} />

                              <span className="truncate">
                                {customer.email}
                              </span>
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-gray-400">
                              No email available
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-3 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <CalendarDays
                          className="text-blue-500"
                          size={17}
                        />

                        <span className="font-semibold">
                          {formatNumber(
                            customer.appointments
                          )}
                        </span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-3 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <ReceiptPoundSterling
                          className="text-green-600"
                          size={17}
                        />

                        <span className="font-bold text-gray-900">
                          {formatCurrency(
                            customer.revenue
                          )}
                        </span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-700">
                      {formatCurrency(
                        customer.averageAppointmentValue
                      )}
                    </td>

                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-600">
                      {formatDate(
                        customer.lastAppointmentDate
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}