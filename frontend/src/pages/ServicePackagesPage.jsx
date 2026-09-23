import {
  CalendarClock,
  CheckCircle2,
  Layers3,
  PackagePlus,
  Scissors,
  ShoppingCart,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

import useAuth from "../hooks/useAuth.js";
import useCart from "../hooks/useCart.js";
import servicePackageService from "../Services/servicePackageService.js";
import { formatCurrency } from "../utils/currency.js";
import "./ServicePackages.css";

function listFrom(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
}

function serviceName(credit) {
  return (
    credit?.service?.name ||
    "Salon service"
  );
}

function includedRetailValue(
  definition
) {
  return (
    definition?.includedServices ||
    []
  ).reduce(
    (total, credit) =>
      total +
      Number(
        credit?.service?.price ||
          0
      ) *
        Number(
          credit?.sessions ||
            0
        ),
    0
  );
}

function packageSavings(
  definition
) {
  const retail =
    includedRetailValue(
      definition
    );
  const price = Number(
    definition?.price || 0
  );

  return Math.max(
    0,
    retail - price
  );
}

function expiryLabel(value) {
  if (!value) {
    return "No expiry date";
  }

  const date = new Date(
    value
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Expiry unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function remainingSessions(
  entitlement
) {
  return (
    entitlement?.credits ||
    []
  ).reduce(
    (sum, credit) =>
      sum +
      Math.max(
        0,
        Number(
          credit?.remaining ||
            0
        )
      ),
    0
  );
}

export default function ServicePackagesPage() {
  const navigate =
    useNavigate();
  const {
    isAuthenticated,
  } = useAuth();
  const {
    addServicePackage,
  } = useCart();

  const [
    packages,
    setPackages,
  ] = useState([]);
  const [
    entitlements,
    setEntitlements,
  ] = useState([]);
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const requests = [
        servicePackageService
          .listCatalogue(),
      ];

      if (
        isAuthenticated
      ) {
        requests.push(
          servicePackageService
            .listMine()
        );
      }

      const results =
        await Promise.allSettled(
          requests
        );

      if (!active) {
        return;
      }

      if (
        results[0]?.status ===
        "fulfilled"
      ) {
        setPackages(
          listFrom(
            results[0].value
          )
        );
      } else {
        setError(
          results[0]?.reason
            ?.response?.data
            ?.message ||
            "Service packages could not be loaded."
        );
      }

      if (
        isAuthenticated &&
        results[1]?.status ===
          "fulfilled"
      ) {
        setEntitlements(
          listFrom(
            results[1].value
          )
        );
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [
    isAuthenticated,
  ]);

  const activeEntitlements =
    useMemo(
      () =>
        entitlements.filter(
          (item) =>
            [
              "active",
              "exhausted",
            ].includes(
              String(
                item?.status ||
                  ""
              ).toLowerCase()
            )
        ),
      [
        entitlements,
      ]
    );

  function addPackage(
    definition
  ) {
    addServicePackage(
      definition
    );
    navigate("/cart");
  }

  return (
    <main className="page package-page">
      <header className="package-hero">
        <div>
          <span className="commerce-eyebrow">
            Prepaid salon care
          </span>
          <h1>
            Service packages
          </h1>
          <p>
            Buy a defined bundle of
            salon sessions once, then
            redeem the included credits
            against eligible future
            appointments before the
            package expires.
          </p>
        </div>
        <Layers3
          size={48}
          aria-hidden="true"
        />
      </header>

      {error ? (
        <div
          className="error-message"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {isAuthenticated ? (
        <section
          className="package-section"
          aria-labelledby="my-packages-heading"
        >
          <div className="package-section-heading">
            <div>
              <span className="commerce-eyebrow">
                Your credits
              </span>
              <h2 id="my-packages-heading">
                My service packages
              </h2>
              <p>
                Remaining sessions are
                read from your live
                package entitlement
                ledger.
              </p>
            </div>
            <Link
              className="app-button app-button-secondary"
              to="/booking"
            >
              Book a service
            </Link>
          </div>

          {loading ? (
            <div className="package-empty">
              Loading your package
              credits…
            </div>
          ) : activeEntitlements.length ? (
            <div className="package-entitlement-grid">
              {activeEntitlements.map(
                (entitlement) => (
                  <article
                    className="package-entitlement-card"
                    key={
                      entitlement._id
                    }
                  >
                    <div className="package-card-topline">
                      <span className="package-status">
                        {
                          entitlement.status
                        }
                      </span>
                      <span>
                        {
                          remainingSessions(
                            entitlement
                          )
                        }{" "}
                        session
                        {remainingSessions(
                          entitlement
                        ) === 1
                          ? ""
                          : "s"}{" "}
                        remaining
                      </span>
                    </div>
                    <h3>
                      {entitlement
                        ?.servicePackage
                        ?.name ||
                        "Service package"}
                    </h3>
                    <p className="package-expiry">
                      <CalendarClock
                        size={16}
                        aria-hidden="true"
                      />
                      Valid until{" "}
                      {expiryLabel(
                        entitlement
                          .expiresAt
                      )}
                    </p>
                    <ul className="package-credit-list">
                      {(
                        entitlement.credits ||
                        []
                      ).map(
                        (
                          credit
                        ) => (
                          <li
                            key={
                              credit
                                ._id ||
                              credit
                                .service
                                ?._id
                            }
                          >
                            <span>
                              <Scissors
                                size={
                                  15
                                }
                                aria-hidden="true"
                              />
                              {serviceName(
                                credit
                              )}
                            </span>
                            <strong>
                              {
                                credit.remaining
                              }
                              /
                              {
                                credit.purchased
                              }
                            </strong>
                          </li>
                        )
                      )}
                    </ul>
                  </article>
                )
              )}
            </div>
          ) : (
            <div className="package-empty">
              You do not have an active
              package yet. Choose one
              below and complete secure
              checkout to create your
              credits.
            </div>
          )}
        </section>
      ) : (
        <section className="package-signin-note">
          <CheckCircle2
            size={20}
            aria-hidden="true"
          />
          <p>
            You can browse now. Sign in
            before checkout so purchased
            credits can be attached to
            your customer profile.
          </p>
          <Link
            to="/login"
            className="app-button app-button-secondary"
          >
            Sign in
          </Link>
        </section>
      )}

      <section
        className="package-section"
        aria-labelledby="package-catalogue-heading"
      >
        <div className="package-section-heading">
          <div>
            <span className="commerce-eyebrow">
              Available now
            </span>
            <h2 id="package-catalogue-heading">
              Package catalogue
            </h2>
            <p>
              Every package price,
              service and validity period
              is revalidated by the
              server when checkout is
              created.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="package-empty">
            Loading packages…
          </div>
        ) : packages.length ? (
          <div className="package-catalogue-grid">
            {packages.map(
              (definition) => {
                const savings =
                  packageSavings(
                    definition
                  );

                return (
                  <article
                    className="package-catalogue-card"
                    key={
                      definition._id
                    }
                  >
                    <div className="package-card-topline">
                      <span className="package-code">
                        {
                          definition.code
                        }
                      </span>
                      <span>
                        {
                          definition.validityDays
                        }{" "}
                        days
                      </span>
                    </div>

                    <div>
                      <h3>
                        {
                          definition.name
                        }
                      </h3>
                      <p>
                        {definition.description ||
                          "A prepaid SalonAI service bundle."}
                      </p>
                    </div>

                    <ul className="package-service-list">
                      {(
                        definition.includedServices ||
                        []
                      ).map(
                        (
                          credit
                        ) => (
                          <li
                            key={
                              credit
                                .service
                                ?._id ||
                              credit
                                .service
                            }
                          >
                            <span>
                              {
                                credit.sessions
                              }{" "}
                              ×{" "}
                              {serviceName(
                                credit
                              )}
                            </span>
                            {credit
                              .service
                              ?.duration ? (
                              <small>
                                {
                                  credit
                                    .service
                                    .duration
                                }{" "}
                                min each
                              </small>
                            ) : null}
                          </li>
                        )
                      )}
                    </ul>

                    <div className="package-price-row">
                      <div>
                        <strong>
                          {formatCurrency(
                            definition.price
                          )}
                        </strong>
                        {savings >
                        0 ? (
                          <small>
                            Save{" "}
                            {formatCurrency(
                              savings
                            )}{" "}
                            vs individual
                            listed prices
                          </small>
                        ) : (
                          <small>
                            Prepaid package
                            price
                          </small>
                        )}
                      </div>
                      <button
                        type="button"
                        className="app-button app-button-primary"
                        onClick={() =>
                          addPackage(
                            definition
                          )
                        }
                      >
                        <ShoppingCart
                          size={17}
                          aria-hidden="true"
                        />
                        Add package
                      </button>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        ) : (
          <div className="package-empty">
            No service packages are
            currently published.
          </div>
        )}
      </section>

      <footer className="package-trust-note">
        <PackagePlus
          size={20}
          aria-hidden="true"
        />
        <p>
          Package credits are created
          only after successful payment.
          Booking a covered service does
          not consume a credit until the
          package is explicitly redeemed
          against that appointment.
        </p>
      </footer>
    </main>
  );
}
