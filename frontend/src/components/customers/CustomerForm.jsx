import React, { useEffect, useState } from "react";

const initialState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "prefer_not_to_say",

  hairProfile: {
    hairType: "",
    hairColour: "",
    texture: "",
    scalpCondition: "",
    allergies: [],
  },

  loyaltyPoints: 0,
  notes: "",

  marketing: {
    emailConsent: true,
    smsConsent: false,
  },
};

export default function CustomerForm({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
}) {
  const [form, setForm] = useState(initialState);

  const [allergyText, setAllergyText] = useState("");

  useEffect(() => {
    if (initialData) {
      setForm({
        ...initialState,
        ...initialData,
      });

      setAllergyText(
        initialData.hairProfile?.allergies?.join(", ") || ""
      );
    }
  }, [initialData]);

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleHairChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      hairProfile: {
        ...prev.hairProfile,
        [name]: value,
      },
    }));
  }

  function handleMarketing(e) {
    const { name, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      marketing: {
        ...prev.marketing,
        [name]: checked,
      },
    }));
  }

  function submit(e) {
    e.preventDefault();

    const payload = {
      ...form,

      loyaltyPoints: Number(form.loyaltyPoints),

      hairProfile: {
        ...form.hairProfile,
        allergies: allergyText
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      },
    };

    onSubmit(payload);
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-6"
    >
      <div className="grid grid-cols-2 gap-4">

        <input
          name="firstName"
          value={form.firstName}
          onChange={handleChange}
          placeholder="First Name"
          className="border rounded p-3"
          required
        />

        <input
          name="lastName"
          value={form.lastName}
          onChange={handleChange}
          placeholder="Last Name"
          className="border rounded p-3"
          required
        />

        <input
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Email"
          className="border rounded p-3"
        />

        <input
          name="phone"
          value={form.phone}
          onChange={handleChange}
          placeholder="Phone"
          className="border rounded p-3"
        />

        <input
          type="date"
          name="dateOfBirth"
          value={form.dateOfBirth || ""}
          onChange={handleChange}
          className="border rounded p-3"
        />

        <select
          name="gender"
          value={form.gender}
          onChange={handleChange}
          className="border rounded p-3"
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
          <option value="prefer_not_to_say">
            Prefer not to say
          </option>
        </select>

      </div>

      <hr />

      <h3 className="text-lg font-semibold">
        Hair Profile
      </h3>

      <div className="grid grid-cols-2 gap-4">

        <input
          name="hairType"
          value={form.hairProfile.hairType}
          onChange={handleHairChange}
          placeholder="Hair Type"
          className="border rounded p-3"
        />

        <input
          name="hairColour"
          value={form.hairProfile.hairColour}
          onChange={handleHairChange}
          placeholder="Hair Colour"
          className="border rounded p-3"
        />

        <input
          name="texture"
          value={form.hairProfile.texture}
          onChange={handleHairChange}
          placeholder="Texture"
          className="border rounded p-3"
        />

        <input
          name="scalpCondition"
          value={form.hairProfile.scalpCondition}
          onChange={handleHairChange}
          placeholder="Scalp Condition"
          className="border rounded p-3"
        />

      </div>

      <textarea
        value={allergyText}
        onChange={(e) => setAllergyText(e.target.value)}
        placeholder="Allergies (comma separated)"
        className="border rounded p-3 w-full"
      />

      <textarea
        name="notes"
        value={form.notes}
        onChange={handleChange}
        placeholder="Customer Notes"
        className="border rounded p-3 w-full"
        rows={5}
      />

      <div className="grid grid-cols-2 gap-4">

        <input
          type="number"
          name="loyaltyPoints"
          value={form.loyaltyPoints}
          onChange={handleChange}
          placeholder="Loyalty Points"
          className="border rounded p-3"
        />

      </div>

      <div className="space-y-2">

        <label className="flex gap-2 items-center">

          <input
            type="checkbox"
            name="emailConsent"
            checked={form.marketing.emailConsent}
            onChange={handleMarketing}
          />

          Email Marketing

        </label>

        <label className="flex gap-2 items-center">

          <input
            type="checkbox"
            name="smsConsent"
            checked={form.marketing.smsConsent}
            onChange={handleMarketing}
          />

          SMS Marketing

        </label>

      </div>

      <div className="flex justify-end gap-3">

        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2 rounded bg-gray-300"
        >
          Cancel
        </button>

        <button
          disabled={loading}
          className="px-5 py-2 rounded bg-blue-600 text-white"
        >
          {loading ? "Saving..." : "Save Customer"}
        </button>

      </div>

    </form>
  );
}