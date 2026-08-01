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

import "../styles/customerExperience.css";

const benefits = [
  {
    icon: CalendarCheck,
    title: "Easy online booking",
    description:
      "Choose your treatment, stylist and preferred time in a simple guided journey.",
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

const highlights = [
  "Expert stylists",
  "Transparent prices",
  "Flexible booking",
];

export default function Home() {
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
            <span> right appointment.</span>
          </h1>

          <p className="customer-hero-description">
            Explore professional salon services, find the right
            stylist and book your next visit in minutes.
          </p>

          <div className="customer-hero-actions">
            <Link
              to="/services"
              className="customer-primary-link"
            >
              <CalendarCheck size={19} />
              Book an appointment
              <ArrowRight size={18} />
            </Link>

            <Link
              to="/shop"
              className="customer-secondary-link"
            >
              <ShoppingBag size={19} />
              Shop haircare
            </Link>
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
          aria-label="SalonAI appointment experience"
        >
          <div className="customer-visual-orb customer-orb-one" />
          <div className="customer-visual-orb customer-orb-two" />

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

          <article className="customer-rating-card">
            <span>
              <Star size={18} fill="currentColor" />
              4.9
            </span>
            <p>Loved by salon customers</p>
          </article>

          <article className="customer-reward-card">
            <Gift size={20} />
            <div>
              <strong>Earn rewards</strong>
              <small>Every visit counts</small>
            </div>
          </article>
        </div>
      </section>

      <section className="customer-benefits">
        <div className="customer-section-heading">
          <p className="customer-eyebrow">
            Why SalonAI
          </p>
          <h2>A smoother journey from discovery to appointment</h2>
          <p>
            Everything customers need to make confident booking
            decisions in one clear experience.
          </p>
        </div>

        <div className="customer-benefit-grid">
          {benefits.map(({ icon: Icon, title, description }) => (
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
          <h2>Ready to book?</h2>
          <p>
            Browse available treatments and begin your
            personalised salon journey.
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
