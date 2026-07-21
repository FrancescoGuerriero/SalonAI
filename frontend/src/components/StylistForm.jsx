import { useEffect, useMemo, useState } from "react";

const emptyStylist = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  biography: "",
  yearsExperience: 0,
  specialties: "",
  languages: "",
  instagram: "",
  facebook: "",
  website: "",
  profileImage: "",
  isActive: true,
};

function normaliseList(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value || "";
}

export default function StylistForm({
  stylist,
  show,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(emptyStylist);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const isEditMode = Boolean(stylist?._id);

  useEffect(() => {
    if (!show) {
      return;
    }

    if (stylist) {
      setForm({
        firstName: stylist.firstName || "",
        lastName: stylist.lastName || "",
        email: stylist.email || "",
        phone: stylist.phone || "",
        biography: stylist.biography || "",
        yearsExperience:
          Number(stylist.yearsExperience) || 0,
        specialties: normaliseList(
          stylist.specialties
        ),
        languages: normaliseList(stylist.languages),
        instagram: stylist.instagram || "",
        facebook: stylist.facebook || "",
        website: stylist.website || "",
        profileImage: stylist.profileImage || "",
        isActive:
          typeof stylist.isActive === "boolean"
            ? stylist.isActive
            : true,
      });
    } else {
      setForm(emptyStylist);
    }

    setFormError("");
    setSubmitting(false);
  }, [show, stylist]);

  const title = useMemo(
    () => (isEditMode ? "Edit Stylist" : "Add Stylist"),
    [isEditMode]
  );

  function handleChange(event) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]:
        type === "checkbox" ? checked : value,
    }));
  }

  function createPayload() {
    return {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      biography: form.biography.trim(),
      yearsExperience: Math.max(
        0,
        Number(form.yearsExperience) || 0
      ),
      specialties: form.specialties
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      languages: form.languages
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      instagram: form.instagram.trim(),
      facebook: form.facebook.trim(),
      website: form.website.trim(),
      profileImage: form.profileImage.trim(),
      isActive: form.isActive,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setFormError("");

    const payload = createPayload();

    if (!payload.firstName || !payload.lastName) {
      setFormError(
        "First name and last name are required."
      );
      return;
    }

    if (!payload.email) {
      setFormError("Email address is required.");
      return;
    }

    try {
      setSubmitting(true);
      await onSave(payload);
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        "Unable to save the stylist.";

      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleBackdropClick(event) {
    if (
      event.target === event.currentTarget &&
      !submitting
    ) {
      onClose();
    }
  }

  if (!show) {
    return null;
  }

  return (
    <div
      className="modal d-block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stylist-form-title"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      }}
      onMouseDown={handleBackdropClick}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <form onSubmit={handleSubmit}>
            <div className="modal-header">
              <h5
                id="stylist-form-title"
                className="modal-title"
              >
                {title}
              </h5>

              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
                disabled={submitting}
              />
            </div>

            <div className="modal-body">
              {formError && (
                <div
                  className="alert alert-danger"
                  role="alert"
                >
                  {formError}
                </div>
              )}

              <div className="row g-3">
                <div className="col-md-6">
                  <label
                    htmlFor="firstName"
                    className="form-label"
                  >
                    First name
                  </label>

                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    className="form-control"
                    value={form.firstName}
                    onChange={handleChange}
                    maxLength={60}
                    required
                    autoFocus
                  />
                </div>

                <div className="col-md-6">
                  <label
                    htmlFor="lastName"
                    className="form-label"
                  >
                    Last name
                  </label>

                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    className="form-control"
                    value={form.lastName}
                    onChange={handleChange}
                    maxLength={60}
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label
                    htmlFor="email"
                    className="form-label"
                  >
                    Email
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="form-control"
                    value={form.email}
                    onChange={handleChange}
                    maxLength={160}
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label
                    htmlFor="phone"
                    className="form-label"
                  >
                    Phone
                  </label>

                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className="form-control"
                    value={form.phone}
                    onChange={handleChange}
                    maxLength={40}
                  />
                </div>

                <div className="col-12">
                  <label
                    htmlFor="biography"
                    className="form-label"
                  >
                    Biography
                  </label>

                  <textarea
                    id="biography"
                    name="biography"
                    className="form-control"
                    rows={4}
                    value={form.biography}
                    onChange={handleChange}
                    maxLength={1500}
                  />

                  <div className="form-text">
                    {form.biography.length}/1500
                    characters
                  </div>
                </div>

                <div className="col-md-6">
                  <label
                    htmlFor="yearsExperience"
                    className="form-label"
                  >
                    Years of experience
                  </label>

                  <input
                    id="yearsExperience"
                    name="yearsExperience"
                    type="number"
                    min="0"
                    max="80"
                    step="1"
                    className="form-control"
                    value={form.yearsExperience}
                    onChange={handleChange}
                  />
                </div>

                <div className="col-md-6">
                  <label
                    htmlFor="profileImage"
                    className="form-label"
                  >
                    Profile image URL
                  </label>

                  <input
                    id="profileImage"
                    name="profileImage"
                    type="url"
                    className="form-control"
                    value={form.profileImage}
                    onChange={handleChange}
                    placeholder="https://example.com/stylist.jpg"
                  />
                </div>

                <div className="col-md-6">
                  <label
                    htmlFor="specialties"
                    className="form-label"
                  >
                    Specialties
                  </label>

                  <input
                    id="specialties"
                    name="specialties"
                    type="text"
                    className="form-control"
                    value={form.specialties}
                    onChange={handleChange}
                    placeholder="Balayage, barbering, colour"
                  />

                  <div className="form-text">
                    Separate multiple specialties with
                    commas.
                  </div>
                </div>

                <div className="col-md-6">
                  <label
                    htmlFor="languages"
                    className="form-label"
                  >
                    Languages
                  </label>

                  <input
                    id="languages"
                    name="languages"
                    type="text"
                    className="form-control"
                    value={form.languages}
                    onChange={handleChange}
                    placeholder="English, Italian"
                  />

                  <div className="form-text">
                    Separate multiple languages with
                    commas.
                  </div>
                </div>

                <div className="col-md-4">
                  <label
                    htmlFor="instagram"
                    className="form-label"
                  >
                    Instagram
                  </label>

                  <input
                    id="instagram"
                    name="instagram"
                    type="text"
                    className="form-control"
                    value={form.instagram}
                    onChange={handleChange}
                    placeholder="@username"
                  />
                </div>

                <div className="col-md-4">
                  <label
                    htmlFor="facebook"
                    className="form-label"
                  >
                    Facebook
                  </label>

                  <input
                    id="facebook"
                    name="facebook"
                    type="text"
                    className="form-control"
                    value={form.facebook}
                    onChange={handleChange}
                    placeholder="Profile or page URL"
                  />
                </div>

                <div className="col-md-4">
                  <label
                    htmlFor="website"
                    className="form-label"
                  >
                    Website
                  </label>

                  <input
                    id="website"
                    name="website"
                    type="url"
                    className="form-control"
                    value={form.website}
                    onChange={handleChange}
                    placeholder="https://example.com"
                  />
                </div>

                <div className="col-12">
                  <div className="form-check form-switch">
                    <input
                      id="isActive"
                      name="isActive"
                      type="checkbox"
                      className="form-check-input"
                      checked={form.isActive}
                      onChange={handleChange}
                    />

                    <label
                      htmlFor="isActive"
                      className="form-check-label"
                    >
                      Stylist is active and available for
                      bookings
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting && (
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  />
                )}

                {submitting
                  ? "Saving..."
                  : isEditMode
                    ? "Update Stylist"
                    : "Create Stylist"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}