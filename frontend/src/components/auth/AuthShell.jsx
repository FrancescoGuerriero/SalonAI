import { Link } from "react-router-dom";
import { Scissors, ShieldCheck, Sparkles } from "lucide-react";

export default function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}) {
  return (
    <main className="auth-experience">
      <section className="auth-brand-panel" aria-label="SalonAI introduction">
        <Link className="auth-brand" to="/">
          <span className="auth-brand-mark" aria-hidden="true">
            <Scissors size={24} />
          </span>
          <span>
            <strong>SalonAI</strong>
            <small>Intelligent salon experiences</small>
          </span>
        </Link>

        <div className="auth-brand-copy">
          <span className="auth-kicker">
            <Sparkles size={16} />
            Personalised salon care
          </span>
          <h1>Beauty appointments, products and advice in one place.</h1>
          <p>
            Sign in to manage your bookings, revisit purchases and receive a
            more personalised SalonAI experience.
          </p>
        </div>

        <div className="auth-trust-note">
          <ShieldCheck size={20} />
          <span>
            <strong>Secure customer access</strong>
            <small>Your account is protected by authenticated sessions.</small>
          </span>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-card">
          <header className="auth-form-header">
            <span>{eyebrow}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </header>

          {children}

          {footer ? <footer className="auth-form-footer">{footer}</footer> : null}
        </div>
      </section>
    </main>
  );
}
