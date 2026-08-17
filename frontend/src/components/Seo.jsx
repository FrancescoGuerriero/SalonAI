import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import StructuredData from "./StructuredData.jsx";

const SITE_ORIGIN = "https://salonai.francescopicardi.co.uk";
const SITE_NAME = "SalonAI";

const DEFAULT_TITLE =
  "SalonAI | Premium Hair Salon Booking & Haircare";

const DEFAULT_DESCRIPTION =
  "Discover salon services, professional stylists, online booking and salon-quality haircare with SalonAI.";

const INDEX_ROBOTS =
  "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

const NOINDEX_ROBOTS =
  "noindex,nofollow,noarchive";

const PUBLIC_METADATA = {
  "/": {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },

  "/services": {
    title: "Hair Services & Prices | SalonAI",
    description:
      "Explore SalonAI hair services with clear prices, durations and online booking.",
  },

  "/stylists": {
    title: "Meet the Salon Team | SalonAI",
    description:
      "Meet SalonAI stylists, explore their specialties and choose the right professional for your appointment.",
  },

  "/about": {
    title:
      "About SalonAI | Hair Professionals & Connected Salon Care",
    description:
      "Learn about SalonAI, meet published salon professionals and discover connected booking, profiles and professional haircare.",
  },

  "/shop": {
    title:
      "Professional Haircare Shop | SalonAI",
    description:
      "Shop professional haircare products selected to support healthy, manageable hair between salon visits.",
  },

  "/experience": {
    title:
      "Your Connected Salon Experience | SalonAI",
    description:
      "Plan your salon visit with services, stylists, appointment booking, haircare and customer support.",
  },

  "/help": {
    title: "SalonAI Help Centre",
    description:
      "Get help with salon bookings, accounts, orders, payments and customer support.",
  },
};

const PUBLIC_NOINDEX_METADATA = {
  "/login": {
    title: "Sign In | SalonAI",
    description:
      "Sign in securely to manage SalonAI appointments, orders and customer preferences.",
  },

  "/register": {
    title: "Create a SalonAI Account",
    description:
      "Create a SalonAI customer account for appointments, orders and personalised salon care.",
  },

  "/cart": {
    title: "Shopping Cart | SalonAI",
    description:
      "Review the professional haircare products currently in your SalonAI shopping cart.",
  },
};

const PRIVATE_METADATA = {
  title: "SalonAI Secure Workspace",
  description:
    "Secure SalonAI customer, staff and salon-management workspace.",
};

function normalisePathname(pathname) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.replace(/\/+$/, "") || "/";
}

function toCanonicalUrl(pathname) {
  const normalisedPath =
    normalisePathname(pathname);

  return `${SITE_ORIGIN}${
    normalisedPath === "/"
      ? "/"
      : normalisedPath
  }`;
}

function upsertNamedMeta(name, content) {
  let element =
    document.head.querySelector(
      `meta[name="${name}"]`
    );

  if (!element) {
    element =
      document.createElement("meta");

    element.setAttribute("name", name);

    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function upsertPropertyMeta(
  property,
  content
) {
  let element =
    document.head.querySelector(
      `meta[property="${property}"]`
    );

  if (!element) {
    element =
      document.createElement("meta");

    element.setAttribute(
      "property",
      property
    );

    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function upsertCanonical(href) {
  let element =
    document.head.querySelector(
      'link[rel="canonical"]'
    );

  if (!element) {
    element =
      document.createElement("link");

    element.setAttribute(
      "rel",
      "canonical"
    );

    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
}

function resolveSeo(pathname) {
  const path =
    normalisePathname(pathname);

  const publicMetadata =
    PUBLIC_METADATA[path];

  if (publicMetadata) {
    return {
      ...publicMetadata,
      indexable: true,
      canonicalPath: path,
    };
  }

  const publicNoindexMetadata =
    PUBLIC_NOINDEX_METADATA[path];

  if (publicNoindexMetadata) {
    return {
      ...publicNoindexMetadata,
      indexable: false,
      canonicalPath: path,
    };
  }

  /*
   * Product detail pages remain noindex until
   * product-specific metadata and Product JSON-LD
   * can be generated from verified product data.
   */
  if (path.startsWith("/shop/")) {
    return {
      title:
        "Haircare Product | SalonAI",
      description:
        "View professional haircare product information from SalonAI.",
      indexable: false,
      canonicalPath: path,
    };
  }

  return {
    ...PRIVATE_METADATA,
    indexable: false,
    canonicalPath: path,
  };
}

export default function Seo() {
  const location = useLocation();

  useEffect(() => {
    const seo =
      resolveSeo(location.pathname);

    const canonicalUrl =
      toCanonicalUrl(
        seo.canonicalPath
      );

    const robots =
      seo.indexable
        ? INDEX_ROBOTS
        : NOINDEX_ROBOTS;

    document.title = seo.title;

    upsertNamedMeta(
      "description",
      seo.description
    );

    upsertNamedMeta(
      "robots",
      robots
    );

    upsertNamedMeta(
      "googlebot",
      robots
    );

    upsertCanonical(canonicalUrl);

    upsertPropertyMeta(
      "og:site_name",
      SITE_NAME
    );

    upsertPropertyMeta(
      "og:type",
      "website"
    );

    upsertPropertyMeta(
      "og:title",
      seo.title
    );

    upsertPropertyMeta(
      "og:description",
      seo.description
    );

    upsertPropertyMeta(
      "og:url",
      canonicalUrl
    );

    upsertNamedMeta(
      "twitter:card",
      "summary"
    );

    upsertNamedMeta(
      "twitter:title",
      seo.title
    );

    upsertNamedMeta(
      "twitter:description",
      seo.description
    );
  }, [location.pathname]);

  return (
    <StructuredData
      pathname={location.pathname}
    />
  );
}
