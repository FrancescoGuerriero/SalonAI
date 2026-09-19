import {
  render,
  screen,
} from "@testing-library/react";
import {
  describe,
  expect,
  it,
} from "vitest";

import AdviserEvaluationPanel from "../../components/ai/AdviserEvaluationPanel.jsx";

describe(
  "AdviserEvaluationPanel",
  () => {
    it(
      "shows aggregate feedback and governance evidence",
      () => {
        render(
          <AdviserEvaluationPanel
            evaluation={{
              period: {
                days:
                  30,
              },
              summary: {
                total:
                  20,
                rated:
                  10,
                useful:
                  8,
                notUseful:
                  2,
                outcomesObserved:
                  5,
                feedbackCoveragePct:
                  50,
                usefulRatePct:
                  80,
                outcomeCoveragePct:
                  25,
                averageLatencyMs:
                  126,
              },
              models: [
                {
                  modelName:
                    "salonai-adviser-grounded",
                  modelVersion:
                    "v2-readonly-1",
                  provider:
                    "local",
                  total:
                    20,
                  feedbackCoveragePct:
                    50,
                  usefulRatePct:
                    80,
                  averageLatencyMs:
                    126,
                },
              ],
              contexts: [
                {
                  contextPath:
                    "/calendar",
                  total:
                    8,
                  feedbackCoveragePct:
                    50,
                  usefulRatePct:
                    75,
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
                /adviser quality evidence/i,
            }
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "50.0%"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "80.0%"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            /does not automatically retrain/i
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "/calendar"
          )
        ).toBeInTheDocument();
      }
    );
  }
);
