import { useEffect, useMemo, useState } from "react";

import consultationService from "../../Services/consultationService.js";

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
  const [declining, setDeclining] = useState(false);
  const [declineError, setDeclineError] = useState("");

  useEffect(() => {
    setField("");
    setCorrectedValue("");
    setReason("");
    setDeclineError("");
  }, [consultationId]);

  if (!consultationId) return null;

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

  async function declineConsultation() {
    if (busy || declining) return;
    setDeclineError("");
    setDeclining(true);
    try {
      await consultationService.reviewConsultation(consultationId, {
        decision: "declined",
        notes: "Declined by an authorised human reviewer.",
      });
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (error) {
      setDeclineError(
        error?.response?.data?.message ||
          "The consultation could not be declined."
      );
    } finally {
      setDeclining(false);
    }
  }

  return (
    <section className="mt-5 grid gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 md:grid-cols-2">
      {fields.length > 0 ? (
        <form className="contents" onSubmit={submit}>
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
              disabled={busy || declining}
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
              disabled={busy || declining || !field}
              onChange={(event) => setCorrectedValue(event.target.value)}
            />
          </label>

          <label className="text-sm font-bold text-stone-700">
            Reason for modification
            <input
              className="mt-1 w-full"
              value={reason}
              disabled={busy || declining || !field}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Optional reviewer rationale"
            />
          </label>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="app-button app-button-secondary"
              disabled={busy || declining || !field || !correctedValue.trim()}
            >
              Approve with modification
            </button>
          </div>
        </form>
      ) : null}

      <div className="md:col-span-2 border-t border-stone-200 pt-4">
        <h3 className="text-base font-bold text-stone-900">Decline consultation</h3>
        <p className="mt-1 text-sm text-stone-600">
          Use this only when an authorised human reviewer determines that this consultation should be closed rather than approved, modified, or returned for more information.
        </p>
        {declineError ? (
          <div className="experience-message is-error mt-3" role="alert">
            {declineError}
          </div>
        ) : null}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="app-button app-button-secondary"
            disabled={busy || declining}
            onClick={declineConsultation}
          >
            {declining ? "Declining…" : "Decline consultation"}
          </button>
        </div>
      </div>
    </section>
  );
}
