import { BadgeCheck, LockKeyhole, RotateCcw } from "lucide-react";

const items = [
  { icon: BadgeCheck, title: "Salon-selected", text: "Professional products chosen for client care." },
  { icon: LockKeyhole, title: "Secure checkout", text: "Order totals are verified before payment." },
  { icon: RotateCcw, title: "Clear order status", text: "Track payment, collection and delivery progress." },
];

export default function CommerceTrustBar() {
  return (
    <section className="commerce-trust-bar" aria-label="Shopping assurances">
      {items.map(({ icon: Icon, title, text }) => (
        <article key={title}>
          <Icon size={20} aria-hidden="true" />
          <div><strong>{title}</strong><span>{text}</span></div>
        </article>
      ))}
    </section>
  );
}
