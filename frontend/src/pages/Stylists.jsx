import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { BookingContext } from "../context/BookingContext.jsx";

const API_BASE_URL = "http://localhost:5000/api";

function Stylists() {
  const [stylists, setStylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const bookingContext = useContext(BookingContext);
  const navigate = useNavigate();

  const booking = bookingContext?.booking;

  useEffect(() => {
    async function fetchStylists() {
      try {
        setError("");

        const response = await fetch(`${API_BASE_URL}/stylists`);

        if (!response.ok) {
          throw new Error(`Stylists request failed with status ${response.status}`);
        }

        const data = await response.json();
        setStylists(Array.isArray(data) ? data : []);
      } catch (requestError) {
        console.error("Unable to load stylists:", requestError);
        setError(
          "Unable to load stylists. Confirm that the backend is running on port 5000."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchStylists();
  }, []);

  function selectStylist(stylist) {
    bookingContext.setBooking((previousBooking) => ({
      ...previousBooking,
      stylist
    }));

    navigate("/booking");
  }

  if (!booking?.service) {
    return (
      <main className="page">
        <h1>No service selected</h1>
        <p>Select a service before choosing a stylist.</p>
        <button type="button" onClick={() => navigate("/services")}>
          Return to Services
        </button>
      </main>
    );
  }

  if (loading) {
    return <main className="page"><h1>Loading stylists...</h1></main>;
  }

  return (
    <main className="page">
      <section className="summary-box">
        <h2>Selected Service</h2>
        <p>{booking.service.name}</p>
        <p>Price: £{booking.service.price}</p>
        <p>Duration: {booking.service.duration} minutes</p>
      </section>

      <h1>Choose Your Stylist</h1>

      {error && <p className="error-message">{error}</p>}

      {!error && stylists.length === 0 && <p>No stylists are available.</p>}

      <div className="card-grid">
        {stylists.map((stylist) => (
          <article className="card" key={stylist._id}>
            <h2>{stylist.name}</h2>
            <p>{stylist.speciality || "Hair stylist"}</p>
            <p>
              Experience: {stylist.experience ?? 0} years
            </p>

            <button type="button" onClick={() => selectStylist(stylist)}>
              Select
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}

export default Stylists;
