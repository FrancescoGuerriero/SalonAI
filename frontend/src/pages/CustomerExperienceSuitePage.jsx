import {
  ArrowRight,
  Bot,
  CalendarCheck,
  CheckCircle2,
  HeartHandshake,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { roadmapFeatures } from "../features/roadmap/roadmapFeatures.js";

import "../styles/salonExperience.css";

const experiences = [
  {
    icon: Scissors,
    eyebrow: "Discover",
    title: "Find your service",
    description:
      "Compare available treatments with clear prices and appointment durations.",
    to: "/services",
    action: "Browse services",
  },
  {
    icon: UsersRound,
    eyebrow: "Choose",
    title: "Meet the salon team",
    description:
      "Explore active stylists, specialties, experience, and the services they offer.",
    to: "/stylists",
    action: "View stylists",
  },
  {
    icon: CalendarCheck,
    eyebrow: "Book",
    title: "Pick a live appointment",
    description:
      "Choose a service, stylist, date, and currently available time in one guided journey.",
    to: "/services",
    action: "Start booking",
  },
  {
    icon: ShoppingBag,
    eyebrow: "Maintain",
    title: "Shop haircare",
    description:
      "Browse salon haircare products and keep your routine connected to your visits.",
    to: "/shop",
    action: "Open the shop",
  },
];

const journey = [
  "Browse the live salon catalogue",
  "Choose a stylist who offers your service",
  "Select a verified available time",
  "Review appointments from your account",
];

export default function CustomerExperienceSuitePage() {
  return (
    <main className="salon-experience-page" id="main-content" tabIndex="-1">
      <section className="salon-experience-hero">
        <div>
          <p className="customer-eyebrow"><Sparkles size={16} /> Your salon journey</p>
          <h1>Everything you need for a confident salon visit.</h1>
          <p>
            Explore treatments, meet the team, book a live appointment, and get
            guidance whenever you need it—all in one connected experience.
          </p>
          <div className="salon-experience-actions">
            <Link to="/services" className="customer-primary-link">Book an appointment <ArrowRight size={17} /></Link>
            <Link to="/account" className="customer-secondary-link"><UserRound size={17} /> My account</Link>
          </div>
        </div>

        <aside className="salon-experience-assistant-card">
          <span><Bot size={25} /></span>
          <p className="customer-eyebrow">SalonAI assistant</p>
          <h2>Not sure where to start?</h2>
          <p>
            Open “Ask SalonAI” at the bottom of the page for services, prices,
            booking steps, stylists, haircare guidance, and support.
          </p>
          <small><ShieldCheck size={15} /> General salon guidance without sharing passwords or payment details.</small>
        </aside>
      </section>

      <section className="salon-experience-section">
        <header>
          <p className="customer-eyebrow">Plan your visit</p>
          <h2>A simple route from idea to appointment</h2>
        </header>

        <div className="salon-experience-grid">
          {experiences.map(({ icon: Icon, eyebrow, title, description, to, action }) => (
            <article key={title}>
              <span><Icon size={22} /></span>
              <small>{eyebrow}</small>
              <h3>{title}</h3>
              <p>{description}</p>
              <Link to={to}>{action}<ArrowRight size={15} /></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="salon-experience-journey">
        <div>
          <p className="customer-eyebrow">Designed around you</p>
          <h2>Care before, during, and after your appointment</h2>
          <p>
            Your SalonAI account brings booking information and salon support
            together, while the management team works with one accurate appointment record.
          </p>
          <Link to="/help"><HeartHandshake size={17} /> Visit the Help centre</Link>
        </div>
        <ol>
          {journey.map((step, index) => (
            <li key={step}><span>{index + 1}</span><p>{step}</p><CheckCircle2 size={18} /></li>
          ))}
        </ol>
      </section>

      <section className="salon-connected-features">
        <header>
          <p className="customer-eyebrow"><Sparkles size={16} /> Connected customer care</p>
          <h2>More than a booking form</h2>
          <p>Sign in to use persistent account tools for privacy, salon planning, rewards, communication and service feedback.</p>
        </header>
        <div className="salon-connected-grid">
          {roadmapFeatures.map((feature) => (
            <Link key={feature.id} to={`/experience/${feature.id}`}>
              <span>{feature.sprint}</span>
              <small>{feature.group}</small>
              <strong>{feature.title}</strong>
              <p>{feature.summary}</p>
              <b>Open feature <ArrowRight size={14} /></b>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
