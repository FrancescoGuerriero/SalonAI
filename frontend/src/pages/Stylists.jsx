import {
  ArrowLeft,
  RefreshCw,
  Search,
  UserRoundSearch,
} from "lucide-react";
import {
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import BookingProgress from "../components/customer/BookingProgress.jsx";
import StylistCard from "../components/customer/StylistCard.jsx";
import Alert from "../components/ui/Alert.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { BookingContext } from "../context/BookingContext.jsx";
import stylistService from "../Services/stylistService.js";
import "../styles/customerExperience.css";

function normaliseStylists(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.stylists)) return data.stylists;
  return [];
}

export default function Stylists() {
  const [stylists, setStylists] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const bookingContext = useContext(BookingContext);
  const booking = bookingContext?.booking;
  const navigate = useNavigate();

  async function loadStylists() {
    try {
      setLoading(true);
      setError("");

      const data = await stylistService.getStylists({
        active: true,
      });

      setStylists(
        normaliseStylists(data).filter(
          (stylist) => stylist.active !== false
        )
      );
    } catch (requestError) {
      console.error("Unable to load stylists", requestError);
      setError(
        requestError.response?.data?.message ||
          "We could not load the stylists. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStylists();
  }, []);

  const filteredStylists = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) return stylists;

    return stylists.filter((stylist) =>
      [
        stylist.name,
        stylist.speciality,
        stylist.specialty,
        stylist.bio,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [query, stylists]);

  function selectStylist(stylist) {
    bookingContext.setBooking((current) => ({
      ...current,
      stylist,
      appointmentDate: "",
      appointmentTime: "",
    }));

    navigate("/booking");
  }

  if (!booking?.service) {
    return (
      <main className="customer-page">
        <div className="customer-page-container">
          <EmptyState
            icon={UserRoundSearch}
            title="Choose a service first"
            description="Your stylist options will appear after you select a salon service."
            action={
              <button
                type="button"
                className="customer-primary-button"
                onClick={() => navigate("/services")}
              >
                Browse services
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
        <BookingProgress currentStep={2} />

        <button
          type="button"
          className="customer-back-button"
          onClick={() => navigate("/services")}
        >
          <ArrowLeft size={17} />
          Change service
        </button>

        <header className="customer-page-header customer-page-header-split">
          <div>
            <p className="customer-eyebrow">
              <UserRoundSearch size={16} />
              Step 2 of 3
            </p>
            <h1>Choose your stylist</h1>
            <p>
              Select the salon professional you would like
              to see for your appointment.
            </p>
          </div>

          <article className="selected-service-card">
            <small>Selected service</small>
            <strong>{booking.service.name}</strong>
            <span>
              £{Number(booking.service.price || 0).toFixed(2)}
              {" · "}
              {booking.service.duration || 30} minutes
            </span>
          </article>
        </header>

        <label className="customer-search-field customer-search-wide">
          <Search size={19} />
          <span className="sr-only">
            Search stylists
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search by stylist or speciality"
          />
        </label>

        {error ? (
          <Alert type="error" title="Stylists unavailable">
            <p>{error}</p>
            <button
              type="button"
              className="customer-inline-button"
              onClick={loadStylists}
            >
              <RefreshCw size={16} />
              Try again
            </button>
          </Alert>
        ) : null}

        {loading ? (
          <section className="customer-card-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <article
                className="customer-card stylist-card customer-card-skeleton"
                key={index}
              >
                <Skeleton className="customer-skeleton-avatar" />
                <div className="customer-card-body">
                  <Skeleton className="customer-skeleton-title" />
                  <Skeleton className="customer-skeleton-line" />
                  <Skeleton className="customer-skeleton-line short" />
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {!loading &&
        !error &&
        filteredStylists.length === 0 ? (
          <EmptyState
            icon={UserRoundSearch}
            title="No matching stylists"
            description="Try a different name or speciality."
            action={
              <button
                type="button"
                className="customer-inline-button"
                onClick={() => setQuery("")}
              >
                Clear search
              </button>
            }
          />
        ) : null}

        {!loading && filteredStylists.length > 0 ? (
          <section className="customer-card-grid">
            {filteredStylists.map((stylist) => (
              <StylistCard
                key={stylist._id}
                stylist={stylist}
                onSelect={selectStylist}
              />
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
