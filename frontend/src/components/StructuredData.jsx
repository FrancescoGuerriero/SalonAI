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

function organisationSchema() {
  return {
    "@type": "Organization",
    "@id": `${SITE_ORIGIN}/#organization`,
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
  };
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

export function buildStructuredData(pathname) {
  const path = normalisePathname(pathname);

  if (!PUBLIC_ROUTES[path]) {
    return null;
  }

  const graph = [
    organisationSchema(),
    websiteSchema(),
  ];

  const breadcrumbs = breadcrumbSchema(path);

  if (breadcrumbs) {
    graph.push(breadcrumbs);
  }

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

export default function StructuredData({
  pathname,
}) {
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
