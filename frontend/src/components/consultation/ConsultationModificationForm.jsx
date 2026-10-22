import { useEffect, useMemo, useState } from "react";

function idOf(value) {
  return String(value?._id ?? value?.id ?? value ?? "");
}

function labelFor(value) {
  return String(value || "field")
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "Not supplied";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function ConsultationModificationForm({
  consultation,
  busy = false,
  onSubmit,
}) {
  const consultationId = idOf(consultation);
  const fields = useMemo(
    () => Object.keys(consultation?.structuredFeatures || {}).sort(),
    [consultation?.structuredFeatures]
  );
  const [field, setField] = useState("");
  const [correctedValue, setCorrectedValue] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    setField("");
    setCorrectedValue("");
    setReason("");
  }, [consultationId]);

  if (!consultationId || fields.length === 0) return null;

  const previousValue = field
    ? consultation?.structuredFeatures?.[field]
    : null;

  async function submit(event) {
    event.preventDefault();
    const nextValue = correctedValue.trim();
    if (!field || !nextValue || typeof onSubmit !== "function") return;

    await onSubmit({
      field,
      previousValue: previousValue ?? null,
      correctedValue: nextValue,
      reason: reason.trim(),
    });
  }

  return (
    <form
      className="mt-5 grid gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 md:grid-cols-2"
      onSubmit={submit}
    >
      <div className="md:col-span-2">
        <h3 className="text-base font-bold text-stone-900">Approve with a documented modification</h3>
        <p className="mt-1 text-sm text-stone-600">
          Record a reviewer correction as human-review evidence. This does not bypass or rewrite deterministic safety rules; booking readiness is still evaluated separately.
        </p>
      </div>

      <label className="text-sm font-bold text-stone-700">
        Field being corrected
        <select
          className="mt-1 w-full"
          required
          value={field}
          disabled={busy}
          onChange={(event) => {
            setField(event.target.value);
            setCorrectedValue("");
          }}
        >
          <option value="">Choose a consultation field</option>
          {fields.map((key) => (
            <option key={key} value={key}>
              {labelFor(key)}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-bold text-stone-700">
        Current recorded value
        <input
          className="mt-1 w-full"
          value={displayValue(previousValue)}
          disabled
          readOnly
        />
      </label>

      <label className="text-sm font-bold text-stone-700">
        Corrected value
        <input
          className="mt-1 w-full"
          required
          value={correctedValue}
          disabled={busy || !field}
          onChange={(event) => setCorrectedValue(event.target.value)}
        />
      </label>

      <label className="text-sm font-bold text-stone-700">
        Reason for modification
        <input
          className="mt-1 w-full"
          value={reason}
          disabled={busy || !field}
          maxLength={1000}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Optional reviewer rationale"
        />
      </label>

      <div className="md:col-span-2 flex justify-end">
        <button
          type="submit"
          className="app-button app-button-secondary"
          disabled={busy || !field || !correctedValue.trim()}
        >
          Approve with modification
        </button>
      </div>
    </form>
  );
}
