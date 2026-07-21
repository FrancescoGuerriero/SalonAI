import { useEffect, useMemo, useState } from "react";

import StylistCard from "../components/StylistCard";
import StylistForm from "../components/StylistForm";
import stylistService from "../services/stylistService";

export default function AdminStylists() {
  const [stylists, setStylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [selectedStylist, setSelectedStylist] = useState(null);

  async function loadStylists() {
    try {
      setLoading(true);

      const response = await stylistService.getStylists();

      setStylists(response.stylists || response);
    } catch (error) {
      console.error("Unable to load stylists:", error);
      alert("Unable to load stylists.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStylists();
  }, []);

  const filteredStylists = useMemo(() => {
    const query = search.toLowerCase().trim();

    return stylists.filter((stylist) => {
      const fullName =
        `${stylist.firstName} ${stylist.lastName}`.toLowerCase();

      const specialties =
        stylist.specialties?.join(" ").toLowerCase() || "";

      return (
        fullName.includes(query) ||
        specialties.includes(query)
      );
    });
  }, [stylists, search]);

  function handleAddStylist() {
    setSelectedStylist(null);
    setShowForm(true);
  }

  function handleEditStylist(stylist) {
    setSelectedStylist(stylist);
    setShowForm(true);
  }

  function closeModal() {
    setShowForm(false);
    setSelectedStylist(null);
  }

  async function handleSaveStylist(data) {
    try {
      if (selectedStylist) {
        await stylistService.updateStylist(
          selectedStylist._id,
          data
        );
      } else {
        await stylistService.createStylist(data);
      }

      closeModal();

      await loadStylists();
    } catch (error) {
      console.error(
        "Unable to save stylist:",
        error
      );

      throw error;
    }
  }

  async function handleDeleteStylist(stylist) {
    const confirmed = window.confirm(
      `Delete ${stylist.firstName} ${stylist.lastName}?`
    );

    if (!confirmed) return;

    try {
      await stylistService.deleteStylist(
        stylist._id
      );

      await loadStylists();
    } catch (error) {
      console.error(
        "Unable to delete stylist:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Unable to delete stylist."
      );
    }
  }

  async function handleToggleStatus(stylist) {
    try {
      await stylistService.toggleStatus(
        stylist._id
      );

      await loadStylists();
    } catch (error) {
      console.error(
        "Unable to update stylist:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Unable to update stylist."
      );
    }
  }

  return (
    <div className="container py-4">

      <div className="d-flex justify-content-between align-items-center mb-4">

        <div>

          <h2 className="mb-1">
            Stylist Management
          </h2>

          <p className="text-muted mb-0">
            Manage all salon stylists.
          </p>

        </div>

        <button
          className="btn btn-primary"
          onClick={handleAddStylist}
        >
          + Add Stylist
        </button>

      </div>

      <div className="card shadow-sm mb-4">

        <div className="card-body">

          <div className="row g-3">

            <div className="col-md-9">

              <input
                className="form-control"
                placeholder="Search by name or specialty..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />

            </div>

            <div className="col-md-3">

              <button
                className="btn btn-outline-secondary w-100"
                onClick={loadStylists}
              >
                Refresh
              </button>

            </div>

          </div>

        </div>

      </div>

      {loading ? (

        <div className="text-center py-5">

          <div
            className="spinner-border"
            role="status"
          >
            <span className="visually-hidden">
              Loading...
            </span>
          </div>

          <p className="mt-3">
            Loading stylists...
          </p>

        </div>

      ) : filteredStylists.length === 0 ? (

        <div className="alert alert-info">

          No stylists found.

        </div>

      ) : (

        <>
          <div className="mb-3">

            <strong>
              {filteredStylists.length}
            </strong>{" "}
            stylist(s) found

          </div>

          <div className="row">

            {filteredStylists.map((stylist) => (

              <div
                key={stylist._id}
                className="col-lg-4 col-md-6 mb-4"
              >

                <StylistCard
                  stylist={stylist}
                  onEdit={handleEditStylist}
                  onDelete={handleDeleteStylist}
                  onToggleStatus={
                    handleToggleStatus
                  }
                />

              </div>

            ))}

          </div>

        </>

      )}

      <StylistForm
        show={showForm}
        stylist={selectedStylist}
        onClose={closeModal}
        onSave={handleSaveStylist}
      />

    </div>
  );
}