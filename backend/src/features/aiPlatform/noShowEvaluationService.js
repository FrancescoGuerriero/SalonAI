import AiInferenceLog from "./AiInferenceLog.js";
import {
  NO_SHOW_INFERENCE_CAPABILITY,
} from "./noShowInferenceLedgerService.js";

const DEFAULT_PERIOD_DAYS =
  90;
const MAX_PERIOD_DAYS =
  365;
const MIN_REVIEW_SAMPLE =
  30;
const MAX_ROWS =
  20000;
const CALIBRATION_BINS =
  5;
const EPSILON =
  0.0001;

function finiteNumber(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

function clampProbability(
  value
) {
  return Math.max(
    0,
    Math.min(
      1,
      finiteNumber(
        value
      )
    )
  );
}

export function clampNoShowEvaluationPeriodDays(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return DEFAULT_PERIOD_DAYS;
  }

  return Math.max(
    7,
    Math.min(
      MAX_PERIOD_DAYS,
      Math.trunc(
        number
      )
    )
  );
}

function round(
  value,
  places = 4
) {
  const number =
    finiteNumber(
      value
    );
  const factor =
    10 **
    places;

  return (
    Math.round(
      number *
      factor
    ) /
    factor
  );
}

function labelledRows(
  rows = []
) {
  return rows
    .map(
      (row) => {
        const probability =
          Number(
            row?.prediction
              ?.probability
          );
        const label =
          Number(
            row?.outcome
              ?.noShowLabel
          );

        if (
          !Number.isFinite(
            probability
          ) ||
          ![
            0,
            1,
          ].includes(
            label
          )
        ) {
          return null;
        }

        return {
          probability:
            clampProbability(
              probability
            ),
          label,
          riskLevel:
            String(
              row?.prediction
                ?.riskLevel ||
                ""
            ).trim(),
        };
      }
    )
    .filter(Boolean);
}

export function calibrationMetrics(
  rows = []
) {
  const labelled =
    labelledRows(
      rows
    );
  const sampleCount =
    labelled.length;

  if (
    sampleCount ===
    0
  ) {
    return {
      sampleCount:
        0,
      positiveCount:
        0,
      negativeCount:
        0,
      meanPredictedProbability:
        0,
      observedNoShowRate:
        0,
      brierScore:
        null,
      expectedCalibrationError:
        null,
      bins: [],
    };
  }

  const positiveCount =
    labelled.reduce(
      (
        total,
        item
      ) =>
        total +
        item.label,
      0
    );
  const sumProbability =
    labelled.reduce(
      (
        total,
        item
      ) =>
        total +
        item.probability,
      0
    );
  const brier =
    labelled.reduce(
      (
        total,
        item
      ) =>
        total +
        (
          item.probability -
          item.label
        ) **
          2,
      0
    ) /
    sampleCount;

  const bins =
    Array.from(
      {
        length:
          CALIBRATION_BINS,
      },
      (
        _,
        index
      ) => ({
        index,
        lower:
          index /
          CALIBRATION_BINS,
        upper:
          (
            index +
            1
          ) /
          CALIBRATION_BINS,
        rows: [],
      })
    );

  for (
    const item of
    labelled
  ) {
    const index =
      Math.min(
        CALIBRATION_BINS -
          1,
        Math.floor(
          item.probability *
            CALIBRATION_BINS
        )
      );

    bins[index]
      .rows.push(
        item
      );
  }

  let calibrationError =
    0;

  const resultBins =
    bins.map(
      (bin) => {
        const count =
          bin.rows.length;

        if (
          count ===
          0
        ) {
          return {
            lower:
              round(
                bin.lower,
                2
              ),
            upper:
              round(
                bin.upper,
                2
              ),
            count:
              0,
            meanPrediction:
              null,
            observedRate:
              null,
            absoluteGap:
              null,
          };
        }

        const meanPrediction =
          bin.rows.reduce(
            (
              total,
              item
            ) =>
              total +
              item.probability,
            0
          ) /
          count;
        const observedRate =
          bin.rows.reduce(
            (
              total,
              item
            ) =>
              total +
              item.label,
            0
          ) /
          count;
        const absoluteGap =
          Math.abs(
            meanPrediction -
            observedRate
          );

        calibrationError +=
          (
            count /
            sampleCount
          ) *
          absoluteGap;

        return {
          lower:
            round(
              bin.lower,
              2
            ),
          upper:
            round(
              bin.upper,
              2
            ),
          count,
          meanPrediction:
            round(
              meanPrediction
            ),
          observedRate:
            round(
              observedRate
            ),
          absoluteGap:
            round(
              absoluteGap
            ),
        };
      }
    );

  return {
    sampleCount,
    positiveCount,
    negativeCount:
      sampleCount -
      positiveCount,
    meanPredictedProbability:
      round(
        sumProbability /
          sampleCount
      ),
    observedNoShowRate:
      round(
        positiveCount /
          sampleCount
      ),
    brierScore:
      round(
        brier
      ),
    expectedCalibrationError:
      round(
        calibrationError
      ),
    bins:
      resultBins,
  };
}

function distribution(
  rows = []
) {
  const labelled =
    labelledRows(
      rows
    );
  const counts =
    Array(
      CALIBRATION_BINS
    ).fill(
      0
    );

  for (
    const item of
    labelled
  ) {
    const index =
      Math.min(
        CALIBRATION_BINS -
          1,
        Math.floor(
          item.probability *
            CALIBRATION_BINS
        )
      );

    counts[index] +=
      1;
  }

  const total =
    Math.max(
      1,
      labelled.length
    );

  return counts.map(
    (count) =>
      Math.max(
        EPSILON,
        count /
          total
      )
  );
}

