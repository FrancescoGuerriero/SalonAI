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
  "Point 10 structured data",
  () => {
    it(
      "builds Organization WebSite and WebPage schema for the home page",
      () => {
        const data =
          buildStructuredData("/");

        expect(data?.["@context"]).toBe(
          "https://schema.org"
        );

        for (const type of ["Organization", "WebSite", "WebPage"]) {
          expect(
            data?.["@graph"].some(
              (entry) => entry["@type"] === type
            )
          ).toBe(true);
        }

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
      "does not publish LocalBusiness fields when no public salon address is configured",
      () => {
        const serialized = JSON.stringify(
          buildStructuredData("/", {
            name: "SalonAI",
            streetAddress: "",
            addressLocality: "",
            postalCode: "",
            addressCountry: "",
            telephone: "",
            googleBusinessUrl: "",
            sameAs: [],
          })
        );

        expect(serialized).not.toContain('"HairSalon"');
        expect(serialized).not.toContain('"LocalBusiness"');
        expect(serialized).not.toContain('"streetAddress"');
        expect(serialized).not.toContain('"telephone"');
        expect(serialized).not.toContain('"openingHours"');
      }
    );

    it(
      "publishes HairSalon and LocalBusiness only from explicitly configured public facts",
      () => {
        const data = buildStructuredData("/", {
          name: "Example Salon",
          streetAddress: "10 Example Street",
          addressLocality: "London",
          postalCode: "E1 1AA",
          addressCountry: "GB",
          telephone: "+442000000000",
          googleBusinessUrl: "https://www.google.com/maps/example",
          sameAs: ["https://www.instagram.com/example"],
        });

        const salon = data?.["@graph"].find(
          (entry) => Array.isArray(entry["@type"]) && entry["@type"].includes("HairSalon")
        );

        expect(salon?.["@type"]).toEqual(["HairSalon", "LocalBusiness"]);
        expect(salon?.name).toBe("Example Salon");
        expect(salon?.address?.streetAddress).toBe("10 Example Street");
        expect(salon?.address?.addressLocality).toBe("London");
        expect(salon?.address?.postalCode).toBe("E1 1AA");
        expect(salon?.address?.addressCountry).toBe("GB");
        expect(salon?.telephone).toBe("+442000000000");
        expect(salon?.hasMap).toBe("https://www.google.com/maps/example");
        expect(salon?.sameAs).toContain("https://www.instagram.com/example");
        expect(JSON.stringify(salon)).not.toContain("openingHours");
        expect(JSON.stringify(salon)).not.toContain("aggregateRating");
      }
    );
  }
);
