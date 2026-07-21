import React, { useEffect, useState } from "react";

const initialState = {
  customer: "",
  stylist: "",
  service: "",
  startTime: "",
  endTime: "",
  status: "booked",
  notes: "",
};

export default function AppointmentModal({
  open,
  appointment = null,
  customers = [],
  stylists = [],
  services = [],
  loading = false,
  onSave,
  onClose,
}) {
  const [form, setForm] = useState(initialState);

  useEffect(() => {
    if (!appointment) {
      setForm(initialState);
      return;
    }

    setForm({
      customer: appointment.customer?._id || "",
      stylist: appointment.stylist?._id || "",
      service: appointment.service?._id || "",
      startTime: appointment.startTime
        ? appointment.startTime.slice(0, 16)
        : "",
      endTime: appointment.endTime
        ? appointment.endTime.slice(0, 16)
        : "",
      status: appointment.status || "booked",
      notes: appointment.notes || "",
    });
  }, [appointment]);

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function submit(e) {
    e.preventDefault();
    onSave(form);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">

      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">

        <div className="border-b p-5 flex justify-between">

          <h2 className="text-xl font-bold">
            {appointment ? "Edit Appointment" : "New Appointment"}
          </h2>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black text-xl"
          >
            ✕
          </button>

        </div>

        <form
          onSubmit={submit}
          className="p-6 space-y-5"
        >

          <select
            name="customer"
            value={form.customer}
            onChange={handleChange}
            className="w-full border rounded p-3"
            required
          >
            <option value="">Select Customer</option>

            {customers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.firstName} {c.lastName}
              </option>
            ))}

          </select>

          <select
            name="stylist"
            value={form.stylist}
            onChange={handleChange}
            className="w-full border rounded p-3"
            required
          >
            <option value="">Select Stylist</option>

            {stylists.map((s) => (
              <option key={s._id} value={s._id}>
                {s.firstName} {s.lastName}
              </option>
            ))}

          </select>

          <select
            name="service"
            value={form.service}
            onChange={handleChange}
            className="w-full border rounded p-3"
            required
          >
            <option value="">Select Service</option>

            {services.map((service) => (
              <option
                key={service._id}
                value={service._id}
              >
                {service.name}
              </option>
            ))}

          </select>

          <div className="grid grid-cols-2 gap-4">

            <div>

              <label className="block mb-1 text-sm font-medium">
                Start
              </label>

              <input
                type="datetime-local"
                name="startTime"
                value={form.startTime}
                onChange={handleChange}
                className="w-full border rounded p-3"
                required
              />

            </div>

            <div>

              <label className="block mb-1 text-sm font-medium">
                End
              </label>

              <input
                type="datetime-local"
                name="endTime"
                value={form.endTime}
                onChange={handleChange}
                className="w-full border rounded p-3"
                required
              />

            </div>

          </div>

          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="w-full border rounded p-3"
          >
            <option value="booked">Booked</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked-in">Checked In</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no-show">No Show</option>
          </select>

          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={4}
            className="w-full border rounded p-3"
            placeholder="Appointment notes..."
          />

          <div className="flex justify-end gap-3">

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded bg-gray-200"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Appointment"}
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}