import {
  ArrowRight,
  Award,
  Star,
  UserRound,
} from "lucide-react";

import {
  getStylistBiography,
  getStylistImage,
  getStylistName,
  getStylistSpecialtyLabel,
} from "../../utils/stylists.js";

export default function StylistCard({
  stylist,
  onSelect,
}) {
  const experience = Number(
    stylist.experience ?? stylist.yearsExperience ?? 0
  );
  const name = getStylistName(stylist);
  const image = getStylistImage(stylist);

  return (
    <article className="customer-card stylist-card">
      <div className="stylist-avatar">
        {image ? (
          <img
            src={image}
            alt={`${name}, stylist`}
            loading="lazy"
          />
        ) : (
          <UserRound size={38} />
        )}
      </div>

      <div className="customer-card-body">
        <div>
          <p className="customer-card-kicker">
            {getStylistSpecialtyLabel(stylist)}
          </p>
          <h2>{name}</h2>
          <p>{getStylistBiography(stylist)}</p>
        </div>

        <div className="stylist-facts">
          <span>
            <Award size={16} />
            {experience} {experience === 1 ? "year" : "years"} experience
          </span>
          <span>
            <Star size={16} />
            {Number.isFinite(Number(stylist.rating))
              ? `${Number(stylist.rating).toFixed(1)} rating`
              : "Professional stylist"}
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
