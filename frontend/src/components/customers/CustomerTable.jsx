import React from "react";

export default function CustomerTable({
  customers = [],
  loading = false,
  onView,
  onEdit,
  onArchive,
  onDelete,
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">Loading customers...</p>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">No customers found.</p>
      </div>
    );
  }

  const badgeColor = (status) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700";
      case "archived":
        return "bg-yellow-100 text-yellow-700";
      case "deleted":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">

      <div className="overflow-x-auto">

        <table className="min-w-full">

          <thead className="bg-gray-100">

            <tr>

              <th className="text-left px-6 py-4">Customer</th>

              <th className="text-left px-6 py-4">Phone</th>

              <th className="text-left px-6 py-4">Stylist</th>

              <th className="text-center px-6 py-4">Visits</th>

              <th className="text-center px-6 py-4">Loyalty</th>

              <th className="text-center px-6 py-4">Spent</th>

              <th className="text-center px-6 py-4">Status</th>

              <th className="text-center px-6 py-4">Actions</th>

            </tr>

          </thead>

          <tbody>

            {customers.map((customer) => (

              <tr
                key={customer._id}
                className="border-t hover:bg-gray-50"
              >

                <td className="px-6 py-4">

                  <div className="font-semibold">
                    {customer.firstName} {customer.lastName}
                  </div>

                  <div className="text-sm text-gray-500">
                    {customer.email || "-"}
                  </div>

                </td>

                <td className="px-6 py-4">
                  {customer.phone || "-"}
                </td>

                <td className="px-6 py-4">
                  {customer.preferredStylist
                    ? `${customer.preferredStylist.firstName} ${customer.preferredStylist.lastName}`
                    : "-"}
                </td>

                <td className="text-center px-6 py-4">
                  {customer.visitCount}
                </td>

                <td className="text-center px-6 py-4">
                  {customer.loyaltyPoints}
                </td>

                <td className="text-center px-6 py-4">
                  £{Number(customer.totalSpent || 0).toFixed(2)}
                </td>

                <td className="text-center px-6 py-4">

                  <span
                    className={`px-3 py-1 rounded-full text-sm ${badgeColor(
                      customer.status
                    )}`}
                  >
                    {customer.status}
                  </span>

                </td>

                <td className="text-center px-6 py-4">

                  <div className="flex justify-center gap-2">

                    <button
                      onClick={() => onView(customer)}
                      className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                    >
                      View
                    </button>

                    <button
                      onClick={() => onEdit(customer)}
                      className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => onArchive(customer)}
                      className="px-3 py-1 rounded bg-yellow-500 text-white hover:bg-yellow-600"
                    >
                      Archive
                    </button>

                    <button
                      onClick={() => onDelete(customer)}
                      className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                    >
                      Delete
                    </button>

                  </div>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}