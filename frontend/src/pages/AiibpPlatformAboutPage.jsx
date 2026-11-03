import { BrainCircuit, Database, Eye, LockKeyhole, Network, ShieldCheck } from "lucide-react";

const capabilities = [
  { icon: BrainCircuit, title: "Governed AI Gateway", text: "Approved AI models and tools operate behind policy, RBAC and provenance controls rather than bypassing business modules." },
  { icon: Database, title: "Evidence-grounded intelligence", text: "AI consumes authorised tenant data and governed analytical evidence while deterministic business state remains canonical." },
  { icon: LockKeyhole, title: "Tenant and location awareness", text: "AI context follows the same Business, Location and user-authority boundaries as the operational application." },
  { icon: Eye, title: "Human supervision", text: "Recommendations, forecasts and consequential actions retain explicit human or policy ownership where required." },
  { icon: Network, title: "Module-aware tool use", text: "AI can use approved capabilities across modules without becoming a duplicate booking, CRM, payment, marketing or inventory authority." },
  { icon: ShieldCheck, title: "Auditable provenance", text: "Inference and approved tool use retain evidence and provenance so business decisions can be reviewed." },
];

export default function AiibpPlatformAboutPage() {
  return (
    <main className="bg-[#061323]" id="main-content" tabIndex="-1">
      <section className="border-b border-cyan-300/15 bg-[radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.18),transparent_32%),#081b30]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">About AIIBP</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black text-white sm:text-5xl">A modular business platform with AI built into the operating architecture.</h1>
          <p className="mt-5 max-w-4xl text-lg leading-8 text-slate-300">
            AIIBP is designed to deliver tenant-specific SaaS products from one governed platform. Commercial modules own distinct business responsibilities; shared engines provide identity, tenancy, data, integration, security and AI foundations beneath them.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {capabilities.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <Icon className="text-cyan-300" size={23} />
              <h2 className="mt-4 text-lg font-bold text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-cyan-300/15 bg-[#081827] py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Business-facing AI assistants</p>
            <h2 className="mt-3 text-3xl font-black text-white">Specialised assistance, shared governance.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">AI Business Adviser, AI Receptionist, AI Retention Manager and AI Stylist Copilot use the shared AI foundation but remain bounded to their declared purpose and permissions.</p>
          </div>
          <div className="grid gap-3">
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4"><strong className="text-emerald-200">AI may</strong><p className="mt-2 text-sm text-slate-300">Summarise evidence, detect patterns, forecast through approved models, recommend actions, explain reasoning and use explicitly approved tools.</p></div>
            <div className="rounded-xl border border-rose-300/20 bg-rose-300/5 p-4"><strong className="text-rose-200">AI may not</strong><p className="mt-2 text-sm text-slate-300">Cross tenant boundaries, expose secrets, silently replace canonical state, bypass module ownership or execute consequential actions outside policy.</p></div>
          </div>
        </div>
      </section>
    </main>
  );
}
