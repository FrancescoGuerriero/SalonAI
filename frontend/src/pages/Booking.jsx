import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Scissors,
  UserRound,
} from "lucide-react";
import {
  useContext,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

import API from "../api/axios.js";
import BookingProgress from "../components/customer/BookingProgress.jsx";
import Alert from "../components/ui/Alert.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { BookingContext } from "../context/BookingContext.jsx";
import "../styles/customerExperience.css";

const appointmentTimes = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
];

export default function Booking() {
  const bookingContext = useContext(BookingContext);
  const booking = bookingContext?.booking;
  const setBooking = bookingContext?.setBooking;
  const clearBooking = bookingContext?.clearBooking;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [completedBooking, setCompletedBooking] =
    useState(null);

  const today = useMemo(
    () => new Date().toISOString().split("T")[0],
    []
  );

  function handleChange(event) {
    const { name, value } = event.target;

    setBooking((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function submitBooking(event) {
    event.preventDefault();
    setError("");

    if (!booking?.service || !booking?.stylist) {
      setError("Select a service and stylist before continuing.");
      return;
    }

    if (!booking.appointmentDate || !booking.appointmentTime) {
      setError("Choose an appointment date and time.");
      return;
    }

    try {
      setLoading(true);

      const { data } = await API.post(
        "/appointments",
        {
          service: booking.service._id,
          stylist: booking.stylist._id,
          date: booking.appointmentDate,
          time: booking.appointmentTime,
          appointmentDate: booking.appointmentDate,
          appointmentTime: booking.appointmentTime,
        }
      );

      setCompletedBooking({
        ...booking,
        reference:
          data?.appointment?.reference ||
          data?.reference ||
          data?.appointment?._id ||
          data?._id,
      });

      clearBooking();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      console.error("Booking failed", requestError);
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "The appointment could not be booked. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (completedBooking) {
    return (
      <main className="customer-page">
        <div className="customer-page-container customer-confirmation-container">
          <section className="booking-success-card">
            <span className="booking-success-icon">
              <CheckCircle2 size={38} />
            </span>

            <p className="customer-eyebrow">
              Appointment confirmed
            </p>

            <h1>You are booked in</h1>
            <p>
              Your SalonAI appointment has been created
              successfully.
            </p>

            <div className="booking-success-details">
              <div>
                <Scissors size={19} />
                <span>
                  <small>Service</small>
                  <strong>
                    {completedBooking.service.name}
                  </strong>
                </span>
              </div>

              <div>
                <UserRound size={19} />
                <span>
                  <small>Stylist</small>
                  <strong>
                    {completedBooking.stylist.name}
                  </strong>
                </span>
              </div>

              <div>
                <CalendarCheck size={19} />
                <span>
                  <small>Date</small>
                  <strong>
                    {completedBooking.appointmentDate}
                  </strong>
                </span>
              </div>

              <div>
                <Clock3 size={19} />
                <span>
                  <small>Time</small>
                  <strong>
                    {completedBooking.appointmentTime}
                  </strong>
                </span>
              </div>
            </div>

            {completedBooking.reference ? (
              <p className="booking-reference">
                Reference: {completedBooking.reference}
              </p>
            ) : null}

            <div className="booking-success-actions">
              <Link
                to="/dashboard"
                className="customer-primary-link"
              >
                View my account
              </Link>

              <Link
                to="/services"
                className="customer-secondary-link"
              >
                Book another appointment
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!booking?.service || !booking?.stylist) {
    return (
      <main className="customer-page">
        <div className="customer-page-container">
          <EmptyState
            icon={CalendarCheck}
            title="Booking details are incomplete"
            description="Choose your service and stylist before selecting an appointment time."
            action={
              <button
                type="button"
                className="customer-primary-button"
                onClick={() => navigate("/services")}
              >
                Start booking
              </button>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <main className="customer-page">
      <div className="customer-page-container">
        <BookingProgress currentStep={3} />

        <button
          type="button"
          className="customer-back-button"
          onClick={() => navigate("/stylists")}
        >
          <ArrowLeft size={17} />
          Change stylist
        </button>

        <header className="customer-page-header">
          <div>
            <p className="customer-eyebrow">
              <CalendarCheck size={16} />
              Step 3 of 3
            </p>
            <h1>Choose a date and time</h1>
            <p>
              Review your selection and confirm your
              appointment.
            </p>
          </div>
        </header>

        <div className="booking-layout">
          <form
            className="booking-form-card"
            onSubmit={submitBooking}
          >
            <div className="booking-form-heading">
              <h2>Appointment schedule</h2>
              <p>
                Select an available date and preferred time.
              </p>
            </div>

            {error ? (
              <Alert type="error" title="Booking not completed">
                {error}
              </Alert>
            ) : null}

            <label className="booking-field">
              <span>Appointment date</span>
              <div>
                <CalendarCheck size={18} />
                <input
                  type="date"
                  name="appointmentDate"
                  min={today}
                  value={booking.appointmentDate || ""}
                  onChange={handleChange}
                  required
                />
              </div>
            </label>

            <fieldset className="booking-time-fieldset">
              <legend>Appointment time</legend>
              <div className="booking-time-grid">
                {appointmentTimes.map((time) => (
                  <label key={time}>
                    <input
                      type="radio"
                      name="appointmentTime"
                      value={time}
                      checked={
                        booking.appointmentTime === time
                      }
                      onChange={handleChange}
                    />
                    <span>{time}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <button
              type="submit"
              className="customer-primary-button booking-submit-button"
              disabled={loading}
            >
              {loading
                ? "Confirming appointment..."
                : "Confirm appointment"}
            </button>
          </form>

          <aside className="booking-summary-card">
            <p className="customer-eyebrow">
              Booking summary
            </p>
            <h2>Your appointment</h2>

            <div className="booking-summary-list">
              <div>
                <span>
                  <Scissors size={18} />
                </span>
                <div>
                  <small>Service</small>
                  <strong>{booking.service.name}</strong>
                  <p>
                    {booking.service.duration || 30} minutes
                  </p>
                </div>
              </div>

              <div>
                <span>
                  <UserRound size={18} />
                </span>
                <div>
                  <small>Stylist</small>
                  <strong>{booking.stylist.name}</strong>
                  <p>
                    {booking.stylist.speciality ||
                      booking.stylist.specialty ||
                      "Salon professional"}
                  </p>
                </div>
              </div>
            </div>

            <div className="booking-total">
              <span>Total</span>
              <strong>
                £{Number(booking.service.price || 0).toFixed(2)}
              </strong>
            </div>

            <p className="booking-summary-note">
              Appointment availability is confirmed when
              your booking is submitted.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
