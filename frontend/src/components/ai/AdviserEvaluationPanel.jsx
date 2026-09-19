import {
  Activity,
  Gauge,
  Link2,
  MessageSquareText,
  ThumbsUp,
} from "lucide-react";

function percentage(
  value
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? `${number.toFixed(1)}%`
    : "0.0%";
}

function numberValue(
  value
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number.toLocaleString()
    : "0";
}

function metricCards(
  summary
) {
  return [
    {
      key:
        "responses",
      label:
        "Adviser responses",
      value:
        numberValue(
          summary.total
        ),
      description:
        "Management Adviser inferences in this period",
      icon:
        MessageSquareText,
    },
    {
      key:
        "feedback",
      label:
        "Feedback coverage",
      value:
        percentage(
          summary.feedbackCoveragePct
        ),
      description:
        `${numberValue(summary.rated)} of ${numberValue(summary.total)} responses rated`,
      icon:
        Gauge,
    },
    {
      key:
        "useful",
      label:
        "Useful rate",
      value:
        percentage(
          summary.usefulRatePct
        ),
      description:
        `${numberValue(summary.useful)} useful · ${numberValue(summary.notUseful)} not useful`,
      icon:
        ThumbsUp,
    },
    {
      key:
        "outcomes",
      label:
        "Outcome linkage",
      value:
        percentage(
          summary.outcomeCoveragePct
        ),
      description:
        `${numberValue(summary.outcomesObserved)} responses linked to observed outcomes`,
      icon:
        Link2,
    },
    {
      key:
        "latency",
      label:
        "Average latency",
      value:
        `${numberValue(summary.averageLatencyMs)} ms`,
      description:
        "Mean Adviser response latency",
      icon:
        Activity,
    },
  ];
}

export default function AdviserEvaluationPanel({
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
        <p className="text-sm font-semibold text-stone-600">
          Loading Adviser evaluation evidence…
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
          Adviser evaluation unavailable
        </h2>
        <p className="mt-1 text-sm text-red-800">
          {error}
        </p>
      </section>
    );
  }

  const summary =
    evaluation
      ?.summary;

  if (
    !summary
  ) {
    return null;
  }

  const cards =
    metricCards(
      summary
    );
  const models =
    evaluation.models ||
    [];
  const contexts =
    evaluation.contexts ||
    [];

  return (
    <section
      className="space-y-5"
      aria-labelledby="adviser-evaluation-heading"
    >
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-amber-700">
          Governed AI evaluation
        </p>
        <h2
          id="adviser-evaluation-heading"
          className="mt-1 text-2xl font-bold text-black"
        >
          Adviser quality evidence
        </h2>
        <p className="mt-2 max-w-4xl text-sm text-stone-600">
          Aggregate evaluation for the last {evaluation.period?.days || 30} days. Feedback is evidence for review; it does not automatically retrain, promote or activate an AI model.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(
          ({
            key,
            label,
            value,
            description,
            icon: Icon,
          }) => (
            <article
              key={key}
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
                {description}
              </p>
            </article>
          )
        )}
      </div>

      {models.length ? (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 p-5">
            <h3 className="text-lg font-bold text-black">
              Model and provider evidence
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-stone-50 text-left text-stone-600">
                <tr>
                  <th className="px-5 py-3 font-semibold">
                    Model
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    Provider
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    Responses
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    Feedback
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    Useful
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    Latency
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {models.map(
                  (model) => (
                    <tr
                      key={`${model.modelName}:${model.modelVersion}:${model.provider}`}
                    >
                      <td className="px-5 py-3">
                        <strong className="text-black">
                          {model.modelName}
                        </strong>
                        <div className="text-xs text-stone-500">
                          {model.modelVersion}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-stone-700">
                        {model.provider}
                      </td>
                      <td className="px-5 py-3 text-stone-700">
                        {numberValue(
                          model.total
                        )}
                      </td>
                      <td className="px-5 py-3 text-stone-700">
                        {percentage(
                          model.feedbackCoveragePct
                        )}
                      </td>
                      <td className="px-5 py-3 text-stone-700">
                        {percentage(
                          model.usefulRatePct
                        )}
                      </td>
                      <td className="px-5 py-3 text-stone-700">
                        {numberValue(
                          model.averageLatencyMs
                        )} ms
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {contexts.length ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-black">
            Most-used Adviser contexts
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {contexts.map(
              (context) => (
                <article
                  key={context.contextPath}
                  className="rounded-xl border border-stone-200 p-4"
                >
                  <p className="font-mono text-xs text-stone-500">
                    {context.contextPath}
                  </p>
                  <p className="mt-2 font-bold text-black">
                    {numberValue(
                      context.total
                    )} responses
                  </p>
                  <p className="mt-1 text-xs text-stone-600">
                    {percentage(
                      context.feedbackCoveragePct
                    )} rated · {percentage(
                      context.usefulRatePct
                    )} useful
                  </p>
                </article>
              )
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
