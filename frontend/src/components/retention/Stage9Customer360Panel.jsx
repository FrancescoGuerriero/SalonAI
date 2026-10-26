import { FileEdit, Gift, Loader2, RefreshCw, Sparkles, UserRoundSearch } from "lucide-react";
import { useEffect, useState } from "react";

import {
  createCrmActionDraft,
  getPoint9Customer360,
  listCrmActionDrafts,
  listRetentionOpportunities,
  updateCrmActionDraft,
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
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [channel, setChannel] = useState("in_person");
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectionLoading, setProjectionLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
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

  async function inspect(item) {
    setSelectedOpportunity(item);
    setSelectedCustomerId(String(item.customerId));
    setChannel(item.contactableChannels?.[0] || "in_person");
    setProjectionLoading(true);
    setError("");
    try {
      const [nextProjection, draftResult] = await Promise.all([
        getPoint9Customer360(item.customerId),
        listCrmActionDrafts({ customerId: item.customerId, limit: 20 }),
      ]);
      setProjection(nextProjection);
      setDrafts(Array.isArray(draftResult?.drafts) ? draftResult.drafts : []);
    } catch (requestError) {
      setProjection(null);
      setDrafts([]);
      setError(errorMessage(requestError));
    } finally {
      setProjectionLoading(false);
    }
  }

  async function createDraft() {
    if (!selectedOpportunity?.customerId || !selectedOpportunity?.latestLocationId) return;
    setDraftLoading(true);
    setError("");
    try {
      await createCrmActionDraft({
        customerId: selectedOpportunity.customerId,
        locationId: selectedOpportunity.latestLocationId,
        opportunityType: selectedOpportunity.type,
        channel,
      });
      const result = await listCrmActionDrafts({ customerId: selectedOpportunity.customerId, limit: 20 });
      setDrafts(Array.isArray(result?.drafts) ? result.drafts : []);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setDraftLoading(false);
    }
  }

  async function resolveDraft(draftId, status) {
    setDraftLoading(true);
    setError("");
    try {
      await updateCrmActionDraft(draftId, { status });
      const result = await listCrmActionDrafts({ customerId: selectedCustomerId, limit: 20 });
      setDrafts(Array.isArray(result?.drafts) ? result.drafts : []);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setDraftLoading(false);
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
        <strong>Draft-only:</strong> staff may prepare and review CRM wording, but this workspace has no send or execute endpoint. Draft review never authorises provider delivery.
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
                onClick={() => void inspect(item)}
                className={
                  "block w-full p-3 text-left hover:bg-violet-50 " +
                  (selectedCustomerId === String(item.customerId) && selectedOpportunity?.type === item.type ? "bg-violet-50" : "bg-white")
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

              {selectedOpportunity ? (
                <div className="rounded-xl border border-violet-200 bg-white p-3">
                  <div className="flex items-center gap-2"><FileEdit size={16} className="text-violet-600" /><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Prepare governed draft</p></div>
                  <p className="mt-2 text-sm font-bold text-slate-900">{label(selectedOpportunity.type)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={channel}
                      onChange={(event) => setChannel(event.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      {(selectedOpportunity.contactableChannels || []).map((value) => <option key={value} value={value}>{label(value)}</option>)}
                      <option value="phone">Phone</option>
                      <option value="in_person">In person</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void createDraft()}
                      disabled={draftLoading || !selectedOpportunity.latestLocationId}
                      className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {draftLoading ? "Preparing…" : "Create review draft"}
                    </button>
                  </div>
                  {!selectedOpportunity.latestLocationId ? <p className="mt-2 text-xs text-amber-700">A location-owned retention record is required before a CRM draft can be created.</p> : null}
                </div>
              ) : null}

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

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">CRM action drafts</p>
                <div className="mt-2 space-y-2">
                  {drafts.map((draft) => (
                    <article key={draft._id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-sm text-slate-900">{label(draft.opportunityType)} · {label(draft.channel)}</strong>
                        <span className="text-[11px] font-bold text-slate-500">{label(draft.status)}</span>
                      </div>
                      {draft.subject ? <p className="mt-2 text-xs font-bold text-slate-700">{draft.subject}</p> : null}
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{draft.body}</p>
                      {draft.status === "draft" ? (
                        <div className="mt-2 flex gap-2">
                          <button type="button" disabled={draftLoading} onClick={() => void resolveDraft(draft._id, "reviewed")} className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">Mark reviewed</button>
                          <button type="button" disabled={draftLoading} onClick={() => void resolveDraft(draft._id, "discarded")} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600">Discard</button>
                        </div>
                      ) : null}
                      <p className="mt-2 text-[11px] font-semibold text-slate-500">No send action available · execution authorised: no</p>
                    </article>
                  ))}
                  {!drafts.length ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">No CRM drafts for this customer.</p> : null}
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
