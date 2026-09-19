import AiModelVersion from "./AiModelVersion.js";

const TASK =
  "no_show_prediction";
const MODEL_NAME =
  "salonai-no-show-risk-ml";
const RULES_MODEL_NAME =
  "salonai-no-show-risk-rules-v1";

function finiteNumber(
  value
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

function metricSet(
  source = {}
) {
  return {
    rocAuc:
      finiteNumber(
        source.roc_auc
      ),
    prAuc:
      finiteNumber(
        source.pr_auc
      ),
    brierScore:
      finiteNumber(
        source.brier_score
      ),
    precision:
      finiteNumber(
        source.precision
      ),
    recall:
      finiteNumber(
        source.recall
      ),
    threshold:
      finiteNumber(
        source.threshold
      ),
  };
}

function beatsRules(
  test,
  rules
) {
  return (
    test.prAuc !== null &&
    rules.prAuc !== null &&
    test.brierScore !== null &&
    rules.brierScore !== null &&
    test.prAuc >
      rules.prAuc &&
    test.brierScore <=
      rules.brierScore
  );
}

export function normaliseNoShowModelEvidence(
  model
) {
  if (
    !model ||
    model.task !== TASK
  ) {
    return null;
  }

  const test =
    metricSet(
      model.metrics?.test
    );
  const rules =
    metricSet(
      model.metrics
        ?.baseline
        ?.rules_test
    );
  const lifecycle =
    String(
      model.lifecycle ||
        "experiment"
    ).trim();

  return {
    task: TASK,
    modelName:
      String(
        model.name ||
          MODEL_NAME
      ),
    modelVersion:
      String(
        model.version ||
          ""
      ),
    lifecycle,
    productionActive:
      lifecycle ===
      "production",
    experimental:
      lifecycle !==
      "production",
    featureVersion:
      String(
        model.featureVersion ||
          ""
      ),
    algorithm:
      String(
        model.algorithm ||
          ""
      ),
    testMetrics: test,
    rulesBaseline: {
      modelName:
        String(
          model.metrics
            ?.baseline
            ?.rules_model ||
            RULES_MODEL_NAME
        ),
      metrics: rules,
    },
    comparison: {
      beatsRulesBaseline:
        beatsRules(
          test,
          rules
        ),
    },
    limitations:
      Array.isArray(
        model.limitations
      )
        ? model.limitations
            .map((value) =>
              String(
                value || ""
              ).trim()
            )
            .filter(Boolean)
            .slice(0, 8)
        : [],
    updatedAt:
      model.updatedAt ||
      null,
  };
}

export async function latestNoShowModelEvidence() {
  const model =
    await AiModelVersion.findOne({
      name: MODEL_NAME,
      task: TASK,
      lifecycle: {
        $in: [
          "experiment",
          "candidate",
          "approved",
          "production",
        ],
      },
    })
      .sort({
        updatedAt: -1,
        _id: -1,
      })
      .select(
        "name version task lifecycle featureVersion algorithm metrics thresholds limitations updatedAt"
      )
      .lean();

  return normaliseNoShowModelEvidence(
    model
  );
}

export default {
  latestNoShowModelEvidence,
  normaliseNoShowModelEvidence,
};
