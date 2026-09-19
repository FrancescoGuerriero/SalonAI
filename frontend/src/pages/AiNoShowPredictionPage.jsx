import {
  useEffect,
  useState,
} from "react";
import {
  AlertTriangle,
  CalendarCheck,
  CircleDollarSign,
  Loader2,
  RefreshCw,
} from "lucide-react";

import NoShowEvaluationPanel from "../components/ai/NoShowEvaluationPanel.jsx";
import {
  DEFAULT_NO_SHOW_PARAMETERS,
  getAiNoShowEvaluation,
  getAiNoShowPredictions,
} from "../Services/aiNoShowPredictionService.js";

const money = (
  value
) =>
  new Intl.NumberFormat(
    "en-GB",
    {
      style:
        "currency",
      currency:
        "GBP",
      maximumFractionDigits:
        0,
    }
  ).format(
    Number(value) ||
    0
  );

const percent = (
  value
) =>
  new Intl.NumberFormat(
    "en-GB",
    {
      style:
        "percent",
      maximumFractionDigits:
        0,
    }
  ).format(
    Number(value) ||
    0
  );

function requestError(
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

export default function AiNoShowPredictionPage() {
  const [
    filters,
    setFilters,
  ] = useState(
    DEFAULT_NO_SHOW_PARAMETERS
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
    values = filters
  ) {
    setLoading(true);
    setError("");
    setEvaluationError("");

    const [
      predictionResult,
      evaluationResult,
    ] =
      await Promise.allSettled([
        getAiNoShowPredictions(
          values
        ),
        getAiNoShowEvaluation({
          periodDays:
            90,
        }),
      ]);

    if (
      predictionResult.status ===
      "fulfilled"
    ) {
      setResult(
        predictionResult.value
      );
    } else {
      setError(
        requestError(
          predictionResult.reason,
          "Unable to generate no-show predictions."
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
        requestError(
          evaluationResult.reason,
          "Unable to load no-show evaluation evidence."
        )
      );
    }

    setLoading(false);
  }

  useEffect(
    () => {
      void load(
        DEFAULT_NO_SHOW_PARAMETERS
      );
    },
    []
  );

  const prediction =
    result?.prediction;
  const summary =
    prediction?.summary;
  const rows =
    prediction?.predictions ||
    [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-violet-700">
                SalonAI Intelligence
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                AI No-Show Prediction
              </h1>
              <p className="mt-2 max-w-3xl text-slate-600">
                Identify appointments that need confirmation, deposits, stronger reminders or waitlist preparation.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void load()
              }
              disabled={
                loading
              }
              className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white"
            >
              <RefreshCw
                size={18}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh predictions
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              [
                "Forecast horizon",
                "horizonDays",
                1,
                90,
                1,
              ],
              [
                "Medium-risk threshold",
                "mediumRiskThreshold",
                0,
                1,
                0.05,
              ],
              [
                "High-risk threshold",
                "highRiskThreshold",
                0,
                1,
                0.05,
              ],
            ].map(
              ([
                label,
                key,
                min,
                max,
                step,
              ]) => (
                <label
                  key={
                    key
                  }
                  className="space-y-2"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {label}
                  </span>
                  <input
                    type="number"
                    min={
                      min
                    }
                    max={
                      max
                    }
                    step={
                      step
                    }
                    value={
                      filters[
                        key
                      ]
                    }
                    onChange={(
                      event
                    ) =>
                      setFilters(
                        (
                          current
                        ) => ({
                          ...current,
                          [key]:
                            Number(
                              event
                                .target
                                .value
                            ),
                        })
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                  />
                </label>
              )
            )}
          </div>
        </section>

        {error ? (
          <section
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800"
          >
            {error}
          </section>
        ) : null}

        {loading ? (
          <section
            className="rounded-2xl border border-slate-200 bg-white p-16 text-center"
            aria-busy="true"
          >
            <Loader2
              className="mx-auto animate-spin text-violet-700"
              size={40}
            />
            <p className="mt-4 font-semibold">
              Analysing upcoming appointments
            </p>
          </section>
        ) : summary ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  "Upcoming appointments",
                  summary.total_appointments,
                  CalendarCheck,
                ],
                [
                  "High-risk bookings",
                  summary.high_risk_count,
                  AlertTriangle,
                ],
                [
                  "Expected no-shows",
                  summary.expected_no_shows,
                  AlertTriangle,
                ],
                [
                  "Revenue at risk",
                  money(
                    summary.revenue_at_risk
                  ),
                  CircleDollarSign,
                ],
              ].map(
                ([
                  label,
                  value,
                  Icon,
                ]) => (
                  <article
                    key={
                      label
                    }
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <Icon className="text-violet-700" />
                    <p className="mt-4 text-sm text-slate-500">
                      {label}
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {value}
                    </p>
                  </article>
                )
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b p-5">
                <h2 className="text-lg font-semibold">
                  Appointment risk list
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-3 text-left">
                        Appointment
                      </th>
                      <th className="px-5 py-3 text-left">
                        Service
                      </th>
                      <th className="px-5 py-3 text-right">
                        Risk
                      </th>
                      <th className="px-5 py-3 text-right">
                        Value
                      </th>
                      <th className="px-5 py-3 text-left">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map(
                      (
                        item
                      ) => (
                        <tr
                          key={
                            item.appointment_key
                          }
                        >
                          <td className="px-5 py-4">
                            {new Date(
                              item.appointment_date
                            ).toLocaleString(
                              "en-GB"
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {item.service_name ||
                              "Appointment"}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {percent(
                              item.probability
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {money(
                              item.appointment_value
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {item.recommended_actions
                              ?.[0] ||
                              "Standard reminder"}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}

        <NoShowEvaluationPanel
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
