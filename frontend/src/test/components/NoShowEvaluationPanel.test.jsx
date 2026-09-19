import {
  render,
  screen,
} from "@testing-library/react";
import {
  describe,
  expect,
  it,
} from "vitest";

import NoShowEvaluationPanel from "../../components/ai/NoShowEvaluationPanel.jsx";

describe(
  "NoShowEvaluationPanel",
  () => {
    it(
      "shows governed calibration and drift evidence without automatic lifecycle claims",
      () => {
        render(
          <NoShowEvaluationPanel
            evaluation={{
              period: {
                days:
                  90,
              },
              models: [
                {
                  modelName:
                    "salonai-no-show-risk-rules-v1",
                  modelVersion:
                    "v1",
                  calibration: {
                    sampleCount:
                      40,
                    positiveCount:
                      8,
                    negativeCount:
                      32,
                    observedNoShowRate:
                      0.2,
                    meanPredictedProbability:
                      0.24,
                    brierScore:
                      0.13,
                    expectedCalibrationError:
                      0.07,
                  },
                  drift: {
                    status:
                      "stable",
                    populationStabilityIndex:
                      0.03,
                    meanProbabilityShift:
                      0.01,
                  },
                  lifecycleEvidence: {
                    note:
                      "Evidence is available for human model review; lifecycle changes remain manual.",
                  },
                },
              ],
            }}
          />
        );

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                /no-show calibration and drift/i,
            }
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "40"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "Stable"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            /never automatically promotes/i
          )
        ).toBeInTheDocument();
      }
    );

    it(
      "explains when linked outcomes do not exist yet",
      () => {
        render(
          <NoShowEvaluationPanel
            evaluation={{
              models: [],
            }}
          />
        );

        expect(
          screen.getByText(
            /no linked completed\/no-show outcomes/i
          )
        ).toBeInTheDocument();
      }
    );
  }
);
