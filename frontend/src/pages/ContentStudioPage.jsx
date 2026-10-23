import { Archive, FileText, Pencil, Plus, RefreshCw, Send, X } from "lucide-react";
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
  originalBlocks: [],
};

function localeForPage(page) {
  return page.locales?.find((entry) => entry.locale === page.defaultLocale)
    || page.locales?.[0]
    || { locale: page.defaultLocale || "en-GB", blocks: [] };
}

function formForPage(page) {
  const locale = localeForPage(page);
  const paragraphs = (locale.blocks || [])
    .filter((block) => block.type === "paragraph")
    .map((block) => block.text)
    .filter(Boolean);

  return {
    slug: page.slug || "",
    defaultLocale: locale.locale || page.defaultLocale || "en-GB",
    title: locale.title || "",
    summary: locale.summary || "",
    body: paragraphs.join("\n\n"),
    seoTitle: locale.seoTitle || "",
    seoDescription: locale.seoDescription || "",
    originalBlocks: locale.blocks || [],
  };
}

function editedBlocks(form) {
  const existing = Array.isArray(form.originalBlocks) ? form.originalBlocks : [];
  const paragraphIndex = existing.findIndex((block) => block.type === "paragraph");
  const text = form.body.trim();

  if (paragraphIndex >= 0) {
    return existing.map((block, index) =>
      index === paragraphIndex ? { ...block, text } : block
    );
  }

  return text ? [...existing, { type: "paragraph", text }] : existing;
}

export default function ContentStudioPage() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "customer-experience:manage");
  const [pages, setPages] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
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

  function resetEditor() {
    setEditingId("");
    setForm(initialForm);
  }

  function editPage(page) {
    setEditingId(page._id);
    setForm(formForPage(page));
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");

    const pagePayload = {
      slug: form.slug,
      defaultLocale: form.defaultLocale,
      locales: [{
        locale: form.defaultLocale,
        title: form.title,
        summary: form.summary,
        seoTitle: form.seoTitle,
        seoDescription: form.seoDescription,
        blocks: editingId ? editedBlocks(form) : (form.body ? [{ type: "paragraph", text: form.body }] : []),
      }],
    };

    try {
      if (editingId) {
        await customerExperienceService.updateContentPage(editingId, pagePayload);
        setMessage("Content draft updated and a new version snapshot was created. The current public version is unchanged until you publish.");
      } else {
        await customerExperienceService.createContentPage(pagePayload);
        setMessage("Draft content page created.");
      }
      resetEditor();
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Content page could not be saved.");
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
      <header className="app-page-header"><div><div><p className="app-eyebrow">Stage 4 · Content Studio</p><h1>Content Studio</h1><p className="app-page-description">Create and maintain versioned, multilingual-ready public content without editing application code.</p></div><button type="button" className="app-button app-button-secondary" onClick={load}><RefreshCw size={17}/>Refresh</button></div></header>
      {error ? <div className="experience-message is-error" role="alert">{error}</div> : null}
      {message ? <div className="experience-message is-success" role="status">{message}</div> : null}
      <section className="experience-management-panel">
        <header><span>{editingId ? <Pencil size={20}/> : <Plus size={20}/>}</span><div><h2>{editingId ? "Edit content page" : "New content page"}</h2><p>{editingId ? "Saving creates a new working version. The last published snapshot remains public until you explicitly publish the update." : "Draft first, then explicitly publish after review."}</p></div>{editingId ? <button type="button" className="app-button app-button-secondary app-button-sm" onClick={resetEditor}><X size={15}/>Cancel edit</button> : null}</header>
        <form className="experience-offer-form" onSubmit={save}>
          <label>Slug<input required disabled={!canManage || busy} value={form.slug} onChange={(e)=>setForm({...form,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")})}/></label>
          <label>Locale<input required disabled={!canManage || busy} value={form.defaultLocale} onChange={(e)=>setForm({...form,defaultLocale:e.target.value})}/></label>
          <label>Title<input required disabled={!canManage || busy} value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></label>
          <label className="is-wide">Summary<textarea rows="2" disabled={!canManage || busy} value={form.summary} onChange={(e)=>setForm({...form,summary:e.target.value})}/></label>
          <label className="is-wide">Primary body copy<textarea rows="6" disabled={!canManage || busy} value={form.body} onChange={(e)=>setForm({...form,body:e.target.value})}/><small>Structured image and call-to-action blocks are preserved when routine text and metadata are edited.</small></label>
          <label>SEO title<input disabled={!canManage || busy} value={form.seoTitle} onChange={(e)=>setForm({...form,seoTitle:e.target.value})}/></label>
          <label>SEO description<input disabled={!canManage || busy} value={form.seoDescription} onChange={(e)=>setForm({...form,seoDescription:e.target.value})}/></label>
          <button disabled={!canManage || busy} className="app-button app-button-primary"><FileText size={17}/>{editingId ? "Save working version" : "Create draft"}</button>
        </form>
      </section>
      <section className="experience-management-panel">
        <header><span><FileText size={20}/></span><div><h2>Managed pages</h2><p>Routine edits create new version snapshots; the public API continues serving the last approved published snapshot until the new version is published.</p></div><b>{pages.length}</b></header>
        <div className="experience-management-list is-compact">
          {pages.map((page)=><article key={page._id}><div><small>v{page.currentVersion} · {page.status}{page.hasUnpublishedChanges ? " · unpublished changes" : ""}</small><strong>/{page.slug}</strong><p>{page.locales?.map((item)=>item.locale).join(", ") || page.defaultLocale}</p></div><div><button disabled={!canManage||busy} className="app-button app-button-secondary app-button-sm" onClick={()=>editPage(page)}><Pencil size={15}/>Edit</button>{page.status!=="published"||page.hasUnpublishedChanges?<button disabled={!canManage||busy} className="app-button app-button-primary app-button-sm" onClick={()=>action(()=>customerExperienceService.publishContentPage(page._id),"Content published.")}><Send size={15}/>{page.status === "published" ? "Publish changes" : "Publish"}</button>:null}<button disabled={!canManage||busy} className="app-button app-button-secondary app-button-sm" onClick={()=>action(()=>customerExperienceService.archiveContentPage(page._id),"Content archived.")}><Archive size={15}/>Archive</button></div></article>)}
        </div>
      </section>
    </main>
  );
}
