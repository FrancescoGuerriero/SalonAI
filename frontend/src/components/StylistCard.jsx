export default function StylistCard({
    stylist,
    onEdit,
    onDelete,
    onToggleStatus
}) {

    return (

        <div className="card shadow-sm h-100">

            <img
                src={
                    stylist.profileImage ||
                    "https://placehold.co/600x400?text=Stylist"
                }
                className="card-img-top"
                alt={stylist.fullName}
            />

            <div className="card-body">

                <h5>

                    {stylist.firstName} {stylist.lastName}

                </h5>

                <div className="mb-2">

                    <span className="badge bg-info">

                        ⭐ {stylist.rating.toFixed(1)}

                    </span>

                    <span className="badge bg-secondary ms-2">

                        {stylist.reviews} Reviews

                    </span>

                </div>

                <p className="text-muted">

                    {stylist.yearsExperience} Years Experience

                </p>

                <p>

                    {stylist.biography}

                </p>

                <div className="mb-3">

                    {stylist.specialties?.map((item) => (

                        <span
                            key={item}
                            className="badge bg-primary me-2 mb-2"
                        >

                            {item}

                        </span>

                    ))}

                </div>

                <div>

                    {stylist.isActive ? (

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
                    className="btn btn-outline-primary btn-sm me-2"
                    onClick={() => onEdit(stylist)}
                >

                    Edit

                </button>

                <button
                    className="btn btn-outline-warning btn-sm me-2"
                    onClick={() => onToggleStatus(stylist)}
                >

                    {stylist.isActive
                        ? "Deactivate"
                        : "Activate"}

                </button>

                <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => onDelete(stylist)}
                >

                    Delete

                </button>

            </div>

        </div>

    );

}