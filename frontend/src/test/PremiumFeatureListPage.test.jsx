import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import PremiumFeatureListPage from "../components/premium/PremiumFeatureListPage.jsx";
import {
  getPremiumFeatureData,
} from "../Services/premiumFeaturesService.js";

vi.mock(
  "../Services/premiumFeaturesService.js",
  () => ({
    getPremiumFeatureData:
      vi.fn(),
  })
);

describe(
  "PremiumFeatureListPage",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(
      "loads the configured endpoint and renders the configured record collection",
      async () => {
        getPremiumFeatureData.mockResolvedValue({
          accounts: [
            {
              _id: "loyalty-1",
              name:
                "Francesco",
              tier:
                "Gold",
            },
          ],
        });

        render(
          <PremiumFeatureListPage
            title="Loyalty Programme"
            endpoint="/loyalty"
            recordsKey="accounts"
          />
        );

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Loyalty Programme",
            }
          )
        ).toBeInTheDocument();

        expect(
          await screen.findByText(
            "Francesco"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Gold"
          )
        ).toBeInTheDocument();

        expect(
          getPremiumFeatureData
        ).toHaveBeenCalledWith(
          "/loyalty"
        );
      }
    );

    it(
      "refreshes through the same authoritative endpoint",
      async () => {
        getPremiumFeatureData.mockResolvedValue({
          rules: [],
        });

        render(
          <PremiumFeatureListPage
            title="SMS Reminders"
            endpoint="/sms/rules"
            recordsKey="rules"
          />
        );

        await waitFor(
          () =>
            expect(
              getPremiumFeatureData
            ).toHaveBeenCalledTimes(
              1
            )
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh",
            }
          )
        );

        await waitFor(
          () =>
            expect(
              getPremiumFeatureData
            ).toHaveBeenCalledTimes(
              2
            )
        );
      }
    );

    it(
      "shows the shared empty state when a configured collection has no records",
      async () => {
        getPremiumFeatureData.mockResolvedValue({
          campaigns: [],
        });

        render(
          <PremiumFeatureListPage
            title="Email Campaigns"
            endpoint="/email-campaigns"
            recordsKey="campaigns"
          />
        );

        expect(
          await screen.findByText(
            "No records found."
          )
        ).toBeInTheDocument();
      }
    );
  }
);
