import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  CircleHelp,
  CreditCard,
  Mail,
  MessageCircle,
  MessageSquareText,
  PackageSearch,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import HelpTopicCard from "../components/help/HelpTopicCard.jsx";
import FaqAccordion from "../components/help/FaqAccordion.jsx";

const topics = [
  { id: "booking", title: "Bookings and appointments", description: "Booking, rescheduling, cancellations and appointment status.", icon: CalendarClock },
  { id: "account", title: "Account access", description: "Registration, email verification, login and profile assistance.", icon: UserRound },
  { id: "communications", title: "WhatsApp, SMS and email", description: "How salon messages, reminders and WhatsApp booking work.", icon: MessageSquareText },
  { id: "orders", title: "Orders and delivery", description: "Order status, product issues and delivery questions.", icon: PackageSearch },
  { id: "payments", title: "Payments and refunds", description: "Stripe checkout, deposits, balances and payment confirmation.", icon: CreditCard },
];

const faqs = [
  {
    id: "booking-change",
    topic: "booking",
    question: "How do I change an appointment?",
    answer: "Open My Account to review the appointment. Where a self-service change is not available, contact the salon and include the appointment date, time and service. A staff member can then reschedule or cancel it from the management workspace.",
  },
  {
    id: "booking-missing",
    topic: "booking",
    question: "Why is my booking not showing?",
    answer: "Make sure you are signed in with the same email address used for the booking. Refresh My Account. If the booking was started in WhatsApp, it does not become a SalonAI appointment until the salon confirms the booking details.",
  },
  {
    id: "login-problem",
    topic: "account",
    question: "What should I do if I cannot sign in?",
    answer: "Check the email address and password carefully. New customer accounts must verify their email address before their first sign-in. If your account is waiting for verification, use Resend verification email on the sign-in page.",
  },
  {
    id: "account-details",
    topic: "account",
    question: "Where can I edit my customer details?",
    answer: "Open My Account and choose Manage account. Your name, phone number, profile photograph and delivery address are saved to your authenticated SalonAI account. Communication preferences are managed separately under Settings.",
  },
  {
    id: "whatsapp-booking",
    topic: "communications",
    question: "How does WhatsApp booking work?",
    answer: "The WhatsApp button opens a conversation with the salon. You can tell the salon which service, stylist and date you want. Staff review the conversation, check live availability, complete the booking details and confirm the appointment in SalonAI. The confirmed appointment then appears in your account. WhatsApp is therefore a booking conversation channel, not a separate appointment system.",
  },
  {
    id: "whatsapp-window",
    topic: "communications",
    question: "Why can the salon sometimes reply freely on WhatsApp and sometimes use a template?",
    answer: "After you message the salon on WhatsApp, staff can normally continue the service conversation within WhatsApp's customer-service window. Outside that window the salon must use an approved WhatsApp template for outbound messages. SalonAI records delivery states such as sent, delivered, read or failed when the provider supplies them.",
  },
  {
    id: "sms-purpose",
    topic: "communications",
    question: "What are SalonAI text messages used for?",
    answer: "SMS is intended for operational messages such as appointment reminders, service updates and payment-related notices when your communication preferences allow SMS. Marketing messages are controlled separately. You can review your preferred channel and message settings under Settings.",
  },
  {
    id: "email-purpose",
    topic: "communications",
    question: "What emails will SalonAI send?",
    answer: "Transactional email is used for account verification, password resets, booking confirmations, receipts and important service updates. Promotional email is a separate preference. SalonAI should never ask you to send a password or full payment-card details by email.",
  },
  {
    id: "order-status",
    topic: "orders",
    question: "Where can I track an order?",
    answer: "Open Order History from your customer account. The latest order status and recorded purchase information will appear there.",
  },
  {
    id: "damaged-product",
    topic: "orders",
    question: "What information is needed for a damaged product?",
    answer: "Provide the order number, product name, a short description of the issue and clear photographs where appropriate. Keep the packaging until the salon confirms the next step.",
  },
  {
    id: "payment-appointment",
    topic: "payments",
    question: "How do appointment payments work?",
    answer: "When an appointment has an outstanding amount, My Account shows a Pay deposit or Pay balance button. SalonAI asks the backend to create a secure Stripe Checkout session, then redirects you to Stripe to enter card details. SalonAI does not collect the full card number itself. The appointment is marked paid only after the signed Stripe webhook confirms the payment.",
  },
  {
    id: "payment-shop",
    topic: "payments",
    question: "How do product payments work?",
    answer: "Product purchases are prepared in SalonAI and paid through the configured secure checkout flow. The order should only be treated as paid after the payment provider confirms it. Your order history is the authoritative place to check the recorded order status.",
  },
  {
    id: "payment-pending",
    topic: "payments",
    question: "My payment is pending. What should I do?",
    answer: "Do not submit the same payment repeatedly. Return to My Account or Order History and refresh the status first. Payment confirmation can arrive just after the Stripe page redirects back. If the balance still looks wrong, contact the salon with the approximate payment time and amount, but never send full card details.",
  },
  {
    id: "refund-time",
    topic: "payments",
    question: "How are refunds handled?",
    answer: "Approved refunds are returned through the original payment method and recorded against the SalonAI payment. Processing time after the refund is submitted depends on Stripe, the card network and your bank.",
  },
];

