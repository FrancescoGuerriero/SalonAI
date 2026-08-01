import {
  ArrowRight,
  Clock3,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";

function formatPrice(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

export default function ServiceCard({
  service,
  onSelect,
}) {
  return (
    <article className="customer-card service-card">
      <div className="customer-card-media">
        {service.image ? (
          <img
            src={service.image}
            alt=""
            loading="lazy"
          />
        ) : (
          <div className="customer-card-placeholder">
            <ImageIcon size={30} />
            <span>SalonAI service</span>
          </div>
        )}

        <span className="customer-card-category">
          {service.category || "Hair service"}
        </span>
      </div>

      <div className="customer-card-body">
        <div>
          <h2>{service.name}</h2>
          <p>
            {service.description ||
              "A personalised salon experience delivered by our professional team."}
          </p>
        </div>

        <div className="customer-card-meta">
          <span>
            <Clock3 size={16} />
            {service.duration || 30} minutes
          </span>
          <strong>{formatPrice(service.price)}</strong>
        </div>

        <button
          type="button"
          className="customer-card-action"
          onClick={() => onSelect(service)}
        >
          <Sparkles size={17} />
          Choose service
          <ArrowRight size={17} />
        </button>
      </div>
    </article>
  );
}
