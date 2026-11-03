import {
  BarChart3,
  BrainCircuit,
  Database,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

const workspaces = [
  {
    title: "AI readiness",
    description:
      "Inspect location-owned evidence, governance readiness and advisory planning history.",
    to: "/admin/system/ai-readiness",
    icon: BarChart3,
  },
  {
    title: "Training data governance",
    description:
      "Review the governed data sources and evidence boundaries that AI Core may use for model development.",
    to: "/admin/system/data-hub",
    icon: Database,
  },
  {
    title: "Candidate governance",
    description:
      "Review model candidates, evaluation evidence and promotion-readiness controls.",
    to: "/admin/system/ai-candidate-governance",
    icon: ShieldCheck,
  },
  {
    title: "Offline experiments",
    description:
      "Compare governed offline and shadow experiments before any production model is considered.",
    to: "/admin/system/ai-offline-experiments",
    icon: FlaskConical,
  },
];

export default function AiCorePage() {
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-black">
              <BrainCircuit size={24} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Core module</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">AI Core</h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                Shared governed AI foundation for AIIBP. AI Core coordinates approved evidence, model lifecycle,
                evaluation, provenance, inference and tool governance for every AI-enabled business module while
                canonical business modules remain authoritative for their own operational data.
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3" aria-label="AI Core safety state">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Training</h2>
            <p className="mt-2 text-sm text-slate-600">Controlled only. Production training remains disabled by default.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Tenant isolation</h2>
            <p className="mt-2 text-sm text-slate-600">Business and location ownership is required for governed training evidence.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Model promotion</h2>
            <p className="mt-2 text-sm text-slate-600">Automatic production promotion remains disabled and requires human approval.</p>
          </article>
        </section>

        <section aria-labelledby="ai-core-workspaces-heading">
          <h2 id="ai-core-workspaces-heading" className="text-xl font-bold text-slate-900">
            AI Core workspaces
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {workspaces.map((workspace) => {
              const Icon = workspace.icon;
              return (
                <Link
                  key={workspace.to}
                  to={workspace.to}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-400 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-black">
                      <Icon size={20} aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{workspace.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{workspace.description}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
