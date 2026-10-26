import { Gift, Loader2, RefreshCw, Sparkles, UserRoundSearch } from "lucide-react";
import { useEffect, useState } from "react";

import {
  getPoint9Customer360,
  listRetentionOpportunities,
} from "../../Services/retentionAutomationService.js";

function label(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function errorMessage(error) {
  return error?.response?.data?.message || error?.message || "Point 9 Customer 360 could not be loaded.";
}

export default function Stage9Customer360Panel() {
  const [opportunities, setOpportunities] = useState([]);
  const [projection, setProjection] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [projectionLoading, setProjectionLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadOpportunities() {
    setLoading(true);
    setError("");
    try {
      const result = await listRetentionOpportunities({ limit: 100 });
      setOpportunities(Array.isArray(result?.opportunities) ? result.opportunities : []);
    } catch (requestError) {
      setOpportunities([]);
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOpportunities();
  }, []);

  async function inspect(customerId) {
    setSelectedCustomerId(String(customerId));
    setProjectionLoading(true);
    setError("");
    try {
      setProjection(await getPoint9Customer360(customerId));
    } catch (requestError) {
      setProjection(null);
      setError(errorMessage(requestError));
    } finally {
      setProjectionLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-point9-customer360="v3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-violet-600">Customer 360 v3</p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">Retention opportunities and salon profile</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Authority-scoped Customer 360 combines the existing CRM projection with salon technical history,
            hair profile, observed rebooking state and deterministic birthday, referral, loyalty and reactivation opportunities.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadOpportunities()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh opportunities
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <strong>Review-only:</strong> these are deterministic CRM opportunities. They create no journey enrolment and send no message until a separately authorised action is taken.
      </div>

      {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 p-3">
            <p className="font-bold text-slate-900">Opportunity queue</p>
            <p className="text-xs text-slate-500">Rebooking · reactivation · birthday · referral · loyalty</p>
          </div>
          <div className="max-h-[460px] overflow-auto divide-y divide-slate-100">
            {opportunities.map((item, index) => (
              <button
                type="button"
                key={`${item.customerId}-${item.type}-${index}`}
                onClick={() => void inspect(item.customerId)}
                className={
                  "block w-full p-3 text-left hover:bg-violet-50 " +
                  (selectedCustomerId === String(item.customerId) ? "bg-violet-50" : "bg-white")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{item.customerName || "Customer"}</p>
                    <p className="mt-1 text-xs text-slate-500">{label(item.retentionState)}</p>
                  </div>
                  <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-bold text-violet-700">{label(item.type)}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">{item.reason}</p>
              </button>
            ))}
            {!opportunities.length && !loading ? <p className="p-8 text-center text-sm text-slate-500">No current retention opportunities.</p> : null}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          {projectionLoading ? (
            <div className="p-12 text-center"><Loader2 className="mx-auto animate-spin text-violet-600" /></div>
          ) : projection ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <UserRoundSearch className="mt-1 text-violet-600" size={20} />
                <div>
                  <p className="text-lg font-bold text-slate-900">
                    {projection.customer?.preferredName || [projection.customer?.firstName, projection.customer?.lastName].filter(Boolean).join(" ") || "Customer"}
                  </p>
                  <p className="text-xs text-slate-500">Location-aware projection v{projection.projection?.version || "3"}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Hair profile</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {[projection.salonProfile?.hairProfile?.hairType, projection.salonProfile?.hairProfile?.currentHairColour, projection.salonProfile?.hairProfile?.texture].filter(Boolean).join(" · ") || "No structured profile yet"}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Technical records</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{projection.technicalHistory?.count || 0}</p>
                </div>
              </div>

              <div className="rounded-xl bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Operational retention</p>
                <p className="mt-1 font-bold text-slate-900">{label(projection.retention?.operational?.retentionState || "not yet derived")}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {projection.retention?.operational?.cadenceDays ? `${projection.retention.operational.cadenceDays}-day observed/default cadence` : "No completed-visit cadence available."}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2"><Sparkles size={16} className="text-violet-600" /><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Review opportunities</p></div>
                <div className="mt-2 space-y-2">
                  {(projection.retention?.opportunities || []).map((item, index) => (
                    <div key={`${item.type}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-center gap-2"><Gift size={14} className="text-violet-600" /><strong className="text-sm text-slate-900">{label(item.type)}</strong></div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{item.reason}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">Execution authorised: no</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-slate-500">Select an opportunity to inspect the authority-aware Customer 360 v3 record.</p>
          )}
        </div>
      </div>
    </section>
  );
}
