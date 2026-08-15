import {
  ArrowRight,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Gift,
  Heart,
  HeartHandshake,
  MessageCircle,
  Palette,
  Scissors,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";

import "../styles/salonExperience.css";

const VISIT_TOOLS = [
  {
    icon: ClipboardList,
    eyebrow: "Before your visit",
    title: "Complete your hair consultation",
    description:
      "Share hair history, colour history, routine, goals, sensitivities and maintenance preferences before the appointment.",
    to: "/account/manage",
    action: "Start consultation",
  },
  {
    icon: Palette,
    eyebrow: "Prepare",
    title: "Save hairstyle inspiration",
    description:
      "Keep reference ideas and notes with your private SalonAI experience profile so the salon can understand the direction you like.",
    to: "/experience/inspiration",
    action: "Open inspiration board",
  },
  {
    icon: CalendarCheck,
    eyebrow: "Book",
    title: "Choose a live appointment",
    description:
      "Choose a service and stylist, then work from currently available appointment times rather than a static enquiry form.",
    to: "/booking",
    action: "Book online",
  },
  {
    icon: MessageCircle,
    eyebrow: "Alternative booking",
    title: "Book through WhatsApp",
    description:
      "Start a conversation with the salon when you prefer human help. Staff check availability and confirm the final appointment in SalonAI.",
    to: "/help",
    action: "See how WhatsApp works",
  },
];

const ACCOUNT_TOOLS = [
  {
    icon: UserRound,
    title: "My account",
    description: "Appointments, payment balances, orders and customer shortcuts.",
    to: "/account",
  },
  {
    icon: Settings,
    title: "Communication preferences",
    description: "Choose email, SMS or WhatsApp preferences and control optional communications.",
    to: "/settings",
  },
  {
    icon: Heart,
    title: "Favourites",
    description: "Save preferred services, stylists and products for future visits.",
    to: "/experience/favourites",
  },
  {
    icon: Star,
    title: "Visit reviews",
    description: "Review completed appointments and keep feedback connected to a real visit.",
    to: "/experience/reviews",
  },
];

const REWARD_TOOLS = [
  {
    icon: Gift,
    title: "Loyalty and gift cards",
    description: "Review loyalty activity and keep eligible salon gift cards available from your account.",
    to: "/experience/loyalty",
  },
  {
    icon: CreditCard,
    title: "Payments",
    description: "Understand appointment deposits, balances, secure Stripe Checkout and order payment status.",
    to: "/help",
  },
  {
    icon: ShoppingBag,
    title: "Salon shop",
    description: "Browse haircare products and keep purchases connected to your account history.",
    to: "/shop",
  },
  {
    icon: HeartHandshake,
    title: "Offers and referrals",
    description: "Save eligible offers and use referral tools from the connected customer experience.",
    to: "/experience/offers",
  },
];

const JOURNEY = [
  "Create and verify your customer account",
  "Save profile details and consultation information",
  "Choose a service, stylist and available appointment",
  "Pay any required deposit through secure checkout",
  "Receive confirmation and reminders through your permitted channels",
  "Return to your account for visits, purchases, rewards and feedback",
];

function ToolGrid({ items }) {
  return (
    <div className="salon-connected-grid">
      {items.map(({ icon: Icon, title, description, to }) => (
        <Link key={title} to={to}>
          <span><Icon size={21} /></span>
          <strong>{title}</strong>
          <p>{description}</p>
          <b>Open <ArrowRight size={14} /></b>
        </Link>
      ))}
    </div>
  );
}

export default function CustomerExperienceSuitePage() {
  return (
    <main className="salon-experience-page" id="main-content" tabIndex="-1">
      <section className="salon-experience-hero">
        <div>
          <p className="customer-eyebrow"><Sparkles size={16} /> Your connected salon experience</p>
          <h1>Plan, book and manage your hair journey in one place.</h1>
          <p>
            SalonAI connects your consultation, preferences, live booking,
            payments, communication choices, visits and haircare purchases so
            you do not need to repeat the same information every time.
          </p>
          <div className="salon-experience-actions">
            <Link to="/account/manage" className="customer-primary-link">
              Complete my consultation <ArrowRight size={17} />
            </Link>
            <Link to="/booking" className="customer-secondary-link">
              <CalendarCheck size={17} /> Book an appointment
            </Link>
          </div>
        </div>

        <aside className="salon-experience-assistant-card">
          <span><Bot size={25} /></span>
          <p className="customer-eyebrow">SalonAI assistant</p>
          <h2>Need help choosing?</h2>
          <p>
            Use Ask SalonAI for general service, product and booking guidance,
            then use your consultation for the detailed information your stylist
            needs before a service.
          </p>
          <small>
            <ShieldCheck size={15} /> Never share passwords, verification links
            or full payment-card details in chat.
          </small>
        </aside>
      </section>

      <section className="salon-experience-section">
        <header>
          <p className="customer-eyebrow">Before your appointment</p>
          <h2>Arrive with the important details already prepared</h2>
          <p>
            A good salon experience begins before the chair: consultation,
            inspiration, booking and communication should all lead into the same
            appointment record.
          </p>
        </header>

        <div className="salon-experience-grid">
          {VISIT_TOOLS.map(({ icon: Icon, eyebrow, title, description, to, action }) => (
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
          <p className="customer-eyebrow">One customer journey</p>
          <h2>From registration to aftercare</h2>
          <p>
            Each stage should update SalonAI rather than becoming a disconnected
            message or form. Your account remains the place to verify the final
            appointment, payment and order status.
          </p>
          <Link to="/help"><HeartHandshake size={17} /> Read customer help</Link>
        </div>
        <ol>
          {JOURNEY.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              <p>{step}</p>
              <CheckCircle2 size={18} />
            </li>
          ))}
        </ol>
      </section>

      <section className="salon-connected-features">
        <header>
          <p className="customer-eyebrow"><UserRound size={16} /> Your visits and preferences</p>
          <h2>Keep your salon relationship organised</h2>
          <p>
            Update the information the salon actually needs and keep communication
            choices under your control.
          </p>
        </header>
        <ToolGrid items={ACCOUNT_TOOLS} />
      </section>

      <section className="salon-connected-features">
        <header>
          <p className="customer-eyebrow"><Scissors size={16} /> Services, rewards and aftercare</p>
          <h2>Continue the experience after the appointment</h2>
          <p>
            Payments, product purchases, loyalty, offers and reviews are linked
            to the same customer account rather than treated as isolated tools.
          </p>
        </header>
        <ToolGrid items={REWARD_TOOLS} />
      </section>

      <section className="salon-experience-section">
        <header>
          <p className="customer-eyebrow">Explore the salon</p>
          <h2>Still deciding what you need?</h2>
        </header>
        <div className="salon-experience-grid">
          <article>
            <span><Scissors size={22} /></span>
            <small>Services</small>
            <h3>Compare treatments</h3>
            <p>Review live services, prices and durations before booking.</p>
            <Link to="/services">Browse services <ArrowRight size={15} /></Link>
          </article>
          <article>
            <span><UsersRound size={22} /></span>
            <small>Team</small>
            <h3>Meet your stylists</h3>
            <p>Explore active stylists, specialties and the services they perform.</p>
            <Link to="/stylists">Meet the team <ArrowRight size={15} /></Link>
          </article>
          <article>
            <span><ShoppingBag size={22} /></span>
            <small>Haircare</small>
            <h3>Shop products</h3>
            <p>Browse salon haircare and connect purchases to your account.</p>
            <Link to="/shop">Open shop <ArrowRight size={15} /></Link>
          </article>
          <article>
            <span><ShieldCheck size={22} /></span>
            <small>Privacy</small>
            <h3>Control your data choices</h3>
            <p>Review optional analytics, personalisation and marketing consent.</p>
            <Link to="/experience/privacy">Privacy choices <ArrowRight size={15} /></Link>
          </article>
        </div>
      </section>
    </main>
  );
}
