import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import Seo from "../../components/Seo.jsx";

function renderSeo(pathname) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Seo />
    </MemoryRouter>
  );
}

function metaByName(name) {
  return document.head.querySelector(`meta[name="${name}"]`);
}

function metaByProperty(property) {
  return document.head.querySelector(
    `meta[property="${property}"]`
  );
}

function canonical() {
  return document.head.querySelector('link[rel="canonical"]');
}

afterEach(() => {
  cleanup();
});

describe("Phase 9.1 SEO foundation", () => {
  it("indexes public service pages with route-specific metadata", async () => {
    renderSeo("/services");

    await waitFor(() => {
      expect(document.title).toBe(
        "Hair Services & Prices | SalonAI"
      );
    });

    expect(metaByName("robots")?.content).toContain(
      "index,follow"
    );

    expect(metaByName("description")?.content).toBe(
      "Explore SalonAI hair services with clear prices, durations and online booking."
    );

    expect(canonical()?.href).toBe(
      "https://salonai.francescopicardi.co.uk/services"
    );

    expect(metaByProperty("og:title")?.content).toBe(
      "Hair Services & Prices | SalonAI"
    );

    expect(metaByProperty("og:url")?.content).toBe(
      "https://salonai.francescopicardi.co.uk/services"
    );

    expect(metaByName("twitter:card")?.content).toBe(
      "summary"
    );
  });

  it("normalises trailing slashes in canonical URLs", async () => {
    renderSeo("/about/");

    await waitFor(() => {
      expect(document.title).toContain("About SalonAI");
    });

    expect(canonical()?.href).toBe(
      "https://salonai.francescopicardi.co.uk/about"
    );

    expect(metaByName("robots")?.content).toContain(
      "index,follow"
    );
  });

  it("keeps login pages publicly accessible but out of search indexes", async () => {
    renderSeo("/login");

    await waitFor(() => {
      expect(document.title).toBe("Sign In | SalonAI");
    });

    expect(metaByName("robots")?.content).toBe(
      "noindex,nofollow,noarchive"
    );

    expect(metaByName("googlebot")?.content).toBe(
      "noindex,nofollow,noarchive"
    );

    expect(canonical()?.href).toBe(
      "https://salonai.francescopicardi.co.uk/login"
    );
  });

  it("keeps management routes out of search indexes", async () => {
    renderSeo("/dashboard");

    await waitFor(() => {
      expect(document.title).toBe(
        "SalonAI Secure Workspace"
      );
    });

    expect(metaByName("robots")?.content).toBe(
      "noindex,nofollow,noarchive"
    );

    expect(canonical()?.href).toBe(
      "https://salonai.francescopicardi.co.uk/dashboard"
    );
  });

  it("keeps dynamic product pages noindex until dynamic SEO is implemented", async () => {
    renderSeo("/shop/example-product");

    await waitFor(() => {
      expect(document.title).toBe(
        "Haircare Product | SalonAI"
      );
    });

    expect(metaByName("robots")?.content).toBe(
      "noindex,nofollow,noarchive"
    );

    expect(canonical()?.href).toBe(
      "https://salonai.francescopicardi.co.uk/shop/example-product"
    );
  });
});
