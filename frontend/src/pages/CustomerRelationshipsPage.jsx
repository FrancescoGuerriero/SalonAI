import { Link2, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import customerExperienceService from "../Services/customerExperienceService.js";

export default function CustomerRelationshipsPage() {
  const [relationships, setRelationships] = useState([]);
  const [form, setForm] = useState({ email: "", relationshipType: "family" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    try {
      const result = await customerExperienceService.getRelationships();
      setRelationships(result.relationships || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Relationships could not be loaded.");
    }
  }
  useEffect(() => { void load(); }, []);

  async function run(operation, message) {
    setBusy(true); setError(""); setNotice("");
    try { await operation(); setNotice(message); await load(); return true; }
    catch (requestError) { setError(requestError.response?.data?.message || "Relationship update failed."); return false; }
    finally { setBusy(false); }
  }

  async function invite(event) {
    event.preventDefault();
    if (await run(() => customerExperienceService.inviteRelationship(form), "Relationship invitation created.")) {
      setForm({ email: "", relationshipType: "family" });
    }
  }

  return (
    <main className="customer-page" id="main-content" tabIndex="-1">
      <div className="customer-page-container">
        <header className="customer-page-header"><div><p className="customer-eyebrow"><Link2 size={16}/>Household</p><h1>Relationships and household</h1><p>Create explicit customer relationships without automatically sharing appointments, loyalty, wallet balances or communications.</p></div><button type="button" className="customer-secondary-link" onClick={load}><RefreshCw size={16}/>Refresh</button></header>
        {error ? <div className="experience-message is-error" role="alert">{error}</div> : null}
        {notice ? <div className="experience-message is-success" role="status">{notice}</div> : null}
        <section className="experience-panel"><h2>Invite an existing salon customer</h2><form className="experience-inline-form" onSubmit={invite}><label>Email<input required type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></label><label>Relationship<select value={form.relationshipType} onChange={(e)=>setForm({...form,relationshipType:e.target.value})}><option value="family">Family</option><option value="partner">Partner</option><option value="spouse">Spouse</option><option value="parent">Parent</option><option value="child">Child</option><option value="guardian">Guardian</option><option value="dependent">Dependent</option><option value="other">Other</option></select></label><button disabled={busy} className="app-button app-button-primary"><Plus size={16}/>Invite</button></form><p className="experience-info-note"><ShieldCheck size={15}/>Relationship creation does not grant access to the other customer’s private or financial data.</p></section>
        <section className="experience-panel"><h2>My relationships</h2>{relationships.length ? <div className="experience-record-list">{relationships.map((item)=><article key={item.id}><div><small>{item.direction} · {item.relationshipType}</small><strong>{item.person?.preferredName || [item.person?.firstName,item.person?.lastName].filter(Boolean).join(" ") || "Salon customer"}</strong><p>Status: {item.status} · sharing remains off by default</p></div><div>{item.direction==="incoming"&&item.status==="pending"?<><button disabled={busy} className="app-button app-button-primary app-button-sm" onClick={()=>run(()=>customerExperienceService.respondRelationship(item.id,"active"),"Relationship accepted.")}>Accept</button><button disabled={busy} className="app-button app-button-secondary app-button-sm" onClick={()=>run(()=>customerExperienceService.respondRelationship(item.id,"declined"),"Relationship declined.")}>Decline</button></>:null}<button disabled={busy} className="app-button app-button-secondary app-button-sm" onClick={()=>run(()=>customerExperienceService.revokeRelationship(item.id),"Relationship removed.")}><Trash2 size={14}/>Remove</button></div></article>)}</div>:<p>No household relationships have been added.</p>}</section>
      </div>
    </main>
  );
}
