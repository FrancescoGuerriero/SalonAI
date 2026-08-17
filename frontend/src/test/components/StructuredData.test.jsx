import {
  cleanup,
  render,
  waitFor,
} from "@testing-library/react";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import StructuredData, {
  buildStructuredData,
} from "../../components/StructuredData.jsx";

const SCRIPT_ID =
  "salonai-structured-data";

function structuredDataScript() {
  return document.getElementById(
    SCRIPT_ID
  );
}

function parseStructuredData() {
  const script =
    structuredDataScript();

  return script
    ? JSON.parse(script.textContent)
    : null;
}

afterEach(() => {
  cleanup();

  structuredDataScript()?.remove();
});

describe(
  "Phase 9.2 structured data",
  () => {
    it(
      "builds Organization and WebSite schema for the home page",
      () => {
        const data =
          buildStructuredData("/");

        expect(data?.["@context"]).toBe(
          "https://schema.org"
        );

        expect(
          data?.["@graph"].some(
            (entry) =>
              entry["@type"] ===
              "Organization"
          )
        ).toBe(true);

        expect(
          data?.["@graph"].some(
            (entry) =>
              entry["@type"] ===
              "WebSite"
          )
        ).toBe(true);

        expect(
          data?.["@graph"].some(
            (entry) =>
              entry["@type"] ===
              "BreadcrumbList"
          )
        ).toBe(false);
      }
    );

    it(
      "adds route-aware breadcrumbs to public pages",
      () => {
        const data =
          buildStructuredData(
            "/services/"
          );

        const breadcrumbs =
          data?.["@graph"].find(
            (entry) =>
              entry["@type"] ===
              "BreadcrumbList"
          );

        expect(
          breadcrumbs
            ?.itemListElement
        ).toHaveLength(2);

        expect(
          breadcrumbs
            ?.itemListElement[0]
            ?.name
        ).toBe("Home");

        expect(
          breadcrumbs
            ?.itemListElement[1]
            ?.name
        ).toBe("Services");

        expect(
          breadcrumbs
            ?.itemListElement[1]
            ?.item
        ).toBe(
          "https://salonai.francescopicardi.co.uk/services"
        );
      }
    );

    it(
      "does not generate structured data for private routes",
      () => {
        expect(
          buildStructuredData(
            "/dashboard"
          )
        ).toBeNull();

        expect(
          buildStructuredData(
            "/account"
          )
        ).toBeNull();

        expect(
          buildStructuredData(
            "/login"
          )
        ).toBeNull();
      }
    );

    it(
      "injects one JSON-LD script for public routes",
      async () => {
        render(
          <StructuredData
            pathname="/about"
          />
        );

        await waitFor(() => {
          expect(
            structuredDataScript()
          ).not.toBeNull();
        });

        expect(
          structuredDataScript()?.type
        ).toBe(
          "application/ld+json"
        );

        const data =
          parseStructuredData();

        expect(
          data?.["@context"]
        ).toBe(
          "https://schema.org"
        );

        expect(
          document.querySelectorAll(
            "#salonai-structured-data"
          )
        ).toHaveLength(1);
      }
    );

    it(
      "removes structured data when navigation moves to a private route",
      async () => {
        const view = render(
          <StructuredData
            pathname="/services"
          />
        );

        await waitFor(() => {
          expect(
            structuredDataScript()
          ).not.toBeNull();
        });

        view.rerender(
          <StructuredData
            pathname="/dashboard"
          />
        );

        await waitFor(() => {
          expect(
            structuredDataScript()
          ).toBeNull();
        });
      }
    );

    it(
      "does not publish unverified LocalBusiness fields",
      () => {
        const serialized =
          JSON.stringify(
            buildStructuredData("/")
          );

        expect(serialized).not.toContain(
          '"HairSalon"'
        );

        expect(serialized).not.toContain(
          '"LocalBusiness"'
        );

        expect(serialized).not.toContain(
          '"streetAddress"'
        );

        expect(serialized).not.toContain(
          '"telephone"'
        );

        expect(serialized).not.toContain(
          '"openingHours"'
        );
      }
    );
  }
);
