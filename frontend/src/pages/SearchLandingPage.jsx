import {
  Link,
  useLocation,
} from "react-router-dom";

export const SEARCH_LANDING_PAGES = {
  "/hair-services": {
    eyebrow: "Hair services",
    title: "Professional Hair Services",
    intro:
      "Explore professional salon services, compare treatments and move directly from research to online booking with SalonAI.",
    primary: {
      to: "/services",
      label: "View hair services",
    },
    secondary: {
      to: "/stylists",
      label: "Meet the stylists",
    },
    sections: [
      {
        heading: "Find the right salon service",
        body:
          "Browse haircutting, colouring, styling and treatment options before choosing your appointment.",
      },
      {
        heading: "Choose your stylist",
        body:
          "Explore stylist profiles and specialties before deciding who you would like to book with.",
      },
    ],
  },

  "/hair-colour": {
    eyebrow: "Hair colour",
    title: "Hair Colour, Highlights & Balayage",
    intro:
      "Explore professional hair colour services including highlights, balayage and modern colour techniques.",
    primary: {
      to: "/services",
      label: "Explore colour services",
    },
    secondary: {
      to: "/stylists",
      label: "Find a colour stylist",
    },
    sections: [
      {
        heading: "Plan your colour appointment",
        body:
          "Compare available salon services to identify the right colour appointment.",
      },
      {
        heading: "Professional colour guidance",
        body:
          "Choose a stylist based on published specialties before booking.",
      },
    ],
  },

  "/haircuts-styling": {
    eyebrow: "Cuts & styling",
    title: "Haircuts, Blow-Dries & Styling",
    intro:
      "Discover professional haircutting and styling services for your hair goals.",
    primary: {
      to: "/services",
      label: "View cuts and styling",
    },
    secondary: {
      to: "/stylists",
      label: "Browse stylists",
    },
    sections: [
      {
        heading: "Haircuts and styling",
        body:
          "Review cutting and styling services, durations and prices.",
      },
      {
        heading: "Match with a stylist",
        body:
          "Use stylist specialties and service information together.",
      },
    ],
  },

  "/professional-haircare": {
    eyebrow: "Professional haircare",
    title: "Professional Haircare Products",
    intro:
      "Discover professional haircare products designed to support your salon results.",
    primary: {
      to: "/shop",
      label: "Shop professional haircare",
    },
    secondary: {
      to: "/services",
      label: "Explore salon services",
    },
    sections: [
      {
        heading: "Salon-quality haircare",
        body:
          "Browse professional products that complement salon services.",
      },
      {
        heading: "Connect products with salon care",
        body:
          "Combine SalonAI services, stylist expertise and professional products.",
      },
    ],
  },

  "/book-hair-appointment": {
    eyebrow: "Online salon booking",
    title: "Book a Hair Appointment",
    intro:
      "Start your SalonAI booking journey by choosing a service and stylist.",
    primary: {
      to: "/services",
      label: "Choose a service",
    },
    secondary: {
      to: "/stylists",
      label: "Choose a stylist",
    },
    sections: [
      {
        heading: "Choose your service first",
        body:
          "Review service information, prices and durations before booking.",
      },
      {
        heading: "Choose your stylist",
        body:
          "Explore stylist specialties before selecting your professional.",
      },
    ],
  },
};

export default function SearchLandingPage() {
  const location = useLocation();
  const page = SEARCH_LANDING_PAGES[location.pathname];

  if (!page) {
    return null;
  }

  return (
    <article className="app-page">
      <header className="app-page-header">
        <span className="app-eyebrow">
          {page.eyebrow}
        </span>

        <h1>{page.title}</h1>
        <p>{page.intro}</p>

        <div className="app-actions">
          <Link
            className="app-button"
            to={page.primary.to}
          >
            {page.primary.label}
          </Link>

          <Link
            className="app-button app-button-secondary"
            to={page.secondary.to}
          >
            {page.secondary.label}
          </Link>
        </div>
      </header>

      <div className="app-grid">
        {page.sections.map((section) => (
          <section
            className="app-card"
            key={section.heading}
          >
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