const normalise = (value) => String(value || "").trim().toLowerCase();

export default function HelpCentrePage() {
  const [search, setSearch] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [openFaq, setOpenFaq] = useState("booking-change");

  const visibleFaqs = useMemo(() => {
    const query = normalise(search);
    return faqs.filter((item) => {
      const topicMatch = selectedTopic === "all" || item.topic === selectedTopic;
      const searchMatch = !query || normalise(item.question).includes(query) || normalise(item.answer).includes(query);
      return topicMatch && searchMatch;
    });
  }, [search, selectedTopic]);

  function selectTopic(topicId) {
    setSelectedTopic(topicId);
    setOpenFaq(faqs.find((item) => item.topic === topicId)?.id || "");
  }

  return (
    <main className="help-centre-page">
      <section className="help-hero">
        <span className="help-eyebrow"><Sparkles size={16} />SalonAI customer support</span>
        <h1>How can we help?</h1>
        <p>Find clear explanations for appointments, account verification, WhatsApp, text messages, email, orders and secure payments.</p>
        <label className="help-search">
          <Search size={20} aria-hidden="true" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search help articles" aria-label="Search help articles" />
        </label>
      </section>

      <section className="help-topic-section">
        <header>
          <h2>Choose a help topic</h2>
          <button type="button" onClick={() => { setSelectedTopic("all"); setOpenFaq(""); }}>Show all</button>
        </header>
        <div className="help-topic-grid">
          {topics.map((topic) => (
            <HelpTopicCard key={topic.id} icon={topic.icon} title={topic.title} description={topic.description} onSelect={() => selectTopic(topic.id)} />
          ))}
        </div>
      </section>

      <div className="help-content-grid">
        <section className="help-faq-panel">
          <header className="help-panel-header">
            <div>
              <span><CircleHelp size={17} />Frequently asked questions</span>
              <h2>{selectedTopic === "all" ? "All help articles" : topics.find((topic) => topic.id === selectedTopic)?.title}</h2>
            </div>
            <small>{visibleFaqs.length} results</small>
          </header>

          {visibleFaqs.length ? (
            <div className="faq-list">
              {visibleFaqs.map((item) => (
                <FaqAccordion key={item.id} item={item} isOpen={openFaq === item.id} onToggle={() => setOpenFaq((current) => current === item.id ? "" : item.id)} />
              ))}
            </div>
          ) : (
            <div className="help-empty">
              <Search size={28} />
              <h3>No matching help articles</h3>
              <p>Try a different search or select another topic.</p>
            </div>
          )}
        </section>

        <aside className="help-support-panel">
          <span className="help-support-icon"><MessageCircle size={24} /></span>
          <h2>Still need help?</h2>
          <p>Include the relevant booking date, order number or account email so the salon can investigate efficiently.</p>
          <Link className="help-contact-button" to="/account"><UserRound size={18} />Review my account</Link>
          <Link className="help-secondary-link" to="/settings"><Mail size={18} />Communication settings</Link>
          <div className="help-security-note">
            <ShieldCheck size={19} />
            <span>Never send passwords, verification tokens or full payment-card details in a support request.</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
