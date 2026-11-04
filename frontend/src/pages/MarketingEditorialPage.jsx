import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";
import { hasPermission } from "../utils/permissions.js";
import * as api from "../Services/marketingEditorialService.js";
import customerExperienceService from "../Services/customerExperienceService.js";

const steps = { prospect: "draft", draft: "review", review: "approved", approved: "submitted", submitted: "accepted", accepted: "published" };
const monthNow = () => new Date().toISOString().slice(0, 7);
const problem = error => error?.response?.data?.message || error?.message || "Request failed.";
const inputStyle = "mt-1 block w-full rounded-lg border border-stone-300 p-2 text-sm";
const buttonStyle = "rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50";
const card = "rounded-2xl border border-stone-200 bg-white p-5 shadow-sm";

export default function MarketingEditorialPage() {
  const { user } = useAuth();
  const mayReadEditorial = hasPermission(user, "customer-experience:read");
  const mayWriteEditorial = hasPermission(user, "customer-experience:manage");
  const mayReadLinks = hasPermission(user, "reports:read");
  const mayWriteLinks = hasPermission(user, "reports:manage");
  const [section, setSection] = useState("editorial");
  const [month, setMonth] = useState(monthNow);
  const [placements, setPlacements] = useState([]);
  const [articles, setArticles] = useState([]);
  const [links, setLinks] = useState([]);
  const [report, setReport] = useState(null);
  const [draft, setDraft] = useState({ workingTitle: "", publisherName: "", publisherWebsite: "", pitchSummary: "", contentPage: "" });
  const [linkDraft, setLinkDraft] = useState({ sourceUrl: "", targetUrl: "", anchorText: "" });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      mayReadEditorial ? api.listPlacements() : Promise.resolve({ items: [] }),
      mayReadLinks ? api.listBacklinks() : Promise.resolve({ items: [] }),
      mayReadLinks ? api.getMonthlyBacklinks(month) : Promise.resolve({ report: null }),
      mayReadEditorial ? customerExperienceService.listContentPages() : Promise.resolve({ pages: [] }),
    ]);
    if (results[0].status === "fulfilled") setPlacements(results[0].value.items || []);
    if (results[1].status === "fulfilled") setLinks(results[1].value.items || []);
    if (results[2].status === "fulfilled") setReport(results[2].value.report || null);
    if (results[3].status === "fulfilled") setArticles(results[3].value.pages || []);
    setError(results.filter(r => r.status === "rejected").map(r => problem(r.reason)).join(" "));
  }, [month, mayReadEditorial, mayReadLinks]);
  useEffect(() => { void load(); }, [load]);

  async function run(task, success) {
    setWorking(true); setError(""); setNotice("");
    try { await task(); setNotice(success); await load(); }
    catch (e) { setError(problem(e)); }
    finally { setWorking(false); }
  }

  function transition(p) {
    const status = steps[p.status];
    if (!status) return;
    const body = { status };
    if (status === "approved") {
      if (!window.confirm("Have you verified the rights to submit this content and reviewed originality?")) return;
      body.rightsConfirmed = true;
      body.originalityReviewed = true;
    }
    if (status === "published") {
      const url = window.prompt("Provide the article's externally published HTTPS URL. No article will be published by this action.");
      if (!url) return;
      body.publishedUrl = url;
    }
    void run(() => api.transitionPlacement(p._id, body), "Editorial status recorded. No external action was performed.");
  }

  return <main id="main-content" className="min-h-screen bg-stone-50 px-4 py-8" tabIndex="-1">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className={card}>
        <Link className="text-sm underline" to="/marketing">Back to Marketing connections</Link>
        <h1 className="mt-3 text-3xl font-bold">Editorial outreach & backlinks</h1>
        <p className="mt-2 text-sm text-stone-600">Location-scoped publisher prospects, editorial approvals, link observations and monthly reporting.</p>
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Internal records only. This workspace does not send outreach, publish articles, crawl websites or verify submitted links.</p>
        <button className={`${buttonStyle} mt-3`} disabled={working} onClick={() => void load()} type="button">Refresh records</button>
      </header>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      <div className="flex flex-wrap gap-2" aria-label="Editorial workspace sections">
        {[["editorial", "Editorial pipeline"], ["links", "Backlinks"], ["monthly", "Monthly report"]].map(([key, label]) =>
          <button key={key} type="button" aria-pressed={section === key} className={`${buttonStyle} ${section === key ? "bg-stone-950 text-white" : ""}`} onClick={() => setSection(key)}>{label}</button>)}
      </div>
      {section === "editorial" && <section className="space-y-4">
        {mayWriteEditorial && <form className={card} onSubmit={event => {
          event.preventDefault();
          void run(async () => { await api.createPlacement({ ...draft, contentPage: draft.contentPage || undefined }); setDraft({ workingTitle: "", publisherName: "", publisherWebsite: "", pitchSummary: "", contentPage: "" }); }, "Prospect saved; no submission was sent.");
        }}>
          <h2 className="text-lg font-bold">Add publisher prospect</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {[["workingTitle", "Working article title"], ["publisherName", "Publisher name"], ["publisherWebsite", "Publisher HTTPS website"]].map(([key, label]) =>
              <label key={key} className="text-sm font-medium">{label}<input required disabled={working} className={inputStyle} type={key === "publisherWebsite" ? "url" : "text"} value={draft[key]} onChange={e => setDraft(p => ({...p,[key]:e.target.value}))}/></label>)}
            <label className="text-sm font-medium">Existing Content Studio article (optional)<select className={inputStyle} disabled={working} value={draft.contentPage} onChange={e => setDraft(p => ({...p,contentPage:e.target.value}))}><option value="">No linked article</option>{articles.map(article => <option key={article._id} value={article._id}>{article.slug} · {article.status}</option>)}</select></label>
            <label className="text-sm font-medium md:col-span-2">Pitch summary<textarea className={inputStyle} disabled={working} maxLength={3000} rows={3} value={draft.pitchSummary} onChange={e => setDraft(p => ({...p,pitchSummary:e.target.value}))}/></label>
          </div><button className={`${buttonStyle} mt-3`} disabled={working}>Save prospect</button>
        </form>}
        <div className={card}><h2 className="text-lg font-bold">Editorial pipeline</h2>
          {!mayReadEditorial ? <p>Editorial reading permission required.</p> : placements.length === 0 ? <p className="mt-3 text-sm text-stone-600">No publisher prospects recorded.</p> :
          <ul className="mt-3 divide-y">{placements.map(p => <li key={p._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div><strong>{p.workingTitle}</strong><p className="text-sm text-stone-600">{p.publisherName} · {p.status}</p></div>
            {mayWriteEditorial && steps[p.status] && <button type="button" className={buttonStyle} disabled={working} onClick={() => transition(p)}>Move to {steps[p.status]}</button>}
          </li>)}</ul>}
        </div>
      </section>}
      {section === "links" && <section className="space-y-4">
        {mayWriteLinks && <form className={card} onSubmit={event => { event.preventDefault(); void run(async () => {
          await api.addManualBacklink(linkDraft); setLinkDraft({sourceUrl:"",targetUrl:"",anchorText:""});
        }, "Unverified backlink observation recorded."); }}>
          <h2 className="text-lg font-bold">Record unverified backlink</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">{[["sourceUrl", "Source HTTPS URL"], ["targetUrl", "Target HTTPS URL"], ["anchorText", "Anchor text (optional)"]].map(([key,label]) =>
            <label key={key} className="text-sm">{label}<input required={key !== "anchorText"} disabled={working} type={key === "anchorText" ? "text" : "url"} className={inputStyle} value={linkDraft[key]} onChange={e => setLinkDraft(p => ({...p,[key]:e.target.value}))}/></label>)}</div>
          <button className={`${buttonStyle} mt-3`} disabled={working}>Record observation</button>
        </form>}
        <div className={card}><h2 className="text-lg font-bold">Recorded links</h2>
          {!mayReadLinks ? <p>Reporting permission required.</p> : links.length === 0 ? <p className="mt-3 text-sm">No observations recorded.</p> :
          <ul className="mt-3 divide-y">{links.map(link => <li key={link._id} className="py-3 text-sm">
            <strong>{link.sourceHost}</strong> · {link.status}<p className="break-all text-xs text-stone-600">{link.sourceUrl} → {link.targetUrl}</p>
          </li>)}</ul>}
        </div>
      </section>}
      {section === "monthly" && <section className={card}>
        <h2 className="text-lg font-bold">Monthly backlink report</h2>
        <label className="mt-3 block text-sm">UTC reporting month<input type="month" className={`${inputStyle} max-w-xs`} value={month} onChange={e => setMonth(e.target.value)}/></label>
        <p className="mt-3 text-xs text-stone-600">Counts are period observations, not a complete inventory of live links or ranking results.</p>
        {report ? <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
          ["Link observations",report.observedLinks],["Referring domains",report.distinctReferringDomains],
          ["Verified records",report.verifiedLinks],["Published placements",report.publishedPlacements],
        ].map(([label,value]) => <div key={label} className="rounded-xl bg-stone-100 p-4"><dt className="text-sm">{label}</dt><dd className="mt-1 text-2xl font-bold">{value}</dd></div>)}</dl> : <p className="mt-3 text-sm">No report loaded.</p>}
      </section>}
    </div>
  </main>;
}
