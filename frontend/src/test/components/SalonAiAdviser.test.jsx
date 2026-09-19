import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  askSalonAiAdviser,
  submitSalonAiAdviserFeedback,
} = vi.hoisted(() => ({
  askSalonAiAdviser:
    vi.fn(),
  submitSalonAiAdviserFeedback:
    vi.fn(),
}));

vi.mock(
  "../../Services/aiAdviserService.js",
  () => ({
    askSalonAiAdviser,
    submitSalonAiAdviserFeedback,
  })
);

import SalonAiAdviser from "../../components/ai/SalonAiAdviser.jsx";

describe(
  "SalonAiAdviser feedback",
  () => {
    beforeEach(() => {
      askSalonAiAdviser
        .mockReset();
      submitSalonAiAdviserFeedback
        .mockReset();

      askSalonAiAdviser
        .mockResolvedValue({
          answer:
            "No-show evidence is available.",
          inferenceId:
            "507f1f77bcf86cd799439011",
          evidence: {
            periodLabel:
              "Last 30 days",
            domainContext: {
              sections: [],
            },
            knowledge: [],
          },
          adviser: {
            provider:
              "local",
          },
        });

      submitSalonAiAdviserFeedback
        .mockResolvedValue({
          success: true,
          inferenceId:
            "507f1f77bcf86cd799439011",
          feedback: {
            rating: 1,
            useful: true,
          },
        });
    });

    it(
      "submits useful feedback for the exact returned inference",
      async () => {
        const user =
          userEvent.setup();

        render(
          <SalonAiAdviser
            contextPath="/calendar"
          />
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /ask salonai/i,
            }
          )
        );

        await user.type(
          screen.getByLabelText(
            /ask salonai/i
          ),
          "Why are no-shows increasing?"
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name: "Ask",
            }
          )
        );

        expect(
          await screen.findByText(
            "No-show evidence is available."
          )
        ).toBeInTheDocument();

        const usefulButton =
          screen.getByRole(
            "button",
            {
              name:
                /mark salonai answer useful/i,
            }
          );

        expect(
          usefulButton
        ).toHaveAttribute(
          "aria-pressed",
          "false"
        );

        await user.click(
          usefulButton
        );

        await waitFor(
          () => {
            expect(
              submitSalonAiAdviserFeedback
            ).toHaveBeenCalledWith(
              {
                inferenceId:
                  "507f1f77bcf86cd799439011",
                rating: 1,
              }
            );
          }
        );

        expect(
          await screen.findByText(
            /feedback saved/i
          )
        ).toBeInTheDocument();

        expect(
          usefulButton
        ).toHaveAttribute(
          "aria-pressed",
          "true"
        );
      }
    );
  }
);
