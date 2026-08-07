import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const origin = "https://salonai.francescopicardi.co.uk";

const publicMetadata = {
  "/": ["SalonAI | Premium Hair Salon Booking & Haircare", "Discover salon services, professional stylists, online booking and salon-quality haircare with SalonAI."],
  "/services": ["Hair Services & Prices | SalonAI", "Explore SalonAI hair services with clear prices, durations and online booking."],
  "/stylists": ["Meet the Salon Team | SalonAI", "Meet SalonAI stylists, explore their specialties and choose the right professional for your appointment."],
  "/shop": ["Professional Haircare Shop | SalonAI", "Shop professional haircare products selected to support healthy, manageable hair between salon visits."],
  "/experience": ["Your Connected Salon Experience | SalonAI", "Plan a confident salon visit with services, stylists, live appointment booking, haircare and customer support."],
  "/help": ["SalonAI Help Centre", "Get help with salon bookings, accounts, orders, payments and customer support."],
  "/login": ["Sign In | SalonAI", "Sign in securely to manage SalonAI appointments, orders and customer preferences."],
  "/register": ["Create a SalonAI Account", "Create a customer account for faster salon booking, order tracking and personalised salon care."],
};

function upsertMeta(name, content) {
  let element = document.head.querySelector(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertCanonical(href) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

export default function Seo() {
  const location = useLocation();

  useEffect(() => {
    const metadata = publicMetadata[location.pathname];
    const isPublic = Boolean(metadata);
    const [title, description] = metadata || [
      "SalonAI Customer Account",
      "Secure SalonAI customer and salon-management workspace.",
    ];

    document.title = title;
    upsertMeta("description", description);
    upsertMeta("robots", isPublic ? "index,follow,max-image-preview:large" : "noindex,nofollow,noarchive");
    upsertCanonical(`${origin}${isPublic ? location.pathname : "/"}`);
  }, [location.pathname]);

  return null;
}
