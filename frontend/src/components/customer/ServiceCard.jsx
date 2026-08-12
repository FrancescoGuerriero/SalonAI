import {
  ArrowRight,
  Clock3,
  Image as ImageIcon,
  MessageCircle,
  Sparkles,
} from "lucide-react";

function formatPrice(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

function servicePrice(service) {
  if (service.priceLabel) return service.priceLabel;
  if (service.priceOnConsultation) return "Price on consultation";
  return formatPrice(service.price);
}

function durationLabel(service) {
  if (service.durationEstimated) {
    return "Duration confirmed when booking";
  }

  return `${service.duration || 30} minutes`;
}

export default function ServiceCard({
  service,
  onSelect,
  onConsult,
}) {
  const consultationOnly =
    service.onlineBookable === false ||
    service.priceOnConsultation === true;

  return (
    <article className="customer-card service-card">
      <div className="customer-card-media">
        {service.image ? (
          <img src={service.image} alt="" loading="lazy" />
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
            {durationLabel(service)}
          </span>
          <strong>{servicePrice(service)}</strong>
        </div>

        {consultationOnly ? (
          <button
            type="button"
            className="customer-card-action"
            onClick={() => onConsult(service)}
          >
            <MessageCircle size={17} />
            Book on WhatsApp
            <ArrowRight size={17} />
          </button>
        ) : (
          <button
            type="button"
            className="customer-card-action"
            onClick={() => onSelect(service)}
          >
            <Sparkles size={17} />
            Choose service
            <ArrowRight size={17} />
          </button>
        )}
      </div>
    </article>
  );
}
