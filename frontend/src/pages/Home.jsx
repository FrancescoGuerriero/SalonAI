import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Gift,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";

import useFeatureControls from "../hooks/useFeatureControls.js";
import "../styles/customerExperience.css";

const benefits = [
  {
    icon: CalendarCheck,
    title: "Easy online booking",
    description:
      "Choose your treatment, stylist and preferred time in a simple guided journey.",
    featureId: "online-booking",
  },
  {
    icon: Sparkles,
    title: "Personalised care",
    description:
      "Discover services and recommendations matched to your hair goals.",
  },
  {
    icon: ShieldCheck,
    title: "Secure and reliable",
    description:
      "Your account, appointments and payments are handled with care.",
  },
];

export default function Home() {
  const { isFeatureEnabled } = useFeatureControls();
  const onlineBookingEnabled = isFeatureEnabled("online-booking");
  const onlineShopEnabled = isFeatureEnabled("online-shop");
  const loyaltyEnabled = isFeatureEnabled("loyalty");
  const reviewsEnabled = isFeatureEnabled("reviews");

  const highlights = [
    "Expert stylists",
    "Transparent prices",
    ...(onlineBookingEnabled ? ["Flexible booking"] : []),
  ];

  return (
    <main className="customer-home">
      <section className="customer-hero">
        <div className="customer-hero-content">
          <p className="customer-eyebrow">
            <Sparkles size={16} />
            Smarter salon experiences
          </p>

          <h1>
            Great hair starts with the
            <span> right service.</span>
          </h1>

          <p className="customer-hero-description">
            Explore professional salon services, discover the team and manage
            your salon experience from one clear customer space.
          </p>

          <div className="customer-hero-actions">
            {onlineBookingEnabled ? (
              <Link
                to="/booking"
                className="customer-primary-link"
              >
                <CalendarCheck size={19} />
                Book an appointment
                <ArrowRight size={18} />
              </Link>
            ) : (
              <Link
                to="/services"
                className="customer-primary-link"
              >
                <Scissors size={19} />
                Explore services
                <ArrowRight size={18} />
              </Link>
            )}

            {onlineShopEnabled ? (
              <Link
                to="/shop"
                className="customer-secondary-link"
              >
                <ShoppingBag size={19} />
                Shop haircare
              </Link>
            ) : null}
          </div>

          <ul className="customer-trust-list">
            {highlights.map((highlight) => (
              <li key={highlight}>
                <CheckCircle2 size={17} />
                {highlight}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="customer-hero-visual"
          aria-label="SalonAI customer experience"
        >
          <div className="customer-visual-orb customer-orb-one" />
          <div className="customer-visual-orb customer-orb-two" />

          {onlineBookingEnabled ? (
            <article className="customer-appointment-preview">
              <div className="appointment-preview-top">
                <span className="appointment-preview-icon">
                  <Scissors size={22} />
                </span>
                <div>
                  <small>Your next appointment</small>
                  <strong>Cut and finish</strong>
                </div>
                <span className="appointment-status">
                  Confirmed
                </span>
              </div>

              <div className="appointment-preview-details">
                <div>
                  <CalendarCheck size={18} />
                  <span>
                    <small>Date and time</small>
                    Saturday · 11:00
                  </span>
                </div>
                <div>
                  <UsersRound size={18} />
                  <span>
                    <small>Your stylist</small>
                    Salon professional
                  </span>
                </div>
              </div>
            </article>
          ) : null}

          {reviewsEnabled ? (
            <article className="customer-rating-card">
              <span>
                <Star size={18} fill="currentColor" />
                4.9
              </span>
              <p>Loved by salon customers</p>
            </article>
          ) : null}

          {loyaltyEnabled ? (
            <article className="customer-reward-card">
              <Gift size={20} />
              <div>
                <strong>Earn rewards</strong>
                <small>Every visit counts</small>
              </div>
            </article>
          ) : null}
        </div>
      </section>

      <section className="customer-benefits">
        <div className="customer-section-heading">
          <p className="customer-eyebrow">
            Why SalonAI
          </p>
          <h2>A smoother journey from discovery to salon care</h2>
          <p>
            Everything customers need to make confident salon decisions in one
            clear experience.
          </p>
        </div>

        <div className="customer-benefit-grid">
          {benefits
            .filter(({ featureId }) => !featureId || isFeatureEnabled(featureId))
            .map(({ icon: Icon, title, description }) => (
              <article key={title}>
                <span>
                  <Icon size={22} />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
        </div>
      </section>

      <section className="customer-cta">
        <div>
          <p className="customer-eyebrow">
            Your next look
          </p>
          <h2>{onlineBookingEnabled ? "Ready to book?" : "Explore salon services"}</h2>
          <p>
            {onlineBookingEnabled
              ? "Browse available treatments and begin your personalised salon journey."
              : "Review available treatments, prices and service information before your next visit."}
          </p>
        </div>

        <Link
          to="/services"
          className="customer-primary-link"
        >
          Browse services
          <ArrowRight size={18} />
        </Link>
      </section>
    </main>
  );
}
