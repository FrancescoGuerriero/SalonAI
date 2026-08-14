import {
  Star,
  UserRound,
} from "lucide-react";

function stylistName(stylist = {}) {
  const fullName =
    stylist.fullName ||
    [stylist.firstName, stylist.lastName]
      .filter(Boolean)
      .join(" ");

  return fullName || "Staff member";
}

function photoSource(stylist = {}) {
  return (
    stylist.profileImage ||
    stylist.profilePhoto ||
    stylist.photo ||
    ""
  );
}

function ratingValue(stylist = {}) {
  const rating = Number(
    stylist.rating ?? 0
  );

  return Number.isFinite(rating)
    ? rating
    : 0;
}

function reviewCount(stylist = {}) {
  const reviews = Number(
    stylist.reviews ?? 0
  );

  return Number.isFinite(reviews)
    ? reviews
    : 0;
}

export default function StylistCard({
  stylist,
  onEdit,
  onDelete,
  onToggleStatus,
}) {
  const name =
    stylistName(stylist);

  const photo =
    photoSource(stylist);

  const rating =
    ratingValue(stylist);

  const reviews =
    reviewCount(stylist);

  return (
    <article className="card shadow-sm h-100">
      <div
        className="d-flex align-items-center justify-content-center bg-light overflow-hidden"
        style={{
          minHeight: "240px",
        }}
      >
        {photo ? (
          <img
            src={photo}
            className="card-img-top"
            alt={`${name} profile`}
            style={{
              width: "100%",
              height: "240px",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            className="d-flex flex-column align-items-center justify-content-center text-secondary"
            role="img"
            aria-label={`${name} has no profile photograph`}
            style={{
              minHeight: "240px",
              width: "100%",
            }}
          >
            <UserRound
              size={72}
              strokeWidth={1.4}
            />

            <span className="mt-2 small fw-semibold">
              Staff photo
            </span>
          </div>
        )}
      </div>

      <div className="card-body">
        <h5>
          {name}
        </h5>

        <div className="mb-2 d-flex flex-wrap gap-2">
          <span className="badge bg-info text-dark">
            <Star
              size={13}
              className="me-1"
            />
            {rating.toFixed(1)}
          </span>

          <span className="badge bg-secondary">
            {reviews}{" "}
            {reviews === 1
              ? "Review"
              : "Reviews"}
          </span>
        </div>

        <p className="text-muted">
          {Number(
            stylist.yearsExperience ?? 0
          )}{" "}
          Years Experience
        </p>

        {stylist.biography ? (
          <p>
            {stylist.biography}
          </p>
        ) : (
          <p className="text-muted">
            No biography added yet.
          </p>
        )}

        <div className="mb-3">
          {stylist.specialties?.length ? (
            stylist.specialties.map(
              (item) => (
                <span
                  key={item}
                  className="badge bg-primary me-2 mb-2"
                >
                  {item}
                </span>
              )
            )
          ) : (
            <span className="text-muted small">
              No specialties added.
            </span>
          )}
        </div>

        <div>
          {stylist.isActive !== false ? (
            <span className="badge bg-success">
              Active
            </span>
          ) : (
            <span className="badge bg-danger">
              Inactive
            </span>
          )}
        </div>
      </div>

      <div className="card-footer bg-white">
        <button
          type="button"
          className="btn btn-outline-primary btn-sm me-2"
          onClick={() =>
            onEdit?.(stylist)
          }
        >
          Edit
        </button>

        <button
          type="button"
          className="btn btn-outline-warning btn-sm me-2"
          onClick={() =>
            onToggleStatus?.(
              stylist
            )
          }
        >
          {stylist.isActive !== false
            ? "Deactivate"
            : "Activate"}
        </button>

        <button
          type="button"
          className="btn btn-outline-danger btn-sm"
          onClick={() =>
            onDelete?.(stylist)
          }
        >
          Delete
        </button>
      </div>
    </article>
  );
}