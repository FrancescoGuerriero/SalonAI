import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  AI_RECEPTIONIST_KEY,
  getAiWorkforceRegistry,
  listAiReceptionistOutcomes,
  listAiReceptionistProposals,
  listAiReceptionistRuns,
} from "../Services/aiWorkforceService.js";

function requestMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function formatTimestamp(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusLabel(value) {
  return String(value || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function SummaryCard({ icon: Icon, label, value, detail }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
          <Icon size={20} aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

export default function AiReceptionistPage() {
  const [registry, setRegistry] = useState(null);
  const [runs, setRuns] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [registryResult, runsResult, proposalsResult, outcomesResult] =
        await Promise.all([
          getAiWorkforceRegistry(),
          listAiReceptionistRuns(),
          listAiReceptionistProposals(),
          listAiReceptionistOutcomes(),
        ]);

      setRegistry(registryResult || null);
      setRuns(Array.isArray(runsResult?.items) ? runsResult.items : []);
      setProposals(
        Array.isArray(proposalsResult?.items) ? proposalsResult.items : []
      );
      setOutcomes(
        Array.isArray(outcomesResult?.items) ? outcomesResult.items : []
      );
    } catch (requestError) {
      setError(
        requestMessage(
          requestError,
          "Unable to load the governed AI Receptionist workspace."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const agent = useMemo(
    () =>
      (Array.isArray(registry?.agents) ? registry.agents : []).find(
        (item) => item?.key === AI_RECEPTIONIST_KEY
      ) || null,
    [registry]
  );

  const pendingProposals = proposals.filter(
    (proposal) => String(proposal?.status || "").toLowerCase() === "pending"
  );
  const completedRuns = runs.filter(
    (run) => String(run?.status || "").toLowerCase() === "completed"
  );

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-slate-500">
            <Bot size={16} aria-hidden="true" /> AI workforce
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">
            AI Receptionist
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Monitor the governed A1 receptionist used by customer channels. It
            may read service and availability data and create reviewable booking
            proposals, but it cannot directly create, reschedule or cancel a
            canonical appointment.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/whatsapp-booking"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm"
          >
            <MessageCircle size={17} aria-hidden="true" />
            Open WhatsApp desk
          </Link>
          <button
            type="button"
            onClick={() => void loadWorkspace()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="AI Receptionist summary"
      >
        <SummaryCard
          icon={ShieldCheck}
          label="Autonomy ceiling"
          value={agent?.autonomyCeiling || registry?.autonomyCeiling || "A1"}
          detail="Human review remains required for consequential booking proposals."
        />
        <SummaryCard
          icon={ClipboardCheck}
          label="Pending proposals"
          value={loading ? "—" : pendingProposals.length}
          detail="Visible only where your effective tenant permissions allow review."
        />
        <SummaryCard
          icon={Bot}
          label="Recent agent runs"
          value={loading ? "—" : runs.length}
          detail={`${completedRuns.length} completed in the loaded history.`}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Observed outcomes"
          value={loading ? "—" : outcomes.length}
          detail="Outcome evidence records human/business results; it never executes proposals."
        />
      </section>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Governance boundary</h2>
            <p className="mt-1">
              Direct mutation is {registry?.executionPolicy?.directMutationEnabled ? "enabled" : "disabled"}.
              Consequential actions {registry?.executionPolicy?.consequentialActionsRequireProposalReview === false ? "do not require" : "require"} proposal review,
              and approved proposals are not automatically executed.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Reviewable proposals
              </h2>
              <p className="text-sm text-slate-500">
                Receptionist suggestions only; canonical booking authority stays outside the AI layer.
              </p>
            </div>
            <CalendarCheck size={20} className="text-slate-500" aria-hidden="true" />
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading proposals…</p>
          ) : proposals.length ? (
            <div className="space-y-3">
              {proposals.slice(0, 12).map((proposal) => (
                <article
                  key={proposal._id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">
                        {proposal.summary || statusLabel(proposal.actionType)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {statusLabel(proposal.actionType)} · {formatTimestamp(proposal.createdAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {statusLabel(proposal.status)}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                    <div>
                      <dt className="font-medium">Required permission</dt>
                      <dd>{proposal.requiredPermission || "Not recorded"}</dd>
                    </div>
                    <div>
                      <dt className="font-medium">Channel</dt>
                      <dd>{proposal.channel || "Not recorded"}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No AI Receptionist proposals are available for your current tenant authority.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-950">Recent runs</h2>
            <p className="text-sm text-slate-500">
              Tenant-scoped execution provenance for customer-channel receptionist activity.
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading runs…</p>
          ) : runs.length ? (
            <div className="space-y-3">
              {runs.slice(0, 12).map((run) => (
                <article
                  key={run._id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      {run.channel ? statusLabel(run.channel) : "Customer channel"}
                    </p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {statusLabel(run.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Started {formatTimestamp(run.startedAt || run.createdAt)} · Autonomy {run.effectiveAutonomy || run.requestedAutonomy || "A1"}
                  </p>
                  {run.channelConversationRef ? (
                    <p className="mt-1 break-all text-xs text-slate-500">
                      Conversation ref: {String(run.channelConversationRef)}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No AI Receptionist runs are recorded for the current tenant scope.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
