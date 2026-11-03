import { ArrowRight, Boxes, BrainCircuit, Building2, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { AIIBP_COMMERCIAL_MODULES } from "../config/aiibpCommercialModules.js";

const principles = [
  "One shared platform codebase",
  "Tenant and location isolation",
  "Independent commercial modules",
  "Automatic dependency resolution",
  "Governed AI with human oversight",
  "No tenant code forks",
];

export default function AiibpPlatformHomePage() {
  const featured = AIIBP_COMMERCIAL_MODULES.filter(({ newCommercial }) => newCommercial);

  return (
    <main id="main-content" tabIndex="-1">
      <section className="relative overflow-hidden border-b border-cyan-300/15 bg-[radial-gradient(circle_at_78%_20%,rgba(24,194,255,0.22),transparent_32%),linear-gradient(135deg,#061323_15%,#08284a_100%)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-28">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-300">Modular SaaS · Governed AI · Multi-tenant</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              One intelligent platform, composed around each business.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
              AIIBP delivers custom-made SaaS platforms by combining independently selectable commercial modules with shared security, data, integration and AI foundations. Each tenant receives the capabilities it needs without creating a software fork.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/platform/modules" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 no-underline">Explore all {AIIBP_COMMERCIAL_MODULES.length} modules <ArrowRight size={18} /></Link>
              <Link to="/platform/contact" className="inline-flex min-h-11 items-center rounded-xl border border-cyan-200/30 px-5 py-3 font-bold text-white no-underline hover:bg-white/10">Build your platform</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {principles.map((principle) => <span key={principle} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300">{principle}</span>)}
            </div>
          </div>

          <div className="self-center rounded-3xl border border-cyan-300/20 bg-[#071a2d]/80 p-6 shadow-2xl">
            <div className="flex items-center gap-3"><Boxes className="text-cyan-300" /><div><strong className="text-white">Tenant composition</strong><p className="text-xs text-slate-400">AIIBP resolves the technical graph automatically.</p></div></div>
            <div className="mt-6 space-y-3 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4"><strong>1. Select commercial modules</strong><p className="mt-1 text-slate-400">Choose only the business capabilities required.</p></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4"><strong>2. Resolve dependencies</strong><p className="mt-1 text-slate-400">Internal engines and required modules are added safely.</p></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4"><strong>3. Configure the tenant</strong><p className="mt-1 text-slate-400">Brand, locations, roles, workflows, integrations and AI policies.</p></div>
              <div className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-4"><strong className="text-cyan-200">4. Operate one coherent SaaS platform</strong><p className="mt-1 text-slate-300">Shared platform upgrades, tenant-isolated data and configurable growth.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#081827] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-white/5 p-6"><Building2 className="text-cyan-300" /><h2 className="mt-4 text-xl font-bold text-white">Business-first delivery</h2><p className="mt-2 text-sm leading-6 text-slate-400">Start from workflows, customers, staff, data and commercial goals, then compose the software around them.</p></article>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-6"><BrainCircuit className="text-cyan-300" /><h2 className="mt-4 text-xl font-bold text-white">AI-supervised operations</h2><p className="mt-2 text-sm leading-6 text-slate-400">AI assists with interpretation, forecasting, prioritisation and approved tools while business modules retain canonical authority.</p></article>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-6"><ShieldCheck className="text-cyan-300" /><h2 className="mt-4 text-xl font-bold text-white">Governed by design</h2><p className="mt-2 text-sm leading-6 text-slate-400">Tenant isolation, location authority, RBAC, audit provenance and explicit production activation are platform requirements.</p></article>
          </div>
        </div>
      </section>

      <section className="bg-[#061323] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Commercial expansion</p><h2 className="mt-2 text-3xl font-black text-white">Four distinctive modules added to the portfolio</h2></div>
            <Link to="/platform/modules" className="font-bold text-cyan-300 no-underline">View complete catalogue →</Link>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featured.map((module) => (
              <article key={module.key} className="rounded-2xl border border-cyan-300/15 bg-[#0a1d31] p-5">
                <Sparkles size={18} className="text-cyan-300" />
                <h3 className="mt-4 font-bold text-white">{module.label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{module.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
