import { CheckCircle2, Layers3 } from "lucide-react";

import { AIIBP_COMMERCIAL_MODULES } from "../config/aiibpCommercialModules.js";

export default function AiibpModulesPage() {
  const groups = [...new Set(AIIBP_COMMERCIAL_MODULES.map(({ group }) => group))];

  return (
    <main className="bg-[#061323]" id="main-content" tabIndex="-1">
      <section className="border-b border-cyan-300/15 bg-[#081b30]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Commercial module catalogue</p>
          <h1 className="mt-3 text-4xl font-black text-white">{AIIBP_COMMERCIAL_MODULES.length} modules for custom tenant composition</h1>
          <p className="mt-4 max-w-4xl text-base leading-7 text-slate-300">
            Each module has a distinct business purpose. A tenant may select one or many modules; AIIBP automatically resolves required platform and module dependencies without creating duplicate business authority.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-12 px-4 py-14 sm:px-6 lg:px-8">
        {groups.map((group) => (
          <section key={group}>
            <div className="mb-5 flex items-center gap-3"><Layers3 className="text-cyan-300" size={21} /><h2 className="text-2xl font-black text-white">{group}</h2></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {AIIBP_COMMERCIAL_MODULES.filter((module) => module.group === group).map((module) => (
                <article id={module.key} key={module.key} className={`scroll-mt-28 rounded-2xl border p-5 ${module.newCommercial ? "border-cyan-300/35 bg-cyan-300/10" : "border-white/10 bg-white/5"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><span className="text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-300">{group}</span><h3 className="mt-2 text-lg font-bold text-white">{module.label}</h3></div>
                    {module.newCommercial ? <span className="rounded-full bg-cyan-300 px-2.5 py-1 text-[10px] font-black uppercase text-slate-950">New module</span> : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{module.summary}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-300"><CheckCircle2 size={15} className="text-cyan-300" /> Independently selectable; dependencies auto-resolved</div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
