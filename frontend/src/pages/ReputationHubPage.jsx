import { RefreshCw, Send, Star } from "lucide-react";
import { useEffect, useState } from "react";
import customerExperienceService from "../Services/customerExperienceService.js";
import useAuth from "../hooks/useAuth.js";
import { hasPermission } from "../utils/permissions.js";

export default function ReputationHubPage() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "customer-experience:manage");
  const [data, setData] = useState({ reviews: [], summary: {} });
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    try { setData(await customerExperienceService.getReputationOverview()); }
    catch (requestError) { setError(requestError.response?.data?.message || "Reputation data could not be loaded."); }
  }
  useEffect(() => { void load(); }, []);

  async function update(review, payload, message) {
    setBusy(true); setError(""); setNotice("");
    try { await customerExperienceService.updateReputation(review.id, payload); setNotice(message); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || "Review update failed."); }
    finally { setBusy(false); }
  }

  const summary = data.summary || {};
  return (
    <main className="experience-management-page" id="main-content" tabIndex="-1">
      <header className="app-page-header"><div><div><p className="app-eyebrow">Stage 4 · Reputation</p><h1>Reputation Hub</h1><p className="app-page-description">Moderate verified visit reviews and publish human-approved salon responses.</p></div><button type="button" className="app-button app-button-secondary" onClick={load}><RefreshCw size={17}/>Refresh</button></div></header>
      {error ? <div className="experience-message is-error" role="alert">{error}</div> : null}
      {notice ? <div className="experience-message is-success" role="status">{notice}</div> : null}
      <section className="experience-management-summary">
        <div><Star/><small>Average published rating</small><strong>{Number(summary.averageRating || 0).toFixed(2)}</strong></div>
        <div><Star/><small>Pending moderation</small><strong>{summary.statusCounts?.pending || 0}</strong></div>
        <div><Star/><small>Published</small><strong>{summary.statusCounts?.published || 0}</strong></div>
        <div><Star/><small>Total reviews</small><strong>{summary.total || 0}</strong></div>
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
