import {
  AlertTriangle,
  LoaderCircle,
  RefreshCcw,
} from "lucide-react";

function FeatureHeader({ icon: Icon, title, description, generatedAt, onRefresh, refreshing }) {
  return (
    <header className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
            <Icon size={28} />
          </span>

          <div>
            <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {description}
            </p>
            {generatedAt ? (
              <p className="mt-2 text-xs text-slate-400">
                Last generated: {new Date(generatedAt).toLocaleString("en-GB")}
              </p>
            ) : null}
          </div>
        </div>

        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCcw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        ) : null}
      </div>
    </header>
  );
}

function ErrorBanner({ message }) {
  if (!message) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-600" />
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

function LoadingPanel({ label = "Loading data" }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white">
      <LoaderCircle size={38} className="animate-spin text-indigo-600" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function SummaryCard({ title, value, description, icon: Icon, loading }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          {loading ? (
            <div className="mt-3 h-9 w-28 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <p className="mt-2 truncate text-3xl font-bold text-slate-900">{value}</p>
          )}
          <p className="mt-2 text-xs leading-5 text-slate-400">{description}</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={21} />
        </span>
      </div>
    </article>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="p-12 text-center">
      <Icon size={44} className="mx-auto text-slate-300" />
      <h3 className="mt-4 font-semibold text-slate-800">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function Pill({ children, tone = "slate" }) {
  const classes = {
    slate: "bg-slate-100 text-slate-700",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-emerald-100 text-emerald-800",
    blue: "bg-indigo-100 text-indigo-800",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes[tone] || classes.slate}`}>
      {children}
    </span>
  );
}

export {
  EmptyState,
  ErrorBanner,
  FeatureHeader,
  LoadingPanel,
  Pill,
  SummaryCard,
};
