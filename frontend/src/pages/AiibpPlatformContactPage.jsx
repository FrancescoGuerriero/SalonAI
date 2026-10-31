import { useState } from "react";
import { Building2, CheckCircle2, Mail, Puzzle } from "lucide-react";

import { AIIBP_COMMERCIAL_MODULES } from "../config/aiibpCommercialModules.js";

export default function AiibpPlatformContactPage() {
  const [submitted, setSubmitted] = useState(false);

  function submit(event) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="bg-[#061323]" id="main-content" tabIndex="-1">
      <section className="border-b border-cyan-300/15 bg-[#081b30]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Contact AIIBP</p>
          <h1 className="mt-3 text-4xl font-black text-white">Plan your custom modular SaaS platform.</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">Tell us about the business, operating model and capabilities required. The discovery process maps requirements to commercial modules, internal dependencies and governed AI opportunities.</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:px-8">
        <aside className="space-y-4">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5"><Building2 className="text-cyan-300" /><h2 className="mt-3 font-bold text-white">Business discovery</h2><p className="mt-2 text-sm leading-6 text-slate-400">We map locations, customers, staff, services, transactions, data, workflows and regulatory constraints.</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5"><Puzzle className="text-cyan-300" /><h2 className="mt-3 font-bold text-white">Module composition</h2><p className="mt-2 text-sm leading-6 text-slate-400">Select from {AIIBP_COMMERCIAL_MODULES.length} commercial modules; AIIBP resolves dependencies and compatibility.</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5"><Mail className="text-cyan-300" /><h2 className="mt-3 font-bold text-white">Commercial enquiry workflow</h2><p className="mt-2 text-sm leading-6 text-slate-400">The contact UI is ready for the approved production enquiry endpoint. During source/manual acceptance no form data is transmitted externally.</p></article>
        </aside>

        <div className="rounded-3xl border border-cyan-300/20 bg-[#0a1d31] p-6 sm:p-8">
          <h2 className="text-2xl font-black text-white">Platform discovery enquiry</h2>
          {submitted ? (
            <div className="mt-6 rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-5" role="status">
              <div className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-cyan-300" /><div><strong className="text-white">Form validation complete.</strong><p className="mt-2 text-sm leading-6 text-slate-300">This test build intentionally does not transmit commercial enquiry data until an approved production destination, spam protection and consent/audit policy are configured.</p></div></div>
            </div>
          ) : (
            <form className="mt-6 grid gap-4" onSubmit={submit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-semibold text-slate-200">Name<input required name="name" autoComplete="name" className="rounded-xl border border-white/15 bg-[#061323] px-3 py-2.5 text-white" /></label>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-200">Business<input required name="business" autoComplete="organization" className="rounded-xl border border-white/15 bg-[#061323] px-3 py-2.5 text-white" /></label>
              </div>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-200">Email<input required type="email" name="email" autoComplete="email" className="rounded-xl border border-white/15 bg-[#061323] px-3 py-2.5 text-white" /></label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-200">Business type<input required name="businessType" placeholder="e.g. salon, healthcare, retail, professional services" className="rounded-xl border border-white/15 bg-[#061323] px-3 py-2.5 text-white" /></label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-200">What should the platform help you run?<textarea required name="requirements" rows="6" className="rounded-xl border border-white/15 bg-[#061323] px-3 py-2.5 text-white" /></label>
              <button type="submit" className="min-h-11 rounded-xl border-0 bg-cyan-400 px-5 py-3 font-black text-slate-950">Review enquiry</button>
              <p className="text-xs leading-5 text-slate-500">No commercial form data leaves this test build. Production delivery requires an approved enquiry endpoint and privacy controls.</p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
