import {
  useCallback,
  useEffect,
  useState
} from "react";

import { useNavigate } from "react-router-dom";

import LoadingSpinner from "../components/LoadingSpinner.jsx";
import useAuth from "../hooks/useAuth.js";
import appointmentService from "../services/appointmentService.js";

function Dashboard() {
  const navigate = useNavigate();

  const {
    user,
    logout
  } = useAuth();

  const [appointments, setAppointments] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadAppointments = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");

        const data =
          await appointmentService.getMyAppointments();

        setAppointments(data);
      } catch (requestError) {
        console.error(
          "Failed to load appointments:",
          requestError
        );

        setError(
          requestError.response?.data?.message ||
          requestError.message ||
          "Unable to load your appointments."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  function handleLogout() {
    logout();

    navigate("/login", {
      replace: true
    });
  }

  function formatDate(dateValue) {
    if (!dateValue) {
      return "Date unavailable";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    return new Intl.DateTimeFormat(
      "en-GB",
      {
        day: "2-digit",
        month: "long",
        year: "numeric"
      }
    ).format(date);
  }

  function formatPrice(price) {
    const numericPrice = Number(price);

    if (Number.isNaN(numericPrice)) {
      return "Price unavailable";
    }

    return new Intl.NumberFormat(
      "en-GB",
      {
        style: "currency",
        currency: "GBP"
      }
    ).format(numericPrice);
  }

  if (loading) {
    return (
      <LoadingSpinner message="Loading your appointments..." />
    );
  }

  return (
    <main className="page">
      <section className="dashboard-header">
        <div>
          <h1>
            Welcome
            {user?.name
              ? `, ${user.name}`
              : " to SalonAI"}
          </h1>

          <p>
            {user?.email
              ? `Signed in as ${user.email}`
              : "Manage your SalonAI account and bookings."}
          </p>
        </div>

        <div className="button-row">
          <button
            type="button"
            onClick={() =>
              navigate("/services")
            }
          >
            Book Appointment
          </button>

          <button
            type="button"
            className="danger-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <h2>My Appointments</h2>

            <p>
              View your current and upcoming
              salon bookings.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAppointments}
          >
            Refresh
          </button>
        </div>

        {error && (
          <div
            className="error-message"
            role="alert"
          >
            <p>{error}</p>

            <button
              type="button"
              onClick={loadAppointments}
            >
              Try Again
            </button>
          </div>
        )}

        {!error &&
          appointments.length === 0 && (
            <div className="empty-state">
              <h3>No appointments yet</h3>

              <p>
                Choose a service and stylist
                to create your first booking.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate("/services")
                }
              >
                Browse Services
              </button>
            </div>
          )}

        {!error &&
          appointments.length > 0 && (
            <div className="appointment-grid">
              {appointments.map(
                (appointment) => {
                  const service =
                    appointment.service;

                  const stylist =
                    appointment.stylist;

                  return (
                    <article
                      key={appointment._id}
                      className="appointment-card"
                    >
                      <div className="appointment-card-header">
                        <div>
                          <h3>
                            {service?.name ||
                              "Salon appointment"}
                          </h3>

                          <p>
                            With{" "}
                            {stylist?.name ||
                              "Stylist unavailable"}
                          </p>
                        </div>

                        <span className="status-badge">
                          {appointment.status ||
                            "booked"}
                        </span>
                      </div>

                      <dl className="appointment-details">
                        <div>
                          <dt>Date</dt>
                          <dd>
                            {formatDate(
                              appointment.date
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt>Time</dt>
                          <dd>
                            {appointment.time ||
                              "Time unavailable"}
                          </dd>
                        </div>

                        <div>
                          <dt>Duration</dt>
                          <dd>
                            {service?.duration
                              ? `${service.duration} minutes`
                              : "Unavailable"}
                          </dd>
                        </div>

                        <div>
                          <dt>Price</dt>
                          <dd>
                            {formatPrice(
                              service?.price
                            )}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  );
                }
              )}
            </div>
          )}
      </section>
    </main>
  );
}

export default Dashboard;