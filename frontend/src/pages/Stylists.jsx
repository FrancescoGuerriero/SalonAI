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
import {
  useNavigate,
} from "react-router-dom";

import BookingProgress from "../components/customer/BookingProgress.jsx";
import StylistCard from "../components/customer/StylistCard.jsx";
import Alert from "../components/ui/Alert.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import {
  BookingContext,
} from "../context/BookingContext.jsx";
import stylistService from "../Services/stylistService.js";
import useFeatureControls from "../hooks/useFeatureControls.js";
import {
  getStylistSearchText,
  isStylistActive,
} from "../utils/stylists.js";

function normaliseStylists(data) {
  if (
    Array.isArray(
      data
    )
  ) {
    return data;
  }

  if (
    Array.isArray(
      data?.stylists
    )
  ) {
    return data.stylists;
  }

  return [];
}

export default function Stylists() {
  const [
    stylists,
    setStylists,
  ] = useState([]);
  const [
    query,
    setQuery,
  ] = useState("");
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    error,
    setError,
  ] = useState("");

  const bookingContext =
    useContext(
      BookingContext
    );
  const booking =
    bookingContext?.booking;
  const navigate =
    useNavigate();
  const selectedService =
    booking?.service ||
    null;

  const selectedServiceId =
    selectedService?._id ||
    selectedService?.id ||
    "";

  const {
    isFeatureEnabled,
  } =
    useFeatureControls();

  const publicTeamEnabled =
    isFeatureEnabled(
      "public-team"
    );

  const onlineBookingEnabled =
    isFeatureEnabled(
      "online-booking"
    );

  const activeModeEnabled =
    selectedService
      ? onlineBookingEnabled
      : publicTeamEnabled;

  async function loadStylists({
    signal,
  } = {}) {
    try {
      setLoading(
        true
      );
      setError("");

      if (
        !activeModeEnabled
      ) {
        setStylists([]);
        return;
      }

      const requestConfig =
        signal
          ? {
              signal,
            }
          : {};

      const data =
        selectedService
          ? await stylistService
              .getBookingStylists(
                selectedServiceId,
                requestConfig
              )
          : await stylistService
              .getPublicTeam(
                requestConfig
              );

      setStylists(
        normaliseStylists(
          data
        ).filter(
          isStylistActive
        )
      );
    } catch (
      requestError
    ) {
      if (
        requestError?.code ===
          "ERR_CANCELED" ||
        requestError?.name ===
          "CanceledError"
      ) {
        return;
      }

      console.error(
        "Unable to load stylists",
        requestError
      );

      setError(
        requestError
          .response
          ?.data
          ?.message ||
          "We could not load the stylists. Please try again."
      );
    } finally {
      if (
        !signal?.aborted
      ) {
        setLoading(
          false
        );
      }
    }
  }

  useEffect(() => {
    const controller =
      new AbortController();

    void loadStylists({
      signal:
        controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [
    activeModeEnabled,
    selectedServiceId,
  ]);

  const filteredStylists =
    useMemo(() => {
      const value =
        query
          .trim()
          .toLowerCase();

      if (!value) {
        return stylists;
      }

      return stylists.filter(
        (stylist) =>
          getStylistSearchText(
            stylist
          ).includes(
            value
          )
      );
    }, [
      query,
      stylists,
    ]);

  function selectStylist(
    stylist
  ) {
    if (
      !selectedService
    ) {
      navigate(
        "/services"
      );
      return;
    }

    bookingContext.setBooking(
      (current) => ({
        ...current,
        stylist,
        appointmentDate:
          "",
        appointmentTime:
          "",
      })
    );

    navigate(
      "/booking"
    );
  }

  return (
    <main className="customer-page">
      <div className="customer-page-container">
        {selectedService ? (
          <BookingProgress
            currentStep={2}
          />
        ) : null}

        {selectedService ? (
          <button
            type="button"
            className="customer-back-button"
            onClick={() =>
              navigate(
                "/services"
              )
            }
          >
            <ArrowLeft
              size={17}
            />
            Change service
          </button>
        ) : null}

        <header className="customer-page-header customer-page-header-split">
          <div>
            <p className="customer-eyebrow">
              <UserRoundSearch
                size={16}
              />
              {selectedService
                ? "Step 2 of 3"
                : "Salon team"}
            </p>

            <h1>
              {selectedService
                ? "Choose your stylist"
                : "Meet our stylists"}
            </h1>

            <p>
              {selectedService
                ? "Select the salon professional you would like to see for your appointment."
                : "Browse active salon professionals by name, experience and speciality. Choose a service when you are ready to book."}
            </p>
          </div>

          {selectedService ? (
            <article className="selected-service-card">
              <small>
                Selected
                service
              </small>
              <strong>
                {
                  selectedService.name
                }
              </strong>
              <span>
                £
                {Number(
                  selectedService.price ||
                    0
                ).toFixed(
                  2
                )}
                {" · "}
                {selectedService.duration ||
                  30}{" "}
                minutes
              </span>
            </article>
          ) : (
            <button
              type="button"
              className="customer-primary-button"
              onClick={() =>
                navigate(
                  "/services"
                )
              }
            >
              Browse services
            </button>
          )}
        </header>

        <label className="customer-search-field customer-search-wide">
          <Search
            size={19}
          />
          <span className="sr-only">
            Search stylists
          </span>
          <input
            type="search"
            value={
              query
            }
            onChange={(
              event
            ) =>
              setQuery(
                event.target
                  .value
              )
            }
            placeholder="Search by stylist or speciality"
          />
        </label>

        {error ? (
          <Alert
            type="error"
            title="Stylists unavailable"
          >
            <p>
              {error}
            </p>
            <button
              type="button"
              className="customer-inline-button"
              onClick={() =>
                loadStylists()
              }
            >
              <RefreshCw
                size={16}
              />
              Try again
            </button>
          </Alert>
        ) : null}

        {loading ? (
          <section className="customer-card-grid">
            {Array.from({
              length: 4,
            }).map(
              (_, index) => (
                <article
                  className="customer-card stylist-card customer-card-skeleton"
                  key={
                    index
                  }
                >
                  <Skeleton className="customer-skeleton-avatar" />

                  <div className="customer-card-body">
                    <div className="customer-card-content">
                      <Skeleton className="customer-skeleton-title" />
                      <Skeleton className="customer-skeleton-line" />
                      <Skeleton className="customer-skeleton-line short" />
                    </div>

                    <div className="customer-card-footer">
                      <Skeleton className="customer-skeleton-facts" />
                      <Skeleton className="customer-skeleton-action" />
                    </div>
                  </div>
                </article>
              )
            )}
          </section>
        ) : null}

        {!loading &&
        !error &&
        !activeModeEnabled ? (
          <EmptyState
            icon={
              UserRoundSearch
            }
            title={
              selectedService
                ? "Online booking is currently unavailable"
                : "Salon team profiles are currently hidden"
            }
            description={
              selectedService
                ? "The selected service remains available to browse, but online stylist selection is switched off."
                : "Public team profiles are switched off. Other customer services remain available."
            }
            action={
              <button
                type="button"
                className="customer-inline-button"
                onClick={() =>
                  navigate(
                    "/services"
                  )
                }
              >
                Browse services
              </button>
            }
          />
        ) : null}

        {!loading &&
        !error &&
        activeModeEnabled &&
        filteredStylists.length ===
          0 ? (
          <EmptyState
            icon={
              UserRoundSearch
            }
            title={
              stylists.length ===
              0
                ? selectedService
                  ? "No stylists are available for this service"
                  : "No active stylists are published yet"
                : "No matching stylists"
            }
            description={
              stylists.length ===
              0
                ? selectedService
                  ? "Choose a different service or try again shortly."
                  : "Published salon professionals will appear here."
                : "Try a different name or speciality."
            }
            action={
              <button
                type="button"
                className="customer-inline-button"
                onClick={
                  stylists.length ===
                  0
                    ? () =>
                        navigate(
                          "/services"
                        )
                    : () =>
                        setQuery(
                          ""
                        )
                }
              >
                {stylists.length ===
                0
                  ? "Browse services"
                  : "Clear search"}
              </button>
            }
          />
        ) : null}

        {!loading &&
        activeModeEnabled &&
        filteredStylists.length >
          0 ? (
          <section className="customer-card-grid">
            {filteredStylists.map(
              (
                stylist,
                index
              ) => (
                <StylistCard
                  key={
                    stylist._id
                  }
                  stylist={
                    stylist
                  }
                  onSelect={
                    selectedService ||
                    onlineBookingEnabled
                      ? selectStylist
                      : null
                  }
                  actionLabel={
                    selectedService
                      ? "Select stylist"
                      : "Choose a service"
                  }
                  priority={
                    index < 3
                  }
                />
              )
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
