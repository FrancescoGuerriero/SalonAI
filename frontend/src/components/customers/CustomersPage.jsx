import React, { useEffect, useState } from "react";

import {
  getCustomers,
  createCustomer,
  updateCustomer,
  archiveCustomer,
  deleteCustomer,
} from "../services/customerApi";

import CustomerTable from "../components/customers/CustomerTable";
import CustomerSearchBar from "../components/customers/CustomerSearchBar";
import CustomerForm from "../components/customers/CustomerForm";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  async function loadCustomers() {
    try {
      setLoading(true);

      const response = await getCustomers({
        search,
      });

      setCustomers(response.data.customers || []);
    } catch (err) {
      console.error(err);
      alert("Unable to load customers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, [search]);

  async function saveCustomer(customer) {
    try {
      if (selectedCustomer) {
        await updateCustomer(selectedCustomer._id, customer);
      } else {
        await createCustomer(customer);
      }

      setShowForm(false);
      setSelectedCustomer(null);

      loadCustomers();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Unable to save customer.");
    }
  }

  async function archive(customer) {
    if (!window.confirm("Archive this customer?")) return;

    try {
      await archiveCustomer(customer._id);
      loadCustomers();
    } catch (err) {
      console.error(err);
    }
  }

  async function remove(customer) {
    if (!window.confirm("Delete this customer?")) return;

    try {
      await deleteCustomer(customer._id);
      loadCustomers();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        Customer Management
      </h1>

      <CustomerSearchBar
        value={search}
        onChange={setSearch}
        onAddCustomer={() => {
          setSelectedCustomer(null);
          setShowForm(true);
        }}
      />

      <CustomerTable
        customers={customers}
        loading={loading}
        onView={(customer) => {
          console.log(customer);
        }}
        onEdit={(customer) => {
          setSelectedCustomer(customer);
          setShowForm(true);
        }}
        onArchive={archive}
        onDelete={remove}
      />

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">

          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">

            <div className="flex justify-between items-center mb-6">

              <h2 className="text-2xl font-bold">
                {selectedCustomer
                  ? "Edit Customer"
                  : "New Customer"}
              </h2>

              <button
                onClick={() => {
                  setShowForm(false);
                  setSelectedCustomer(null);
                }}
                className="text-gray-500 hover:text-black text-xl"
              >
                ✕
              </button>

            </div>

            <CustomerForm
              initialData={selectedCustomer}
              onSubmit={saveCustomer}
              onCancel={() => {
                setShowForm(false);
                setSelectedCustomer(null);
              }}
            />

          </div>

        </div>
      )}

    </div>
  );
}