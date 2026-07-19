import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { BookingContext } from "../context/BookingContext.jsx";

const API_BASE_URL = "http://localhost:5000/api";

function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const bookingContext = useContext(BookingContext);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchServices() {
      try {
        setError("");

        const response = await fetch(`${API_BASE_URL}/services`);

        if (!response.ok) {
          throw new Error(`Services request failed with status ${response.status}`);
        }

        const data = await response.json();
        setServices(Array.isArray(data) ? data : []);
      } catch (requestError) {
        console.error("Unable to load services:", requestError);
        setError(
          "Unable to load services. Confirm that the backend is running on port 5000."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchServices();
  }, []);

  function handleBookNow(service) {
    if (!bookingContext) {
      setError("Booking context is unavailable.");
      return;
    }

    bookingContext.setBooking((previousBooking) => ({
      ...previousBooking,
      service,
      stylist: null,
      appointmentDate: "",
      appointmentTime: ""
    }));

    navigate("/stylists");
  }

  if (loading) {
    return <main className="page"><h1>Loading services...</h1></main>;
  }

  return (
    <main className="page">
      <h1>Our Services</h1>

      {error && <p className="error-message">{error}</p>}

      {!error && services.length === 0 && <p>No services are available.</p>}

      <div className="card-grid">
        {services.map((service) => (
          <article className="card" key={service._id}>
            {service.image ? (
              <img
                src={service.image}
                alt={service.name}
                className="card-image"
              />
            ) : (
              <div className="image-placeholder">Salon Service</div>
            )}

            <h2>{service.name}</h2>
            <p><strong>{service.category}</strong></p>
            <p>{service.description}</p>
            <p>Price: £{service.price}</p>
            <p>Duration: {service.duration} minutes</p>

            <button type="button" onClick={() => handleBookNow(service)}>
              Book Now
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}

export default Services;
