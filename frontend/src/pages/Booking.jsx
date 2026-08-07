import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Scissors,
  UserRound,
} from "lucide-react";
import {
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

import { createAppointment } from "../Services/appointmentApi.js";
import stylistService from "../Services/stylistService.js";
import BookingProgress from "../components/customer/BookingProgress.jsx";
import Alert from "../components/ui/Alert.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { BookingContext } from "../context/BookingContext.jsx";
import {
  getStylistName,
  getStylistSpecialtyLabel,
} from "../utils/stylists.js";
import "../styles/customerExperience.css";

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatAppointmentDate(value) {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value) || 0);
}

export default function Booking() {
  const bookingContext = useContext(BookingContext);
  const booking = bookingContext?.booking;
  const setBooking = bookingContext?.setBooking;
  const clearBooking = bookingContext?.clearBooking;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [completedBooking, setCompletedBooking] = useState(null);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilityVersion, setAvailabilityVersion] = useState(0);

  const today = useMemo(() => toDateInputValue(new Date()), []);
  const maximumDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 120);

    return toDateInputValue(date);
  }, []);

  const appointmentDate = booking?.appointmentDate || "";
  const serviceId = booking?.service?._id || "";
  const stylistId = booking?.stylist?._id || "";

  useEffect(() => {
    if (!appointmentDate || !serviceId || !stylistId) {
      setAvailableTimes([]);
      setAvailabilityError("");
      setAvailabilityLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    let active = true;

    async function loadAvailability() {
      try {
        setAvailabilityLoading(true);
        setAvailabilityError("");

        const data = await stylistService.getAvailability(
          stylistId,
          {
            date: appointmentDate,
            service: serviceId,
          },
          {
            signal: controller.signal,
          }
        );

        if (!active) {
          return;
        }

        const slots = Array.isArray(data?.slots) ? data.slots : [];
        setAvailableTimes(slots);

        setBooking((current) => {
          if (
            !current.appointmentTime ||
            slots.includes(current.appointmentTime)
          ) {
            return current;
          }

          return {
            ...current,
            appointmentTime: "",
          };
        });
      } catch (requestError) {
        if (
          !active ||
          requestError.code === "ERR_CANCELED" ||
          requestError.name === "CanceledError"
        ) {
          return;
        }

        console.error("Unable to load appointment availability", requestError);
        setAvailableTimes([]);
        setAvailabilityError(
          requestError.response?.data?.message ||
            "We could not check live availability. Please try again."
        );
      } finally {
        if (active) {
          setAvailabilityLoading(false);
        }
      }
    }

    loadAvailability();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    appointmentDate,
    availabilityVersion,
    serviceId,
    setBooking,
    stylistId,
  ]);

  function handleDateChange(event) {
    const { value } = event.target;

    setError("");
    setBooking((current) => ({
      ...current,
      appointmentDate: value,
      appointmentTime: "",
    }));
  }

  function handleTimeChange(event) {
    const { value } = event.target;

    setError("");
    setBooking((current) => ({
      ...current,
      appointmentTime: value,
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
      setError("Choose an available appointment date and time.");
      return;
    }

    if (!availableTimes.includes(booking.appointmentTime)) {
      setError(
        "That appointment time is no longer available. Choose another time."
      );
      setAvailabilityVersion((current) => current + 1);
      return;
    }

    try {
      setLoading(true);

      const { data } = await createAppointment({
        service: booking.service._id,
        stylist: booking.stylist._id,
        appointmentDate: booking.appointmentDate,
        appointmentTime: booking.appointmentTime,
      });

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

      if (requestError.response?.status === 409) {
        setBooking((current) => ({
          ...current,
          appointmentTime: "",
        }));
        setAvailabilityVersion((current) => current + 1);
      }
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

            <p className="customer-eyebrow">Appointment confirmed</p>

            <h1>You are booked in</h1>
            <p>Your SalonAI appointment has been created successfully.</p>

            <div className="booking-success-details">
              <div>
                <Scissors size={19} />
                <span>
                  <small>Service</small>
                  <strong>{completedBooking.service.name}</strong>
                </span>
              </div>

              <div>
                <UserRound size={19} />
                <span>
                  <small>Stylist</small>
                  <strong>{getStylistName(completedBooking.stylist)}</strong>
                </span>
              </div>

              <div>
                <CalendarCheck size={19} />
                <span>
                  <small>Date</small>
                  <strong>
                    {formatAppointmentDate(completedBooking.appointmentDate)}
                  </strong>
                </span>
              </div>

              <div>
                <Clock3 size={19} />
                <span>
                  <small>Time</small>
                  <strong>{completedBooking.appointmentTime}</strong>
                </span>
              </div>
            </div>

            {completedBooking.reference ? (
              <p className="booking-reference">
                Reference: {completedBooking.reference}
              </p>
            ) : null}

            <div className="booking-success-actions">
              <Link to="/account" className="customer-primary-link">
                View my account
              </Link>

              <Link to="/services" className="customer-secondary-link">
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

  const stylistName = getStylistName(booking.stylist);

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
              Live availability is checked for your selected service and
              stylist before you confirm.
            </p>
          </div>
        </header>

        <div className="booking-layout">
          <form className="booking-form-card" onSubmit={submitBooking}>
            <div className="booking-form-heading">
              <h2>Appointment schedule</h2>
              <p>Select an available date and appointment time.</p>
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
                  max={maximumDate}
                  value={appointmentDate}
                  onChange={handleDateChange}
                  required
                />
              </div>
            </label>

            <fieldset
              className="booking-time-fieldset"
              disabled={availabilityLoading || !appointmentDate}
              aria-busy={availabilityLoading}
            >
              <legend>Available appointment times</legend>

              {!appointmentDate ? (
                <p className="booking-availability-state">
                  Choose a date to see live availability.
                </p>
              ) : null}

              {availabilityLoading ? (
                <p className="booking-availability-state" role="status">
                  Checking live availability…
                </p>
              ) : null}

              {availabilityError && !availabilityLoading ? (
                <Alert type="error" title="Availability unavailable">
                  <p>{availabilityError}</p>
                  <button
                    type="button"
                    className="customer-inline-button"
                    onClick={() =>
                      setAvailabilityVersion((current) => current + 1)
                    }
                  >
                    <RefreshCw size={16} />
                    Try again
                  </button>
                </Alert>
              ) : null}

              {!availabilityLoading &&
              !availabilityError &&
              appointmentDate &&
              availableTimes.length === 0 ? (
                <p className="booking-availability-state" role="status">
                  No times are available on this date. Please choose another
                  day.
                </p>
              ) : null}

              {!availabilityLoading && availableTimes.length > 0 ? (
                <div className="booking-time-grid">
                  {availableTimes.map((time) => (
                    <label key={time}>
                      <input
                        type="radio"
                        name="appointmentTime"
                        value={time}
                        checked={booking.appointmentTime === time}
                        onChange={handleTimeChange}
                      />
                      <span>{time}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </fieldset>

            <button
              type="submit"
              className="customer-primary-button booking-submit-button"
              disabled={
                loading ||
                availabilityLoading ||
                !booking.appointmentTime ||
                !availableTimes.includes(booking.appointmentTime)
              }
            >
              {loading ? "Confirming appointment..." : "Confirm appointment"}
            </button>
          </form>

          <aside className="booking-summary-card">
            <p className="customer-eyebrow">Booking summary</p>
            <h2>Your appointment</h2>

            <div className="booking-summary-list">
              <div>
                <span>
                  <Scissors size={18} />
                </span>
                <div>
                  <small>Service</small>
                  <strong>{booking.service.name}</strong>
                  <p>{booking.service.duration || 30} minutes</p>
                </div>
              </div>

              <div>
                <span>
                  <UserRound size={18} />
                </span>
                <div>
                  <small>Stylist</small>
                  <strong>{stylistName}</strong>
                  <p>{getStylistSpecialtyLabel(booking.stylist)}</p>
                </div>
              </div>

              {appointmentDate ? (
                <div>
                  <span>
                    <CalendarCheck size={18} />
                  </span>
                  <div>
                    <small>Date and time</small>
                    <strong>{formatAppointmentDate(appointmentDate)}</strong>
                    <p>{booking.appointmentTime || "Choose a time"}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="booking-total">
              <span>Total</span>
              <strong>{formatPrice(booking.service.price)}</strong>
            </div>

            <p className="booking-summary-note">
              Availability is checked again when your booking is submitted.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
