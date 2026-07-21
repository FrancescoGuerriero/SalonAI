import {
  useCallback,
  useEffect,
  useState
} from "react";

import serviceService from "../services/serviceService.js";

const initialForm = {
  name: "",
  category: "",
  description: "",
  price: "",
  duration: "",
  active: true
};

function AdminServices() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data =
        await serviceService.getServices();

      setServices(data);
    } catch (requestError) {
      console.error(
        "Unable to load services:",
        requestError
      );

      setError(
        requestError.response?.data?.message ||
          "Unable to load services."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  function handleChange(event) {
    const {
      name,
      value,
      type,
      checked
    } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]:
        type === "checkbox"
          ? checked
          : value
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  function handleEdit(service) {
    setEditingId(service._id);

    setForm({
      name: service.name ?? "",
      category: service.category ?? "",
      description: service.description ?? "",
      price: service.price ?? "",
      duration: service.duration ?? "",
      active: service.active ?? true
    });

    setError("");
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (
      !form.name.trim() ||
      form.price === "" ||
      form.duration === ""
    ) {
      setError(
        "Name, price and duration are required."
      );
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      description:
        form.description.trim(),
      price: Number(form.price),
      duration: Number(form.duration),
      active: form.active
    };

    try {
      setSaving(true);

      if (editingId) {
        await serviceService.updateService(
          editingId,
          payload
        );

        setMessage(
          "Service updated successfully."
        );
      } else {
        await serviceService.createService(
          payload
        );

        setMessage(
          "Service created successfully."
        );
      }

      resetForm();
      await loadServices();
    } catch (requestError) {
      console.error(
        "Unable to save service:",
        requestError
      );

      setError(
        requestError.response?.data?.message ||
          "Unable to save the service."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(serviceId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this service?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");

      await serviceService.deleteService(
        serviceId
      );

      setMessage(
        "Service deleted successfully."
      );

      if (editingId === serviceId) {
        resetForm();
      }

      await loadServices();
    } catch (requestError) {
      console.error(
        "Unable to delete service:",
        requestError
      );

      setError(
        requestError.response?.data?.message ||
          "Unable to delete the service."
      );
    }
  }

  return (
    <section className="admin-page">
      <header>
        <h1>Service Management</h1>

        <p>
          Add, update and remove salon
          services.
        </p>
      </header>

      {error && (
        <p className="error-message">
          {error}
        </p>
      )}

      {message && (
        <p className="success-message">
          {message}
        </p>
      )}

      <form
        className="admin-form"
        onSubmit={handleSubmit}
      >
        <input
          name="name"
          type="text"
          placeholder="Service name"
          value={form.name}
          onChange={handleChange}
          required
        />

        <input
          name="category"
          type="text"
          placeholder="Category"
          value={form.category}
          onChange={handleChange}
        />

        <input
          name="price"
          type="number"
          min="0"
          step="0.01"
          placeholder="Price"
          value={form.price}
          onChange={handleChange}
          required
        />

        <input
          name="duration"
          type="number"
          min="1"
          placeholder="Duration in minutes"
          value={form.duration}
          onChange={handleChange}
          required
        />

        <textarea
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={handleChange}
          rows="3"
        />

        <label>
          <input
            name="active"
            type="checkbox"
            checked={form.active}
            onChange={handleChange}
          />

          Active
        </label>

        <div>
          <button
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Update Service"
                : "Add Service"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p>Loading services...</p>
      ) : services.length === 0 ? (
        <p>
          No services are currently
          available.
        </p>
      ) : (
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {services.map((service) => (
                <tr key={service._id}>
                  <td>{service.name}</td>

                  <td>
                    {service.category ||
                      "—"}
                  </td>

                  <td>
                    £
                    {Number(
                      service.price
                    ).toFixed(2)}
                  </td>

                  <td>
                    {service.duration} minutes
                  </td>

                  <td>
                    {service.active
                      ? "Active"
                      : "Inactive"}
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        handleEdit(service)
                      }
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(
                          service._id
                        )
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default AdminServices;