import {
  Activity,
  Gauge,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

const percent = (
  value
) =>
  `${(
    Number(value) *
    100
  ).toFixed(1)}%`;

const decimal = (
  value
) =>
  value === null ||
  value === undefined
    ? "Not available"
    : Number(
        value
      ).toFixed(
        4
      );

function statusLabel(
  value
) {
  return String(
    value ||
      "insufficient_data"
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

export default function NoShowEvaluationPanel({
  evaluation,
  loading = false,
  error = "",
}) {
  if (
    loading
  ) {
    return (
      <section
        className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
        aria-busy="true"
      >
        <p className="font-semibold text-stone-600">
          Loading no-show model evaluation…
        </p>
      </section>
    );
  }

  if (
    error
  ) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <h2 className="font-bold text-red-900">
          Model evaluation unavailable
        </h2>
        <p className="mt-1 text-sm text-red-800">
          {error}
        </p>
      </section>
    );
  }

  const model =
    evaluation
      ?.models
      ?.[0];

  if (
    !model
  ) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-amber-700">
          Governed AI evaluation
        </p>
        <h2 className="mt-1 text-xl font-bold text-black">
          Calibration and drift
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          No linked completed/no-show outcomes are available yet. Predictions will become measurable as appointments reach observed outcomes.
        </p>
      </section>
    );
  }

  const calibration =
    model.calibration;
  const drift =
    model.drift;

  const cards = [
    {
      label:
        "Labelled outcomes",
      value:
        calibration.sampleCount,
      detail:
        `${calibration.positiveCount} no-shows · ${calibration.negativeCount} completed`,
      icon:
        ShieldCheck,
    },
    {
      label:
        "Observed no-show rate",
      value:
        percent(
          calibration.observedNoShowRate
        ),
      detail:
        `Mean predicted ${percent(calibration.meanPredictedProbability)}`,
      icon:
        Gauge,
    },
    {
      label:
        "Brier score",
      value:
        decimal(
          calibration.brierScore
        ),
      detail:
        "Lower is better for probability accuracy",
      icon:
        Activity,
    },
    {
      label:
        "Calibration error",
      value:
        decimal(
          calibration.expectedCalibrationError
        ),
      detail:
        "Weighted gap between predicted and observed rates",
      icon:
        Gauge,
    },
    {
      label:
        "Probability drift",
      value:
        statusLabel(
          drift.status
        ),
      detail:
        drift.populationStabilityIndex ===
        null
          ? "More labelled outcomes are required"
          : `PSI ${decimal(drift.populationStabilityIndex)} · mean shift ${percent(drift.meanProbabilityShift)}`,
      icon:
        TrendingUp,
    },
  ];

  return (
    <section
      className="space-y-5"
      aria-labelledby="no-show-evaluation-heading"
    >
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-amber-700">
          Governed AI evaluation
        </p>
        <h2
          id="no-show-evaluation-heading"
          className="mt-1 text-2xl font-bold text-black"
        >
          No-show calibration and drift
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          {model.modelName} {model.modelVersion} · current {evaluation.period?.days || 90}-day outcome window compared with the preceding equal window.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Monitoring thresholds are internal review heuristics. Evidence never automatically promotes, approves or activates a model.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(
          ({
            label,
            value,
            detail,
            icon: Icon,
          }) => (
            <article
              key={label}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <Icon
                size={20}
                className="text-amber-700"
                aria-hidden="true"
              />
              <p className="mt-4 text-sm font-semibold text-stone-600">
                {label}
              </p>
              <p className="mt-1 text-2xl font-bold text-black">
                {value}
              </p>
              <p className="mt-2 text-xs text-stone-500">
                {detail}
              </p>
            </article>
          )
        )}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-black">
          Lifecycle evidence
        </h3>
        <p className="mt-2 text-sm text-stone-600">
          {model.lifecycleEvidence.note}
        </p>
      </div>
    </section>
  );
}
