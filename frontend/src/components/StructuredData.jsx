import { useEffect } from "react";

const SITE_ORIGIN = "https://salonai.francescopicardi.co.uk";
const SITE_NAME = "SalonAI";

const SCRIPT_ID = "salonai-structured-data";

const PUBLIC_ROUTES = {
  "/": "Home",
  "/services": "Services",
  "/stylists": "Stylists",
  "/hair-services": "Hair Services",
  "/hair-colour": "Hair Colour",
  "/haircuts-styling": "Haircuts & Styling",
  "/professional-haircare": "Professional Haircare",
  "/book-hair-appointment": "Book a Hair Appointment",
  "/about": "About",
  "/shop": "Shop",
  "/experience": "Experience",
  "/help": "Help Centre",
};

function text(value) {
  return String(value || "").trim();
}

function configuredSalon() {
  return {
    name: text(import.meta.env.VITE_SALON_NAME) || SITE_NAME,
    streetAddress:
      text(import.meta.env.VITE_SALON_STREET_ADDRESS) ||
      text(import.meta.env.VITE_SALON_ADDRESS),
    addressLocality: text(import.meta.env.VITE_SALON_LOCALITY),
    postalCode: text(import.meta.env.VITE_SALON_POSTAL_CODE),
    addressCountry: text(import.meta.env.VITE_SALON_COUNTRY_CODE),
    telephone: text(import.meta.env.VITE_SALON_PHONE),
    googleBusinessUrl: text(import.meta.env.VITE_GOOGLE_BUSINESS_URL),
    sameAs: [
      text(import.meta.env.VITE_INSTAGRAM_URL),
      text(import.meta.env.VITE_FACEBOOK_URL),
      text(import.meta.env.VITE_TIKTOK_URL),
      text(import.meta.env.VITE_YOUTUBE_URL),
    ].filter(Boolean),
  };
}

function normalisePathname(pathname) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.replace(/\/+$/, "") || "/";
}

function absoluteUrl(pathname) {
  const path = normalisePathname(pathname);

  return `${SITE_ORIGIN}${path === "/" ? "/" : path}`;
}

function organisationSchema(salon) {
  const schema = {
    "@type": "Organization",
    "@id": `${SITE_ORIGIN}/#organization`,
    name: salon.name || SITE_NAME,
    url: `${SITE_ORIGIN}/`,
  };

  if (salon.sameAs?.length) {
    schema.sameAs = salon.sameAs;
  }

  return schema;
}

function hairSalonSchema(salon) {
  /*
   * Do not publish LocalBusiness/HairSalon markup until a real public address
   * has been configured. This prevents placeholder or inferred location data
   * becoming search-engine business facts.
   */
  if (!salon.streetAddress) return null;

  const address = {
    "@type": "PostalAddress",
    streetAddress: salon.streetAddress,
  };

  if (salon.addressLocality) address.addressLocality = salon.addressLocality;
  if (salon.postalCode) address.postalCode = salon.postalCode;
  if (salon.addressCountry) address.addressCountry = salon.addressCountry;

  const schema = {
    "@type": ["HairSalon", "LocalBusiness"],
    "@id": `${SITE_ORIGIN}/#hair-salon`,
    name: salon.name || SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    address,
    parentOrganization: {
      "@id": `${SITE_ORIGIN}/#organization`,
    },
  };

  if (salon.telephone) schema.telephone = salon.telephone;
  if (salon.googleBusinessUrl) schema.hasMap = salon.googleBusinessUrl;
  if (salon.sameAs?.length) schema.sameAs = salon.sameAs;

  return schema;
}

function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_ORIGIN}/#website`,
    url: `${SITE_ORIGIN}/`,
    name: SITE_NAME,
    publisher: {
      "@id": `${SITE_ORIGIN}/#organization`,
    },
    inLanguage: "en-GB",
  };
}

function webPageSchema(pathname) {
  const path = normalisePathname(pathname);
  const label = PUBLIC_ROUTES[path];
  if (!label) return null;

  return {
    "@type": "WebPage",
    "@id": `${absoluteUrl(path)}#webpage`,
    url: absoluteUrl(path),
    name: label,
    isPartOf: {
      "@id": `${SITE_ORIGIN}/#website`,
    },
    about: {
      "@id": `${SITE_ORIGIN}/#organization`,
    },
    inLanguage: "en-GB",
  };
}

function breadcrumbSchema(pathname) {
  const path = normalisePathname(pathname);
  const label = PUBLIC_ROUTES[path];

  if (!label || path === "/") {
    return null;
  }

  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(path)}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${SITE_ORIGIN}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: label,
        item: absoluteUrl(path),
      },
    ],
  };
}

export function buildStructuredData(pathname, salonOverride = null) {
  const path = normalisePathname(pathname);

  if (!PUBLIC_ROUTES[path]) {
    return null;
  }

  const salon = salonOverride || configuredSalon();
  const graph = [
    organisationSchema(salon),
    websiteSchema(),
    webPageSchema(path),
  ].filter(Boolean);

  const localBusiness = hairSalonSchema(salon);
  if (localBusiness) graph.push(localBusiness);

  const breadcrumbs = breadcrumbSchema(path);
  if (breadcrumbs) graph.push(breadcrumbs);

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

function removeStructuredData() {
  document
    .getElementById(SCRIPT_ID)
    ?.remove();
}

export default function StructuredData({ pathname }) {
  useEffect(() => {
    const data = buildStructuredData(pathname);

    removeStructuredData();

    if (!data) {
      return removeStructuredData;
    }

    const script = document.createElement("script");

    script.id = SCRIPT_ID;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data);

    document.head.appendChild(script);

    return removeStructuredData;
  }, [pathname]);

  return null;
}
