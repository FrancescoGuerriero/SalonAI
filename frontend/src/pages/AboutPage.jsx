import {
  ArrowRight,
  Award,
  CalendarCheck,
  HeartHandshake,
  Scissors,
  Sparkles,
  Star,
  UsersRound,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";

import Alert from "../components/ui/Alert.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import stylistService from "../Services/stylistService.js";
import {
  getStylistName,
  getStylistSpecialtyLabel,
} from "../utils/stylists.js";
import {
  profileInitials,
} from "../utils/profileMedia.js";

function normaliseTeam(payload) {
  if (
    Array.isArray(
      payload
    )
  ) {
    return payload;
  }

  if (
    Array.isArray(
      payload?.stylists
    )
  ) {
    return payload.stylists;
  }

  return [];
}

function instagramHref(value) {
  const text =
    String(
      value || ""
    ).trim();

  if (
    /^@[A-Za-z0-9._]+$/.test(
      text
    )
  ) {
    return `https://www.instagram.com/${text.slice(1)}/`;
  }

  return text.startsWith(
    "https://"
  )
    ? text
    : "";
}

function TeamCard({
  stylist,
}) {
  const name =
    getStylistName(
      stylist
    );
  const image =
    stylist?.profileImage ||
    "";

  const links = [
    [
      "Instagram",
      instagramHref(
        stylist?.instagram
      ),
    ],
    [
      "Facebook",
      stylist?.facebook,
    ],
    [
      "Website",
      stylist?.website,
    ],
  ].filter(
    ([, value]) =>
      String(
        value || ""
      ).startsWith(
        "https://"
      )
  );

  return (
    <article className="about-team-card">
      <div className="about-team-photo">
        {image ? (
          <img
            src={image}
            alt={`${name}, ${stylist?.jobTitle || "hair professional"}`}
            loading="lazy"
          />
        ) : (
          <span
            aria-hidden="true"
          >
            {profileInitials(
              name
            )}
          </span>
        )}
      </div>

      <div className="about-team-copy">
        <p className="customer-eyebrow">
          <Scissors
            size={15}
          />
          {stylist?.jobTitle ||
            "Hair professional"}
        </p>

        <h3>{name}</h3>

        <p>
          {stylist?.biography ||
            "A SalonAI hair professional focused on thoughtful consultation, technical quality and client care."}
        </p>

        <div className="about-team-meta">
          <span>
            <Award
              size={15}
            />
            {Number(
              stylist?.yearsExperience ||
                0
            )}{" "}
            years experience
          </span>

          <span>
            <Star
              size={15}
            />
            {Number(
              stylist?.rating ||
                5
            ).toFixed(1)}
          </span>
        </div>

        <div className="about-team-specialties">
          {(
            stylist?.specialties ||
            []
          )
            .slice(0, 4)
            .map(
              (specialty) => (
                <span
                  key={
                    specialty
                  }
                >
                  {
                    specialty
                  }
                </span>
              )
            )}
        </div>

        {links.length ? (
          <div className="about-team-links">
            {links.map(
              ([
                label,
                href,
              ]) => (
                <a
                  key={
                    label
                  }
                  href={
                    href
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {label}
                </a>
              )
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function AboutPage() {
  const [
    team,
    setTeam,
  ] = useState([]);
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let active =
      true;

    stylistService
      .getPublicTeam()
      .then(
        (payload) => {
          if (!active) {
            return;
          }

          setTeam(
            normaliseTeam(
              payload
            )
          );
        }
      )
      .catch(
        (requestError) => {
          if (!active) {
            return;
          }

          setError(
            requestError
              .response
              ?.data
              ?.message ||
              "The team profiles could not be loaded."
          );
        }
      )
      .finally(() => {
        if (active) {
          setLoading(
            false
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="about-page">
      <section className="about-hero">
        <div>
          <p className="customer-eyebrow">
            <Sparkles
              size={16}
            />
            About SalonAI
          </p>

          <h1>
            Professional hair care,
            strengthened by thoughtful
            technology.
          </h1>

          <p>
            SalonAI brings together salon craft, transparent services,
            convenient booking, customer profiles, secure payments and
            intelligent tools so every visit can feel more personal and better
            organised.
          </p>

          <div className="about-hero-actions">
            <Link
              to="/services"
              className="app-button app-button-primary"
            >
              Explore services
              <ArrowRight
                size={17}
              />
            </Link>

            <Link
              to="/booking"
              className="app-button app-button-secondary"
            >
              Book an appointment
            </Link>
          </div>
        </div>

        <aside className="about-promise-card">
          <span>
            <HeartHandshake
              size={26}
            />
          </span>
          <small>
            Our promise
          </small>
          <h2>
            Consultation before
            assumption.
          </h2>
          <p>
            Profiles, history and technology support the conversation; the
            professional and the client still make the final decisions
            together.
          </p>
        </aside>
      </section>

      <section className="about-values">
        <article>
          <Scissors
            size={22}
          />
          <h2>
            Skilled service
          </h2>
          <p>
            Clear service information, specialist profiles and booking context
            help clients choose confidently.
          </p>
        </article>

        <article>
          <CalendarCheck
            size={22}
          />
          <h2>
            Connected journeys
          </h2>
          <p>
            Booking, account history, communication and haircare work together
            instead of living in disconnected systems.
          </p>
        </article>

        <article>
          <UsersRound
            size={22}
          />
          <h2>
            Human profiles
          </h2>
          <p>
            Customers and staff can personalise their profiles with
            photographs while keeping private contact details protected.
          </p>
        </article>
      </section>

      <section className="about-team-section">
        <header>
          <p className="customer-eyebrow">
            <UsersRound
              size={16}
            />
            Meet the team
          </p>
          <h2>
            The people behind the
            appointment.
          </h2>
          <p>
            Published stylist profiles show specialities, experience and a
            photograph selected by each professional.
          </p>
        </header>

        {error ? (
          <Alert
            type="error"
            title="Team profiles unavailable"
          >
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <div className="about-team-grid">
            {Array.from({
              length: 5,
            }).map(
              (_, index) => (
                <article
                  className="about-team-card"
                  key={
                    index
                  }
                >
                  <Skeleton className="about-team-photo" />
                  <div className="about-team-copy">
                    <Skeleton />
                    <Skeleton />
                    <Skeleton />
                  </div>
                </article>
              )
            )}
          </div>
        ) : null}

        {!loading &&
        !error &&
        team.length ? (
          <div className="about-team-grid">
            {team.map(
              (stylist) => (
                <TeamCard
                  key={
                    stylist._id
                  }
                  stylist={
                    stylist
                  }
                />
              )
            )}
          </div>
        ) : null}

        {!loading &&
        !error &&
        !team.length ? (
          <div className="about-team-empty">
            <UsersRound
              size={30}
            />
            <h3>
              Team profiles are ready
              to publish
            </h3>
            <p>
              Add or publish stylist profiles from the SalonAI management
              workspace to display them here.
            </p>
          </div>
        ) : null}
      </section>

      <section className="about-cta">
        <div>
          <p className="customer-eyebrow">
            <Sparkles
              size={16}
            />
            Your next visit
          </p>
          <h2>
            Start with the service
            that fits your goal.
          </h2>
        </div>

        <Link
          to="/services"
          className="app-button app-button-primary"
        >
          View services & prices
          <ArrowRight
            size={17}
          />
        </Link>
      </section>
    </main>
  );
}