export function probabilityDriftMetrics({
  current = [],
  reference = [],
} = {}) {
  const currentCalibration =
    calibrationMetrics(
      current
    );
  const referenceCalibration =
    calibrationMetrics(
      reference
    );

  if (
    currentCalibration
      .sampleCount <
      MIN_REVIEW_SAMPLE ||
    referenceCalibration
      .sampleCount <
      MIN_REVIEW_SAMPLE
  ) {
    return {
      status:
        "insufficient_data",
      populationStabilityIndex:
        null,
      meanProbabilityShift:
        null,
      currentSampleCount:
        currentCalibration
          .sampleCount,
      referenceSampleCount:
        referenceCalibration
          .sampleCount,
      reviewRequired:
        false,
    };
  }

  const currentDistribution =
    distribution(
      current
    );
  const referenceDistribution =
    distribution(
      reference
    );

  const psi =
    currentDistribution.reduce(
      (
        total,
        currentShare,
        index
      ) => {
        const referenceShare =
          referenceDistribution[
            index
          ];

        return (
          total +
          (
            currentShare -
            referenceShare
          ) *
            Math.log(
              currentShare /
                referenceShare
            )
        );
      },
      0
    );

  const shift =
    currentCalibration
      .meanPredictedProbability -
    referenceCalibration
      .meanPredictedProbability;
  const absoluteShift =
    Math.abs(
      shift
    );

  const status =
    psi >= 0.25 ||
    absoluteShift >=
      0.1
      ? "significant_shift"
      : psi >= 0.1 ||
          absoluteShift >=
            0.05
        ? "review"
        : "stable";

  return {
    status,
    populationStabilityIndex:
      round(
        psi
      ),
    meanProbabilityShift:
      round(
        shift
      ),
    currentSampleCount:
      currentCalibration
        .sampleCount,
    referenceSampleCount:
      referenceCalibration
        .sampleCount,
    reviewRequired:
      status !==
      "stable",
  };
}

export function buildNoShowModelEvaluation({
  modelName,
  modelVersion,
  current = [],
  reference = [],
} = {}) {
  const calibration =
    calibrationMetrics(
      current
    );
  const referenceCalibration =
    calibrationMetrics(
      reference
    );
  const drift =
    probabilityDriftMetrics({
      current,
      reference,
    });

  const reviewReady =
    calibration
      .sampleCount >=
    MIN_REVIEW_SAMPLE;

  return {
    modelName:
      String(
        modelName ||
          ""
      ),
    modelVersion:
      String(
        modelVersion ||
          ""
      ),
    calibration,
    referenceCalibration,
    drift,
    lifecycleEvidence: {
      reviewReady,
      minimumReviewSample:
        MIN_REVIEW_SAMPLE,
      automaticPromotion:
        false,
      automaticActivation:
        false,
      note:
        reviewReady
          ? "Evidence is available for human model review; lifecycle changes remain manual."
          : `At least ${MIN_REVIEW_SAMPLE} labelled outcomes are required before model review evidence is considered mature.`,
    },
  };
}

export async function getNoShowModelEvaluation({
  periodDays =
    DEFAULT_PERIOD_DAYS,
  now =
    new Date(),
} = {}) {
  const days =
    clampNoShowEvaluationPeriodDays(
      periodDays
    );
  const to =
    new Date(
      now
    );
  const currentFrom =
    new Date(
      to.getTime() -
        days *
          86400000
    );
  const referenceFrom =
    new Date(
      currentFrom.getTime() -
        days *
          86400000
    );

  const rows =
    await AiInferenceLog.find({
      capability:
        NO_SHOW_INFERENCE_CAPABILITY,
      "outcome.evaluationEligible":
        true,
      outcomeObservedAt: {
        $gte:
          referenceFrom,
        $lte:
          to,
      },
    })
      .select(
        "modelName modelVersion prediction.probability prediction.riskLevel outcome.noShowLabel outcomeObservedAt"
      )
      .sort({
        outcomeObservedAt:
          -1,
      })
      .limit(
        MAX_ROWS
      )
      .lean();

  const groups =
    new Map();

  for (
    const row of
    rows
  ) {
    const modelName =
      String(
        row.modelName ||
          ""
      );
    const modelVersion =
      String(
        row.modelVersion ||
          ""
      );
    const key =
      `${modelName}::${modelVersion}`;

    if (
      !groups.has(
        key
      )
    ) {
      groups.set(
        key,
        {
          modelName,
          modelVersion,
          current: [],
          reference: [],
        }
      );
    }

    const observedAt =
      new Date(
        row.outcomeObservedAt
      );
    const target =
      observedAt >=
      currentFrom
        ? "current"
        : "reference";

    groups.get(
      key
    )[
      target
    ].push(
      row
    );
  }

  const models =
    Array.from(
      groups.values()
    )
      .map(
        (group) =>
          buildNoShowModelEvaluation(
            group
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          b.calibration
            .sampleCount -
          a.calibration
            .sampleCount
      );

  return {
    capability:
      NO_SHOW_INFERENCE_CAPABILITY,
    period: {
      days,
      currentFrom:
        currentFrom.toISOString(),
      referenceFrom:
        referenceFrom.toISOString(),
      to:
        to.toISOString(),
    },
    rowsRead:
      rows.length,
    truncated:
      rows.length >=
      MAX_ROWS,
    models,
    governance: {
      aggregateOnly:
        true,
      containsCustomerIdentifiers:
        false,
      automaticTraining:
        false,
      automaticPromotion:
        false,
      automaticActivation:
        false,
      thresholdsAreInternalHeuristics:
        true,
    },
  };
}

export default {
  buildNoShowModelEvaluation,
  calibrationMetrics,
  clampNoShowEvaluationPeriodDays,
  getNoShowModelEvaluation,
  probabilityDriftMetrics,
};
