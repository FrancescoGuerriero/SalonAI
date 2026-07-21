import React from "react";

export default function CustomerSearchBar({
  value,
  onChange,
  onAddCustomer,
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">

      <div className="flex flex-col md:flex-row gap-4 justify-between">

        <div className="flex-1">

          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search by name, email or phone..."
            className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />

        </div>

        <button
          onClick={onAddCustomer}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition"
        >
          + Add Customer
        </button>

      </div>

    </div>
  );
}