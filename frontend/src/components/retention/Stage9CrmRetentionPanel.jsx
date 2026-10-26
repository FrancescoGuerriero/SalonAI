import { Clock3, FlaskConical, Loader2, Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  createClientTechnicalRecord,
  listClientTechnicalRecords,
  listRetentionQueue,
} from "../../Services/retentionAutomationService.js";

function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "CRM retention operations could not be loaded."
  );
}

function date(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(parsed);
}

function label(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const FILTERS = ["", "dormant", "overdue", "due", "approaching_due", "booked"];

const EMPTY_TECHNICAL_FORM = {
  recordType: "general",
  technicalNotes: "",
  resultNotes: "",
  brand: "",
  shade: "",
  developer: "",
  ratio: "",
};

export default function Stage9CrmRetentionPanel() {
  const [filter, setFilter] = useState("");
  const [queue, setQueue] = useState([]);
  const [queueMeta, setQueueMeta] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedRetention, setSelectedRetention] = useState(null);
  const [technicalRecords, setTechnicalRecords] = useState([]);
  const [technicalForm, setTechnicalForm] = useState(EMPTY_TECHNICAL_FORM);
  const [loading, setLoading] = useState(true);
  const [technicalLoading, setTechnicalLoading] = useState(false);
  const [technicalSaving, setTechnicalSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadQueue(nextFilter = filter) {
    setLoading(true);
    setError("");
    try {
      const result = await listRetentionQueue({ limit: 250, state: nextFilter });
      setQueue(Array.isArray(result?.queue) ? result.queue : []);
      setQueueMeta(result || null);
    } catch (requestError) {
      setQueue([]);
      setQueueMeta(null);
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue(filter);
  }, [filter]);

  async function inspectTechnicalHistory(item) {
    setSelectedRetention(item);
    setSelectedCustomerId(String(item.customerId));
    setTechnicalLoading(true);
    setError("");
    try {
      const result = await listClientTechnicalRecords(item.customerId, { limit: 100 });
      setTechnicalRecords(Array.isArray(result?.records) ? result.records : []);
    } catch (requestError) {
      setTechnicalRecords([]);
      setError(errorMessage(requestError));
    } finally {
      setTechnicalLoading(false);
    }
  }

  async function saveTechnicalRecord(event) {
    event.preventDefault();
    if (!selectedCustomerId || !selectedRetention?.latestLocationId) return;
    setTechnicalSaving(true);
    setError("");
    try {
      const formula = [technicalForm.brand, technicalForm.shade, technicalForm.developer, technicalForm.ratio].some(Boolean)
        ? [{
            brand: technicalForm.brand,
            shade: technicalForm.shade,
            developer: technicalForm.developer,
            ratio: technicalForm.ratio,
          }]
        : [];
      await createClientTechnicalRecord(selectedCustomerId, {
        locationId: selectedRetention.latestLocationId,
        recordType: technicalForm.recordType,
        technicalNotes: technicalForm.technicalNotes,
        resultNotes: technicalForm.resultNotes,
        formula,
        source: "manual",
      });
      setTechnicalForm(EMPTY_TECHNICAL_FORM);
      const result = await listClientTechnicalRecords(selectedCustomerId, { limit: 100 });
      setTechnicalRecords(Array.isArray(result?.records) ? result.records : []);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setTechnicalSaving(false);
    }
  }

  const counts = useMemo(() => {
    const result = {};
    for (const item of queue) {
      result[item.retentionState] = (result[item.retentionState] || 0) + 1;
    }
    return result;
  }, [queue]);

  return (
    <section
      data-point9-workspace="crm-retention"
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-violet-600">
            Point 9 · Original Phase 11
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            CRM retention and salon technical history
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Location-owned rebooking evidence and salon technical service records sit on
            top of the canonical business-level Customer identity. This workspace is
            deterministic and does not authorise outbound retention messaging.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadQueue(filter)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh retention
        </button>
      </div>

      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
        <strong>Retention rule:</strong> cadence is derived from the median interval between
        recent completed visits. The original Phase 11 56-day rebooking interval is used
        only when there is insufficient visit history. No message is sent automatically.
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <button
            type="button"
            key={value || "all"}
            onClick={() => setFilter(value)}
            className={
              "rounded-full px-3 py-1.5 text-xs font-bold " +
              (filter === value
                ? "bg-violet-600 text-white"
                : "border border-slate-200 bg-slate-50 text-slate-700")
            }
          >
            {value ? label(value) : "All retention states"}
            {value && counts[value] ? ` (${counts[value]})` : ""}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.65fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200">
          <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
            <div>
              <h3 className="font-bold text-slate-900">Rebooking and dormant-client queue</h3>
              <p className="mt-1 text-xs text-slate-500">
                {queueMeta?.totalMatched ?? queue.length} matching customers · location authority enforced
              </p>
            </div>
            <Clock3 size={18} className="text-violet-600" />
          </header>
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Cadence</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queue.map((item) => (
                  <tr key={item.customerId} className={selectedCustomerId === String(item.customerId) ? "bg-violet-50/60" : "bg-white"}>
                    <td className="px-4 py-3">
                      <strong className="text-slate-900">{item.customer?.name || "Customer"}</strong>
                      <div className="mt-1 text-xs text-slate-500">
                        Last visit {date(item.lastVisit)} · {item.daysSinceLastVisit ?? "—"} days ago
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                        {label(item.retentionState)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.cadenceDays} days
                      <div className="text-[11px] text-slate-500">{label(item.cadenceSource)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.nextAppointment ? `Booked ${date(item.nextAppointment)}` : date(item.dueAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void inspectTechnicalHistory(item)}
                        className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-700"
                      >
                        Technical history
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!queue.length && !loading ? (
              <p className="p-8 text-center text-sm text-slate-500">No customers match this retention state.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Salon technical history</h3>
              <p className="mt-1 text-xs text-slate-500">Colour, chemical, treatment, cut and consultation evidence.</p>
            </div>
            <FlaskConical size={18} className="text-violet-600" />
          </div>

          {technicalLoading ? (
            <div className="p-12 text-center"><Loader2 className="mx-auto animate-spin text-violet-600" /></div>
          ) : selectedCustomerId ? (
            <div className="mt-4 space-y-4">
              <form onSubmit={saveTechnicalRecord} className="space-y-3 rounded-xl border border-violet-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <Plus size={15} className="text-violet-600" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Add technical record</p>
                </div>
                <select
                  value={technicalForm.recordType}
                  onChange={(event) => setTechnicalForm((current) => ({ ...current, recordType: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {['general', 'colour', 'chemical', 'treatment', 'cut', 'consultation'].map((value) => <option key={value} value={value}>{label(value)}</option>)}
                </select>
                <textarea
                  value={technicalForm.technicalNotes}
                  onChange={(event) => setTechnicalForm((current) => ({ ...current, technicalNotes: event.target.value }))}
                  rows={3}
                  placeholder="Technical notes"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea
                  value={technicalForm.resultNotes}
                  onChange={(event) => setTechnicalForm((current) => ({ ...current, resultNotes: event.target.value }))}
                  rows={2}
                  placeholder="Result / finish notes"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                {technicalForm.recordType === "colour" || technicalForm.recordType === "chemical" ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["brand", "Brand"],
                      ["shade", "Shade"],
                      ["developer", "Developer"],
                      ["ratio", "Ratio"],
                    ].map(([field, placeholder]) => (
                      <input
                        key={field}
                        value={technicalForm[field]}
                        onChange={(event) => setTechnicalForm((current) => ({ ...current, [field]: event.target.value }))}
                        placeholder={placeholder}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    ))}
                  </div>
                ) : null}
                <button
                  type="submit"
                  disabled={technicalSaving || !selectedRetention?.latestLocationId}
                  className="w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {technicalSaving ? "Saving…" : "Save location-owned technical record"}
                </button>
                {!selectedRetention?.latestLocationId ? <p className="text-xs text-amber-700">A trusted location is required before a technical record can be created.</p> : null}
              </form>

              {technicalRecords.map((record) => (
                <article key={record._id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{label(record.recordType)}</p>
                      <p className="text-xs text-slate-500">{date(record.occurredAt)} · {record.location?.name || "Location"}</p>
                    </div>
                    <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700">
                      {record.formula?.length || 0} formula items
                    </span>
                  </div>
                  {record.technicalNotes ? <p className="mt-2 text-sm leading-5 text-slate-700">{record.technicalNotes}</p> : null}
                  {record.formula?.length ? (
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      {record.formula.map((item, index) => (
                        <p key={`${record._id}-formula-${index}`}>
                          {[item.brand, item.line, item.shade, item.developer, item.ratio].filter(Boolean).join(" · ")}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {record.patchTest?.result ? (
                    <p className="mt-2 text-xs font-semibold text-slate-600">Patch test: {label(record.patchTest.result)}</p>
                  ) : null}
                  {record.photos?.length ? (
                    <p className="mt-2 text-xs font-semibold text-slate-600">{record.photos.length} client service photo(s) recorded</p>
                  ) : null}
                </article>
              ))}
              {!technicalRecords.length ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                  No location-owned technical records have been recorded for this customer yet.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              Select a customer from the retention queue to inspect or author salon technical history.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
