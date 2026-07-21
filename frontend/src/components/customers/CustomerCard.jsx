import React from "react";

export default function CustomerCard({
  customer,
  onEdit,
  onDelete,
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4 border hover:shadow-lg transition">

      <div className="flex justify-between items-start">

        <div>

          <h3 className="text-lg font-semibold">
            {customer.firstName} {customer.lastName}
          </h3>

          <p className="text-gray-500">
            {customer.email || "No email"}
          </p>

          <p className="text-gray-500">
            {customer.phone || "No phone"}
          </p>

        </div>

        <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm">
          {customer.status}
        </span>

      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">

        <div>
          <strong>Visits</strong>
          <br />
          {customer.visitCount}
        </div>

        <div>
          <strong>Loyalty</strong>
          <br />
          {customer.loyaltyPoints}
        </div>

        <div>
          <strong>Spent</strong>
          <br />
          £{customer.totalSpent}
        </div>

        <div>
          <strong>Stylist</strong>
          <br />
          {customer.preferredStylist
            ? `${customer.preferredStylist.firstName} ${customer.preferredStylist.lastName}`
            : "-"}
        </div>

      </div>

      <div className="mt-5 flex gap-2">

        <button
          onClick={() => onEdit(customer)}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2"
        >
          Edit
        </button>

        <button
          onClick={() => onDelete(customer)}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded px-3 py-2"
        >
          Delete
        </button>

      </div>

    </div>
  );
}