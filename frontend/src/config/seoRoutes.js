export const SITE_ORIGIN =
  "https://salonai.francescopicardi.co.uk";

export const DEFAULT_SEO =
  Object.freeze({
    title:
      "SalonAI | Premium Hair Salon Booking & Haircare",
    description:
      "Discover salon services, professional stylists, online booking and salon-quality haircare with SalonAI.",
    robots:
      "noindex,nofollow",
  });

export const PUBLIC_SEO_ROUTES =
  Object.freeze([
    {
      path: "/",
      title:
        "SalonAI | Premium Hair Salon Booking & Haircare",
      description:
        "Discover salon services, professional stylists, online booking and salon-quality haircare with SalonAI.",
      changefreq:
        "weekly",
      priority:
        1,
    },
    {
      path: "/services",
      title:
        "Hair Salon Services | SalonAI",
      description:
        "Explore professional hair salon services, treatments, styling and colour services available through SalonAI.",
      changefreq:
        "weekly",
      priority:
        0.9,
    },
    {
      path: "/hair-services",
      title:
        "Professional Hair Services | SalonAI",
      description:
        "Discover professional hair services and salon treatments, then find the right service for your next appointment.",
      changefreq:
        "weekly",
      priority:
        0.9,
    },
    {
      path: "/hair-colour",
      title:
        "Hair Colour Services | SalonAI",
      description:
        "Explore professional hair colour services and find salon booking options with SalonAI.",
      changefreq:
        "weekly",
      priority:
        0.9,
    },
    {
      path: "/haircuts-styling",
      title:
        "Haircuts & Styling | SalonAI",
      description:
        "Explore professional haircuts and styling services and book your next salon appointment with SalonAI.",
      changefreq:
        "weekly",
      priority:
        0.9,
    },
    {
      path: "/book-hair-appointment",
      title:
        "Book a Hair Appointment | SalonAI",
      description:
        "Find salon services and professional stylists, then book your hair appointment online with SalonAI.",
      changefreq:
        "weekly",
      priority:
        0.9,
    },
    {
      path: "/stylists",
      title:
        "Professional Hair Stylists | SalonAI",
      description:
        "Meet professional hair stylists, explore their profiles and find the right stylist for your appointment.",
      changefreq:
        "weekly",
      priority:
        0.8,
    },
    {
      path: "/shop",
      title:
        "Professional Haircare Shop | SalonAI",
      description:
        "Shop salon-quality professional haircare products available through SalonAI.",
      changefreq:
        "weekly",
      priority:
        0.8,
    },
    {
      path: "/professional-haircare",
      title:
        "Professional Haircare | SalonAI",
      description:
        "Explore professional haircare, salon-quality products and expert-led recommendations with SalonAI.",
      changefreq:
        "weekly",
      priority:
        0.8,
    },
    {
      path: "/about",
      title:
        "About SalonAI",
      description:
        "Learn about SalonAI and its salon services, customer experience and technology-enabled booking platform.",
      changefreq:
        "monthly",
      priority:
        0.7,
    },
    {
      path: "/experience",
      title:
        "Salon Experience | SalonAI",
      description:
        "Explore the SalonAI customer experience, salon services and digital features available to clients.",
      changefreq:
        "monthly",
      priority:
        0.7,
    },
    {
      path: "/help",
      title:
        "Help Centre | SalonAI",
      description:
        "Get help with SalonAI services, bookings, accounts and online salon features.",
      changefreq:
        "monthly",
      priority:
        0.6,
    },
  ]);

export const DYNAMIC_PUBLIC_SEO_ROUTES =
  Object.freeze([
    {
      pattern:
        /^\/shop\/[^/]+$/,
      title:
        "Professional Haircare Product | SalonAI",
      description:
        "View professional salon-quality haircare product information and shopping options with SalonAI.",
    },
  ]);

export const PRIVATE_ROUTE_PREFIXES =
  Object.freeze([
    "/account",
    "/settings",
    "/checkout",
    "/orders",
    "/cart",
    "/booking",
    "/dashboard",
    "/customers",
    "/appointments",
    "/calendar",
    "/waitlist",
    "/reports",
    "/manage",
    "/admin",
    "/staff",
    "/team-availability",
    "/communications",
    "/communication-",
    "/scheduled-communications",
    "/message-delivery",
    "/ai",
    "/data-",
    "/purchase-orders",
    "/suppliers",
    "/reorder-recommendations",
  ]);

function normalisePathname(
  pathname = "/"
) {
  const raw =
    String(pathname || "/")
      .split("?")[0]
      .split("#")[0];

  if (!raw.startsWith("/")) {
    return normalisePathname(
      `/${raw}`
    );
  }

  if (raw === "/") {
    return raw;
  }

  return raw.replace(/\/+$/, "");
}

export function canonicalUrlForPath(
  pathname
) {
  return `${SITE_ORIGIN}${normalisePathname(pathname)}`;
}

export function seoForPath(
  pathname
) {
  const path =
    normalisePathname(
      pathname
    );

  const exact =
    PUBLIC_SEO_ROUTES.find(
      (route) =>
        route.path === path
    );

  if (exact) {
    return {
      ...exact,
      canonical:
        canonicalUrlForPath(
          path
        ),
      robots:
        "index,follow,max-image-preview:large",
      indexable:
        true,
    };
  }

  const dynamic =
    DYNAMIC_PUBLIC_SEO_ROUTES.find(
      (route) =>
        route.pattern.test(
          path
        )
    );

  if (dynamic) {
    return {
      ...dynamic,
      path,
      canonical:
        canonicalUrlForPath(
          path
        ),
      robots:
        "index,follow,max-image-preview:large",
      indexable:
        true,
    };
  }

  return {
    ...DEFAULT_SEO,
    path,
    canonical:
      canonicalUrlForPath(
        path
      ),
    indexable:
      false,
  };
}

export function sitemapRoutes() {
  return PUBLIC_SEO_ROUTES.map(
    (route) => ({
      ...route,
      loc:
        canonicalUrlForPath(
          route.path
        ),
    })
  );
}

export function robotsDisallowPaths() {
  return [
    ...new Set(
      PRIVATE_ROUTE_PREFIXES
    ),
  ].sort();
}
