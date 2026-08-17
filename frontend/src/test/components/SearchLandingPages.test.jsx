import {
  render,
  screen,
} from "@testing-library/react";

import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";

import {
  describe,
  expect,
  it,
} from "vitest";

import SearchLandingPage, {
  SEARCH_LANDING_PAGES,
} from "../../pages/SearchLandingPage.jsx";

import {
  buildStructuredData,
} from "../../components/StructuredData.jsx";

function renderLanding(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={<SearchLandingPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe(
  "Phase 9.3 search landing pages",
  () => {
    it(
      "defines five unique search landing pages",
      () => {
        expect(
          Object.keys(
            SEARCH_LANDING_PAGES
          )
        ).toEqual([
          "/hair-services",
          "/hair-colour",
          "/haircuts-styling",
          "/professional-haircare",
          "/book-hair-appointment",
        ]);

        const titles =
          Object.values(
            SEARCH_LANDING_PAGES
          ).map(
            (page) => page.title
          );

        expect(
          new Set(titles).size
        ).toBe(5);
      }
    );

    it(
      "renders hair colour search intent content",
      () => {
        renderLanding(
          "/hair-colour"
        );

        expect(
          screen.getByRole(
            "heading",
            {
              level: 1,
              name:
                "Hair Colour, Highlights & Balayage",
            }
          )
        ).toBeTruthy();

        expect(
          screen.getByRole(
            "link",
            {
              name:
                "Explore colour services",
            }
          ).getAttribute("href")
        ).toBe("/services");
      }
    );

    it(
      "renders booking landing content without bypassing the secure booking flow",
      () => {
        renderLanding(
          "/book-hair-appointment"
        );

        expect(
          screen.getByRole(
            "heading",
            {
              level: 1,
              name:
                "Book a Hair Appointment",
            }
          )
        ).toBeTruthy();

        expect(
          screen.getByRole(
            "link",
            {
              name:
                "Choose a service",
            }
          ).getAttribute("href")
        ).toBe("/services");
      }
    );

    it(
      "provides structured breadcrumbs for every search landing page",
      () => {
        for (
          const path of
          Object.keys(
            SEARCH_LANDING_PAGES
          )
        ) {
          const data =
            buildStructuredData(
              path
            );

          expect(data).not.toBeNull();

          expect(
            data["@graph"].some(
              (item) =>
                item["@type"] ===
                "BreadcrumbList"
            )
          ).toBe(true);
        }
      }
    );
  }
);
