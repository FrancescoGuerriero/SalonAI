import {
  useEffect,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import AdviserEvaluationPanel from "../components/ai/AdviserEvaluationPanel.jsx";
import {
  getSalonAiAdviserEvaluation,
} from "../Services/aiAdviserService.js";
import {
  DEFAULT_COPILOT_PARAMETERS,
  getAiManagementCopilot,
} from "../Services/aiManagementCopilotService.js";

function errorMessage(
  error,
  fallback
) {
  return (
    error?.response?.data
      ?.message ||
    error?.message ||
    fallback
  );
}

export default function ManagementCopilotPage() {
  const [
    params,
    setParams,
  ] = useState(
    DEFAULT_COPILOT_PARAMETERS
  );
  const [
    result,
    setResult,
  ] = useState(null);
  const [
    evaluation,
    setEvaluation,
  ] = useState(null);
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    error,
    setError,
  ] = useState("");
  const [
    evaluationError,
    setEvaluationError,
  ] = useState("");

  async function load(
    values = params
  ) {
    setLoading(true);
    setError("");
    setEvaluationError("");

    const [
      copilotResult,
      evaluationResult,
    ] =
      await Promise.allSettled([
        getAiManagementCopilot(
          values
        ),
        getSalonAiAdviserEvaluation(
          {
            periodDays:
              values.periodDays,
          }
        ),
      ]);

    if (
      copilotResult.status ===
      "fulfilled"
    ) {
      setResult(
        copilotResult.value
      );
    } else {
      setError(
        errorMessage(
          copilotResult.reason,
          "Unable to generate the management brief."
        )
      );
    }

    if (
      evaluationResult.status ===
      "fulfilled"
    ) {
      setEvaluation(
        evaluationResult.value
      );
    } else {
      setEvaluationError(
        errorMessage(
          evaluationResult.reason,
          "Unable to load Adviser evaluation evidence."
        )
      );
    }

    setLoading(false);
  }

  useEffect(
    () => {
      void load(
        DEFAULT_COPILOT_PARAMETERS
      );
    },
    []
  );

  const brief =
    result?.brief;
  const summary =
    brief?.summary;
  const insights =
    brief?.insights ||
    [];
  const actions =
    brief?.action_plan ||
    [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                <Sparkles
                  size={18}
                />
                SalonAI Intelligence
              </div>
              <h1 className="mt-2 text-3xl font-bold text-black">
                Management Copilot
              </h1>
              <p className="mt-2 max-w-3xl text-slate-600">
                A prioritised operating brief based on appointments, revenue movement and management exceptions, with governed evaluation evidence for the Adviser.
              </p>
            </div>

            <div className="flex gap-3">
              <select
                value={
                  params.periodDays
                }
                onChange={(
                  event
                ) =>
                  setParams(
                    (
                      current
                    ) => ({
                      ...current,
                      periodDays:
                        Number(
                          event
                            .target
                            .value
                        ),
                    })
                  )
                }
                className="rounded-xl border px-3 py-2.5"
                aria-label="Management reporting period"
              >
                <option value="7">
                  Last 7 days
                </option>
                <option value="30">
                  Last 30 days
                </option>
                <option value="90">
                  Last 90 days
                </option>
              </select>

              <button
                type="button"
                onClick={() =>
                  void load()
                }
                disabled={
                  loading
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-black px-4 py-2.5 font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
              >
                <RefreshCw
                  size={18}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />
                Refresh
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <section
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900"
          >
            {error}
          </section>
        ) : null}

        {loading ? (
          <section
            className="rounded-2xl border bg-white p-16 text-center"
            aria-busy="true"
          >
            <Loader2
              className="mx-auto animate-spin text-amber-700"
              size={40}
            />
          </section>
        ) : summary ? (
          <>
            <section className="grid gap-4 lg:grid-cols-3">
              <article className="rounded-2xl border bg-white p-5">
                <Gauge className="text-amber-700" />
                <p className="mt-4 text-sm text-slate-500">
                  Operational health
                </p>
                <p className="text-3xl font-bold">
                  {
                    summary.health_score
                  }
                  /100
                </p>
              </article>

              <article className="rounded-2xl border bg-white p-5 lg:col-span-2">
                <p className="text-sm font-semibold text-amber-700">
                  Executive headline
                </p>
                <p className="mt-2 text-xl font-bold">
                  {
                    summary.headline
                  }
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {
                    brief.period_label
                  }
                </p>
              </article>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <article className="rounded-2xl border bg-white p-5">
                <h2 className="text-lg font-semibold">
                  Prioritised insights
                </h2>
                <div className="mt-4 space-y-3">
                  {insights.map(
                    (
                      insight
                    ) => (
                      <div
                        key={
                          insight.insight_id
                        }
                        className="rounded-xl border p-4"
                      >
                        <div className="flex gap-3">
                          {[
                            "critical",
                            "high",
                          ].includes(
                            insight.priority
                          ) ? (
                            <AlertTriangle className="text-amber-700" />
                          ) : (
                            <CheckCircle2 className="text-emerald-700" />
                          )}
                          <div>
                            <h3 className="font-semibold">
                              {
                                insight.title
                              }
                            </h3>
                            <p className="mt-1 text-sm text-slate-600">
                              {
                                insight.description
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </article>

              <article className="rounded-2xl border bg-white p-5">
                <h2 className="text-lg font-semibold">
                  Action plan
                </h2>
                <div className="mt-4 space-y-3">
                  {actions.map(
                    (
                      action
                    ) => (
                      <div
                        key={
                          action.action_id
                        }
                        className="rounded-xl bg-amber-50 p-4"
                      >
                        <h3 className="font-semibold text-black">
                          {
                            action.title
                          }
                        </h3>
                        <p className="mt-2 text-sm text-stone-700">
                          {
                            action.success_measure
                          }
                        </p>
                      </div>
                    )
                  )}
                </div>
              </article>
            </section>
          </>
        ) : null}

        <AdviserEvaluationPanel
          evaluation={
            evaluation
          }
          loading={
            loading
          }
          error={
            evaluationError
          }
        />
      </div>
    </main>
  );
}
