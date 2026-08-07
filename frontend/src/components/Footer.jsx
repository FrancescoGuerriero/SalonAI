import { CalendarCheck, HelpCircle, MapPin, Scissors, ShieldCheck, ShoppingBag, Sparkles, UserRound, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";

const links = [
  { to: "/services", label: "Services", icon: Scissors },
  { to: "/stylists", label: "Stylists", icon: UsersRound },
  { to: "/booking", label: "Book", icon: CalendarCheck },
  { to: "/shop", label: "Haircare shop", icon: ShoppingBag },
  { to: "/help", label: "Help", icon: HelpCircle },
];

const accountLinks = [
  { to: "/account", label: "My account", icon: UserRound },
  { to: "/account/manage", label: "Home address", icon: MapPin },
  { to: "/experience/privacy", label: "Privacy choices", icon: ShieldCheck },
];

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="app-footer-brand">
          <span className="app-brand-mark" aria-hidden="true"><Sparkles size={18} /></span>
          <div><strong>SalonAI</strong><p>Professional salon services, simple online booking, and personalised care.</p></div>
        </div>

        <div className="app-footer-links">
          <nav aria-label="Salon navigation"><strong>Salon</strong>{links.map(({ to, label, icon: Icon }) => <Link key={to} to={to}><Icon size={15} />{label}</Link>)}</nav>
          <nav aria-label="Account navigation"><strong>Account</strong>{accountLinks.map(({ to, label, icon: Icon }) => <Link key={to} to={to}><Icon size={15} />{label}</Link>)}</nav>
        </div>

        <p className="app-footer-note">© {new Date().getFullYear()} SalonAI. Premium salon care, connected. Secure payments and booking details are handled through authenticated services.</p>
      </div>
    </footer>
  );
}
