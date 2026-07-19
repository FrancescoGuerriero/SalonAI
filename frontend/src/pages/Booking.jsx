import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

import { BookingContext } from "../context/BookingContext.jsx";

const API_BASE_URL = "http://localhost:5000/api";

function Booking() {
  const bookingContext = useContext(BookingContext);
  const navigate = useNavigate();

  const booking = bookingContext?.booking;
  const setBooking = bookingContext?.setBooking;
  const clearBooking = bookingContext?.clearBooking;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setBooking((previousBooking) => ({
      ...previousBooking,
      [name]: value
    }));
  }

  async function submitBooking(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!booking?.service || !booking?.stylist) {
      setError("Select both a service and a stylist.");
      return;
    }

    if (!booking.appointmentDate || !booking.appointmentTime) {
      setError("Select an appointment date and time.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customer: "687f3a8e92d1a123456789ab",
          service: booking.service._id,
          stylist: booking.stylist._id,
          appointmentDate: booking.appointmentDate,
          appointmentTime: booking.appointmentTime,
          notes: ""
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Booking failed with status ${response.status}`);
      }

      console.log("Appointment created:", data);
      setSuccess("Appointment booked successfully.");
      clearBooking();

      window.setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    } catch (requestError) {
      console.error("Booking failed:", requestError);
      setError(requestError.message || "Booking failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!booking?.service || !booking?.stylist) {
    return (
      <main className="page">
        <h1>Booking information is incomplete</h1>
        <button type="button" onClick={() => navigate("/services")}>
          Start Booking
        </button>
      </main>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <main className="page narrow-page">
      <h1>Confirm Booking</h1>

      <section className="summary-box">
        <h2>Service</h2>
        <p>{booking.service.name}</p>
        <p>£{booking.service.price}</p>
        <p>{booking.service.duration} minutes</p>

        <h2>Stylist</h2>
        <p>{booking.stylist.name}</p>
      </section>

      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}

      <form onSubmit={submitBooking} className="form">
        <label htmlFor="appointmentDate">Appointment date</label>
        <input
          id="appointmentDate"
          type="date"
          name="appointmentDate"
          min={today}
          value={booking.appointmentDate}
          onChange={handleChange}
          required
        />

        <label htmlFor="appointmentTime">Appointment time</label>
        <select
          id="appointmentTime"
          name="appointmentTime"
          value={booking.appointmentTime}
          onChange={handleChange}
          required
        >
          <option value="">Choose time</option>
          <option value="09:00">09:00</option>
          <option value="11:00">11:00</option>
          <option value="14:30">14:30</option>
          <option value="16:00">16:00</option>
        </select>

        <button type="submit" disabled={loading}>
          {loading ? "Booking..." : "Confirm Appointment"}
        </button>
      </form>
    </main>
  );
}

export default Booking;
