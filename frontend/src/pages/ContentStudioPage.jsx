import { FileText, Plus, RefreshCw, Send, Archive } from "lucide-react";
import { useEffect, useState } from "react";
import customerExperienceService from "../Services/customerExperienceService.js";
import useAuth from "../hooks/useAuth.js";
import { hasPermission } from "../utils/permissions.js";

const initialForm = {
  slug: "",
  defaultLocale: "en-GB",
  title: "",
  summary: "",
  body: "",
  seoTitle: "",
  seoDescription: "",
};

export default function ContentStudioPage() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "customer-experience:manage");
  const [pages, setPages] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const result = await customerExperienceService.listContentPages();
      setPages(result.pages || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Content pages could not be loaded.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function create(event) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      await customerExperienceService.createContentPage({
        slug: form.slug,
        defaultLocale: form.defaultLocale,
        locales: [{
          locale: form.defaultLocale,
          title: form.title,
          summary: form.summary,
          seoTitle: form.seoTitle,
          seoDescription: form.seoDescription,
          blocks: form.body ? [{ type: "paragraph", text: form.body }] : [],
        }],
      });
      setForm(initialForm);
      setMessage("Draft content page created.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Content page could not be created.");
    } finally { setBusy(false); }
  }

  async function action(operation, success) {
    setBusy(true); setError(""); setMessage("");
    try { await operation(); setMessage(success); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || "Content update failed."); }
    finally { setBusy(false); }
  }

  return (
    <main className="experience-management-page" id="main-content" tabIndex="-1">
      <header className="app-page-header"><div><div><p className="app-eyebrow">Stage 4 · Content Studio</p><h1>Content Studio</h1><p className="app-page-description">Create versioned, multilingual-ready public content without editing application code.</p></div><button type="button" className="app-button app-button-secondary" onClick={load}><RefreshCw size={17}/>Refresh</button></div></header>
      {error ? <div className="experience-message is-error" role="alert">{error}</div> : null}
      {message ? <div className="experience-message is-success" role="status">{message}</div> : null}
      <section className="experience-management-panel">
        <header><span><Plus size={20}/></span><div><h2>New content page</h2><p>Draft first, then explicitly publish after review.</p></div></header>
        <form className="experience-offer-form" onSubmit={create}>
          <label>Slug<input required disabled={!canManage || busy} value={form.slug} onChange={(e)=>setForm({...form,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")})}/></label>
          <label>Locale<input required disabled={!canManage || busy} value={form.defaultLocale} onChange={(e)=>setForm({...form,defaultLocale:e.target.value})}/></label>
          <label>Title<input required disabled={!canManage || busy} value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></label>
          <label className="is-wide">Summary<textarea rows="2" disabled={!canManage || busy} value={form.summary} onChange={(e)=>setForm({...form,summary:e.target.value})}/></label>
          <label className="is-wide">Body<textarea rows="6" disabled={!canManage || busy} value={form.body} onChange={(e)=>setForm({...form,body:e.target.value})}/></label>
          <label>SEO title<input disabled={!canManage || busy} value={form.seoTitle} onChange={(e)=>setForm({...form,seoTitle:e.target.value})}/></label>
          <label>SEO description<input disabled={!canManage || busy} value={form.seoDescription} onChange={(e)=>setForm({...form,seoDescription:e.target.value})}/></label>
          <button disabled={!canManage || busy} className="app-button app-button-primary"><FileText size={17}/>Create draft</button>
        </form>
      </section>
      <section className="experience-management-panel">
        <header><span><FileText size={20}/></span><div><h2>Managed pages</h2><p>Published pages remain the only versions available through the public content API.</p></div><b>{pages.length}</b></header>
        <div className="experience-management-list is-compact">
          {pages.map((page)=><article key={page._id}><div><small>v{page.currentVersion} · {page.status}</small><strong>/{page.slug}</strong><p>{page.locales?.map((item)=>item.locale).join(", ") || page.defaultLocale}</p></div><div>{page.status!=="published"?<button disabled={!canManage||busy} className="app-button app-button-primary app-button-sm" onClick={()=>action(()=>customerExperienceService.publishContentPage(page._id),"Content published.")}><Send size={15}/>Publish</button>:null}<button disabled={!canManage||busy} className="app-button app-button-secondary app-button-sm" onClick={()=>action(()=>customerExperienceService.archiveContentPage(page._id),"Content archived.")}><Archive size={15}/>Archive</button></div></article>)}
        </div>
      </section>
    </main>
  );
}
