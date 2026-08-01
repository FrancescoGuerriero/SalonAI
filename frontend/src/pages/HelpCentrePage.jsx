import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  CircleHelp,
  CreditCard,
  Mail,
  MessageCircle,
  PackageSearch,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import HelpTopicCard from "../components/help/HelpTopicCard.jsx";
import FaqAccordion from "../components/help/FaqAccordion.jsx";

const topics = [
  { id: "booking", title: "Bookings and appointments", description: "Rescheduling, cancellations and appointment status.", icon: CalendarClock },
  { id: "account", title: "Account access", description: "Login, registration and profile assistance.", icon: UserRound },
  { id: "orders", title: "Orders and delivery", description: "Order status, product issues and delivery questions.", icon: PackageSearch },
  { id: "payments", title: "Payments and refunds", description: "Checkout, payment confirmation and refund guidance.", icon: CreditCard },
];

const faqs = [
  { id: "booking-change", topic: "booking", question: "How do I change an appointment?", answer: "Open your customer account to review upcoming appointments. Where self-service changes are unavailable, contact the salon and include the appointment date, time and service." },
  { id: "booking-missing", topic: "booking", question: "Why is my booking not showing?", answer: "Confirm that you are signed in with the same email address used when booking. Refresh your account page and check whether the appointment is still pending confirmation." },
  { id: "login-problem", topic: "account", question: "What should I do if I cannot sign in?", answer: "Check the email address and password carefully. Passwords are case-sensitive. If the problem continues, contact support and provide the email address associated with the account." },
  { id: "account-details", topic: "account", question: "Where can I see my account activity?", answer: "Use the My Account page to review upcoming appointments, completed visits, order history and account shortcuts." },
  { id: "order-status", topic: "orders", question: "Where can I track an order?", answer: "Open Order History from your customer account. The latest order status and recorded purchase information will appear there." },
  { id: "damaged-product", topic: "orders", question: "What information is needed for a damaged product?", answer: "Provide the order number, product name, a short description of the issue and clear photographs where appropriate. Keep the packaging until the salon confirms the next step." },
  { id: "payment-pending", topic: "payments", question: "My payment is pending. What should I do?", answer: "Do not submit the same payment repeatedly. Check Order History first. If no confirmed order appears, contact support with the approximate payment time and amount." },
  { id: "refund-time", topic: "payments", question: "How are refunds handled?", answer: "Approved refunds are returned through the original payment method. Processing time depends on the payment provider and your bank." },
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
        <p>Find answers about appointments, accounts, orders and payments, then use the appropriate support route when more help is required.</p>
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
          <a className="help-contact-button" href="mailto:support@salonai.local"><Mail size={18} />Email support</a>
          <Link className="help-secondary-link" to="/account"><UserRound size={18} />Review my account</Link>
          <div className="help-security-note">
            <ShieldCheck size={19} />
            <span>Never send passwords or full payment-card details in a support request.</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
