import {
  RefreshCw,
  Scissors,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import Alert from "../components/ui/Alert.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import BookingProgress from "../components/customer/BookingProgress.jsx";
import ServiceCard from "../components/customer/ServiceCard.jsx";
import { BookingContext } from "../context/BookingContext.jsx";
import serviceService from "../services/serviceService.js";
import "../styles/customerExperience.css";

function normaliseServices(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.services)) return data.services;
  return [];
}

export default function Services() {
  const [services, setServices] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const bookingContext = useContext(BookingContext);
  const navigate = useNavigate();

  async function loadServices() {
    try {
      setLoading(true);
      setError("");

      const data = await serviceService.getServices();
      setServices(
        normaliseServices(data).filter(
          (service) => service.active !== false
        )
      );
    } catch (requestError) {
      console.error("Unable to load services", requestError);
      setError(
        requestError.response?.data?.message ||
          "We could not load the services. Check that the backend is running and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadServices();
  }, []);

  const categories = useMemo(() => {
    return [
      "all",
      ...new Set(
        services
          .map((service) => service.category)
          .filter(Boolean)
      ),
    ];
  }, [services]);

  const filteredServices = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();

    return services.filter((service) => {
      const matchesCategory =
        category === "all" ||
        service.category === category;

      const searchableText = [
        service.name,
        service.category,
        service.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesCategory &&
        (!normalisedQuery ||
          searchableText.includes(normalisedQuery))
      );
    });
  }, [category, query, services]);

  function handleSelect(service) {
    if (!bookingContext?.setBooking) {
      setError("The booking session is unavailable.");
      return;
    }

    bookingContext.setBooking((current) => ({
      ...current,
      service,
      stylist: null,
      appointmentDate: "",
      appointmentTime: "",
    }));

    navigate("/stylists");
  }

  return (
    <main className="customer-page">
      <div className="customer-page-container">
        <BookingProgress currentStep={1} />

        <header className="customer-page-header">
          <div>
            <p className="customer-eyebrow">
              <Scissors size={16} />
              Step 1 of 3
            </p>
            <h1>Choose your service</h1>
            <p>
              Browse treatments, compare duration and price,
              then select the service that suits you.
            </p>
          </div>
        </header>

        <section
          className="customer-filter-bar"
          aria-label="Service filters"
        >
          <label className="customer-search-field">
            <Search size={19} />
            <span className="sr-only">
              Search services
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search services"
            />
          </label>

          <label className="customer-select-field">
            <SlidersHorizontal size={18} />
            <span className="sr-only">
              Filter by category
            </span>
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item === "all"
                    ? "All categories"
                    : item}
                </option>
              ))}
            </select>
          </label>
        </section>

        {error ? (
          <Alert type="error" title="Services unavailable">
            <p>{error}</p>
            <button
              type="button"
              className="customer-inline-button"
              onClick={loadServices}
            >
              <RefreshCw size={16} />
              Try again
            </button>
          </Alert>
        ) : null}

        {loading ? (
          <section
            className="customer-card-grid"
            aria-label="Loading services"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <article
                className="customer-card customer-card-skeleton"
                key={index}
              >
                <Skeleton className="customer-skeleton-media" />
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
        filteredServices.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching services"
            description="Change your search or category filter to see more treatments."
            action={
              <button
                type="button"
                className="customer-inline-button"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
              >
                Clear filters
              </button>
            }
          />
        ) : null}

        {!loading && filteredServices.length > 0 ? (
          <>
            <p className="customer-results-count">
              {filteredServices.length}{" "}
              {filteredServices.length === 1
                ? "service"
                : "services"}{" "}
              available
            </p>

            <section className="customer-card-grid">
              {filteredServices.map((service) => (
                <ServiceCard
                  key={service._id}
                  service={service}
                  onSelect={handleSelect}
                />
              ))}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
