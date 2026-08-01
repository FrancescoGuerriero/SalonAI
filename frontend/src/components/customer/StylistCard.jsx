import {
  ArrowRight,
  Award,
  Star,
  UserRound,
} from "lucide-react";

export default function StylistCard({
  stylist,
  onSelect,
}) {
  const experience = Number(
    stylist.experience ?? stylist.yearsExperience ?? 0
  );

  return (
    <article className="customer-card stylist-card">
      <div className="stylist-avatar">
        {stylist.image || stylist.avatar ? (
          <img
            src={stylist.image || stylist.avatar}
            alt=""
            loading="lazy"
          />
        ) : (
          <UserRound size={38} />
        )}
      </div>

      <div className="customer-card-body">
        <div>
          <p className="customer-card-kicker">
            {stylist.speciality ||
              stylist.specialty ||
              "Hair stylist"}
          </p>
          <h2>{stylist.name}</h2>
          <p>
            {stylist.bio ||
              "Focused on personalised consultations and polished, wearable results."}
          </p>
        </div>

        <div className="stylist-facts">
          <span>
            <Award size={16} />
            {experience} {experience === 1 ? "year" : "years"} experience
          </span>
          <span>
            <Star size={16} />
            Professional stylist
          </span>
        </div>

        <button
          type="button"
          className="customer-card-action"
          onClick={() => onSelect(stylist)}
        >
          Select stylist
          <ArrowRight size={17} />
        </button>
      </div>
    </article>
  );
}
