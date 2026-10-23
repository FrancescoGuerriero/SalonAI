import { RefreshCw, RotateCcw, Send, Star } from "lucide-react";
import { useEffect, useState } from "react";
import customerExperienceService from "../Services/customerExperienceService.js";
import useAuth from "../hooks/useAuth.js";
import { hasPermission } from "../utils/permissions.js";

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

export default function ReputationHubPage() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "customer-experience:manage");
  const [data, setData] = useState({ reviews: [], summary: {} });
  const [recovery, setRecovery] = useState({ counts: {} });
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    try {
      const [reputationResult, recoveryResult] = await Promise.all([
        customerExperienceService.getReputationOverview(),
        customerExperienceService.getBookingRecoveryMetrics(),
      ]);
      setData(reputationResult);
      setRecovery(recoveryResult.metrics || { counts: {} });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Customer experience measurement could not be loaded.");
    }
  }
  useEffect(() => { void load(); }, []);

  async function update(review, payload, message) {
    setBusy(true); setError(""); setNotice("");
    try { await customerExperienceService.updateReputation(review.id, payload); setNotice(message); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || "Review update failed."); }
    finally { setBusy(false); }
  }

  const summary = data.summary || {};
  const recoveryCounts = recovery.counts || {};
  return (
    <main className="experience-management-page" id="main-content" tabIndex="-1">
      <header className="app-page-header"><div><div><p className="app-eyebrow">Stage 4 · Reputation and recovery</p><h1>Reputation Hub</h1><p className="app-page-description">Moderate verified visit reviews, publish human-approved salon responses and measure abandoned-booking recovery end to end.</p></div><button type="button" className="app-button app-button-secondary" onClick={load}><RefreshCw size={17}/>Refresh</button></div></header>
      {error ? <div className="experience-message is-error" role="alert">{error}</div> : null}
      {notice ? <div className="experience-message is-success" role="status">{notice}</div> : null}
      <section className="experience-management-summary">
        <div><Star/><small>Average published rating</small><strong>{Number(summary.averageRating || 0).toFixed(2)}</strong></div>
        <div><Star/><small>Pending moderation</small><strong>{summary.statusCounts?.pending || 0}</strong></div>
        <div><Star/><small>Published</small><strong>{summary.statusCounts?.published || 0}</strong></div>
        <div><Star/><small>Total reviews</small><strong>{summary.total || 0}</strong></div>
      </section>

      <section className="experience-management-panel">
        <header><span><RotateCcw size={20}/></span><div><h2>Abandoned booking recovery</h2><p>Operational measurement follows the persisted abandoned journey from abandonment through resume and completed booking attribution.</p></div><b>{recovery.abandonedCohort || 0}</b></header>
        <div className="experience-management-summary">
          <div><RotateCcw/><small>Currently abandoned</small><strong>{recoveryCounts.abandoned || 0}</strong></div>
          <div><RotateCcw/><small>Resumed</small><strong>{recovery.resumed || 0}</strong></div>
          <div><RotateCcw/><small>Converted</small><strong>{recoveryCounts.converted || 0}</strong></div>
          <div><RotateCcw/><small>Resume / conversion</small><strong>{percent(recovery.resumeRate)} / {percent(recovery.conversionRate)}</strong></div>
        </div>
      </section>

      <section className="experience-management-panel">
        <header><span><Star size={20}/></span><div><h2>Verified review workflow</h2><p>Review publication and salon responses remain explicitly controlled by authorised staff.</p></div><b>{data.reviews?.length || 0}</b></header>
        <div className="experience-management-list">
          {(data.reviews || []).map((review) => {
            const responseText = drafts[review.id] ?? review.businessResponse?.responseText ?? "";
            return <article key={review.id}><div><small>{review.customer?.name || review.customer?.email || "Customer"} · {review.rating}/5 · {review.status}</small><strong>{review.title || review.appointment?.service?.name || "Verified visit review"}</strong><p>{review.comment}</p><textarea aria-label={`Response to ${review.title || "review"}`} rows="3" disabled={!canManage || busy} value={responseText} onChange={(event)=>setDrafts({...drafts,[review.id]:event.target.value})} placeholder="Write a human-reviewed salon response"/></div><div>{review.status!=="published"?<button disabled={!canManage||busy} className="app-button app-button-secondary app-button-sm" onClick={()=>update(review,{status:"published",responseText,responseStatus:responseText?"draft":"none"},"Review published.")}>Publish review</button>:null}<button disabled={!canManage||busy||review.status!=="published"||!responseText.trim()} className="app-button app-button-primary app-button-sm" onClick={()=>update(review,{status:"published",responseText,responseStatus:"published"},"Salon response published.")}><Send size={15}/>Publish response</button></div></article>;
          })}
        </div>
      </section>
    </main>
  );
}
