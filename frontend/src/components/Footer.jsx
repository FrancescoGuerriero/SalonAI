import {
  CalendarCheck,
  Compass,
  HelpCircle,
  Info,
  MessageCircle,
  Music2,
  Scissors,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import {
  getWhatsAppBookingUrl,
  socialLinks,
} from "../config/publicLinks.js";

import useAuth from "../hooks/useAuth.js";

const salonLinks = [
  {
    to: "/services",
    label: "Services & prices",
    icon: Scissors,
  },
  {
    to: "/stylists",
    label: "Stylists",
    icon: UsersRound,
  },
  {
    to: "/about",
    label: "About",
    icon: Info,
  },
  {
    to: "/booking",
    label: "Book",
    icon: CalendarCheck,
  },
  {
    to: "/shop",
    label: "Haircare shop",
    icon: ShoppingBag,
  },
];

const supportLinks = [
  {
    to: "/experience",
    label: "Explore",
    icon: Compass,
  },
  {
    to: "/help",
    label: "Help",
    icon: HelpCircle,
  },
  {
    to: "/experience/privacy",
    label: "Privacy choices",
    icon: ShieldCheck,
  },
];

const accountLinks = [
  {
    to: "/account",
    label: "My Account",
    icon: UserRound,
  },
  {
    to: "/account/manage",
    label: "Manage My Account",
    icon: Settings,
  },
];

const SOCIAL_ICONS = {
  Instagram: Sparkles,
  Facebook: UsersRound,
  TikTok: Music2,
  YouTube: MessageCircle,
};

export default function Footer() {
  const {
    isAuthenticated,
  } = useAuth();

  const whatsappUrl =
    getWhatsAppBookingUrl();

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="app-footer-brand">
          <span
            className="app-brand-mark"
            aria-hidden="true"
          >
            <Sparkles
              size={18}
            />
          </span>

          <div>
            <strong>
              SalonAI
            </strong>

            <p>
              Professional salon services, published prices, simple online
              booking, personalised care, secure payments, and WhatsApp support.
            </p>
          </div>
        </div>

        <div className="app-footer-links">
          <nav aria-label="Salon navigation">
            <strong>
              Salon
            </strong>

            {salonLinks.map(
              ({
                to,
                label,
                icon: Icon,
              }) => (
                <Link
                  key={to}
                  to={to}
                >
                  <Icon
                    size={15}
                  />
                  {label}
                </Link>
              )
            )}
          </nav>

          <nav aria-label="Help and explore navigation">
            <strong>
              Help & explore
            </strong>

            {supportLinks.map(
              ({
                to,
                label,
                icon: Icon,
              }) => (
                <Link
                  key={to}
                  to={to}
                >
                  <Icon
                    size={15}
                  />
                  {label}
                </Link>
              )
            )}
          </nav>

          {isAuthenticated ? (
            <nav aria-label="Account navigation">
              <strong>
                Account
              </strong>

              {accountLinks.map(
                ({
                  to,
                  label,
                  icon: Icon,
                }) => (
                  <Link
                    key={to}
                    to={to}
                  >
                    <Icon
                      size={15}
                    />
                    {label}
                  </Link>
                )
              )}
            </nav>
          ) : null}

          {socialLinks.length >
            0 ||
          whatsappUrl ? (
            <nav aria-label="Social media and messaging">
              <strong>
                Connect
              </strong>

              {whatsappUrl ? (
                <a
                  href={
                    whatsappUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle
                    size={15}
                  />
                  WhatsApp booking
                </a>
              ) : null}

              {socialLinks.map(
                ({
                  label,
                  url,
                }) => {
                  const Icon =
                    SOCIAL_ICONS[
                      label
                    ] ||
                    Sparkles;

                  return (
                    <a
                      key={
                        label
                      }
                      href={
                        url
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Icon
                        size={15}
                      />
                      {label}
                    </a>
                  );
                }
              )}
            </nav>
          ) : null}
        </div>

        <p className="app-footer-note">
          ©{" "}
          {new Date().getFullYear()}{" "}
          SalonAI. Premium salon care, connected. Secure payments and booking
          details are handled through authenticated services.
        </p>
      </div>
    </footer>
  );
}
