import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Gift,
  PackageCheck,
  Scissors,
  Sparkles,
  Star,
  UserRound,
  MapPin,
} from "lucide-react";

import useAuth from "../hooks/useAuth.js";
import { getAppointments } from "../Services/appointmentApi.js";
import commerceService from "../Services/commerceService.js";
import AccountSection from "../components/account/AccountSection.jsx";
import AccountSummaryCard from "../components/account/AccountSummaryCard.jsx";
import Alert from "../components/ui/Alert.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import {
  profileInitials,
} from "../utils/profileMedia.js";

function unwrapList(response, keys = []) {
  const payload = response?.data ?? response ?? {};
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return Array.isArray(payload) ? payload : [];
}

function appointmentDate(item) {
  return item?.appointmentDate ?? item?.date ?? item?.startAt ?? null;
}

function formatDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatMoney(value) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number.isFinite(amount) ? amount : 0);
}

export default function CustomerAccountPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      setLoading(true);
      setError("");

      const results = await Promise.allSettled([
        getAppointments(),
        commerceService.listMyOrders(),
      ]);

      if (!active) return;

      const appointmentResult = results[0];
      const orderResult = results[1];

      if (appointmentResult.status === "fulfilled") {
        setAppointments(
          unwrapList(appointmentResult.value, [
            "appointments",
            "items",
            "results",
          ])
        );
      }

      if (orderResult.status === "fulfilled") {
        setOrders(
          unwrapList(orderResult.value, ["orders", "items", "results"])
        );
      }

      if (results.every((result) => result.status === "rejected")) {
        setError("We could not load your account activity. Please try again.");
      }

      setLoading(false);
    }

    loadAccount();
    return () => {
      active = false;
    };
  }, []);

  const now = Date.now();

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((item) => {
          const value = appointmentDate(item);
          const time = value ? new Date(value).getTime() : NaN;
          return Number.isFinite(time) && time >= now;
        })
        .sort(
          (a, b) =>
            new Date(appointmentDate(a)).getTime() -
            new Date(appointmentDate(b)).getTime()
        ),
    [appointments, now]
  );

  const completedAppointments = appointments.filter((item) =>
    ["completed", "complete"].includes(String(item?.status).toLowerCase())
  );

  const totalSpent = orders.reduce(
    (sum, order) =>
      sum +
      Number(
        order?.total ??
          order?.totalAmount ??
          order?.pricing?.total ??
          0
      ),
    0
  );

  const firstName =
    user?.name?.trim()?.split(/\s+/)?.[0] ||
    user?.firstName ||
    "there";

  return (
    <main className="account-page">
      <section className="account-hero">
        <div className="account-hero-identity">
          <span className="account-profile-avatar">
            {user?.profilePhoto ? (
              <img
                src={user.profilePhoto}
                alt={`${user?.name || "Customer"} profile`}
              />
            ) : (
              profileInitials(user?.name || firstName)
            )}
          </span>

          <div>
            <span className="account-eyebrow">
              <Sparkles size={16} />
              Customer account
            </span>
            <h1>Welcome back, {firstName}</h1>
            <p>
              Manage appointments, purchases and your SalonAI customer journey
              from one place.
            </p>
          </div>
        </div>

        <div className="account-hero-actions">
          <Link to="/account/manage" className="app-button app-button-secondary">
            Edit profile
          </Link>
          <Link to="/booking" className="app-button app-button-primary">
            Book an appointment
          </Link>
        </div>
      </section>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <section className="account-summary-grid" aria-label="Account summary">
        <AccountSummaryCard
          label="Upcoming"
          value={loading ? "—" : upcomingAppointments.length}
          detail="appointments"
          icon={CalendarDays}
        />
        <AccountSummaryCard
          label="Completed visits"
          value={loading ? "—" : completedAppointments.length}
          detail="recorded services"
          icon={Scissors}
        />
        <AccountSummaryCard
          label="Orders"
          value={loading ? "—" : orders.length}
          detail={`${formatMoney(totalSpent)} total`}
          icon={PackageCheck}
        />
        <AccountSummaryCard
          label="Membership"
          value="SalonAI"
          detail="customer account"
          icon={Star}
        />
      </section>

      <div className="account-content-grid">
        <AccountSection
          title="Upcoming appointments"
          description="Your next confirmed or pending salon visits."
          action={
            <Link to="/booking" className="account-text-link">
              New booking <ChevronRight size={16} />
            </Link>
          }
        >
          {loading ? (
            <div className="account-list">
              <Skeleton />
              <Skeleton />
            </div>
          ) : upcomingAppointments.length ? (
            <div className="account-list">
              {upcomingAppointments.slice(0, 4).map((appointment, index) => (
                <article
                  className="account-list-item"
                  key={appointment?._id ?? appointment?.id ?? index}
                >
                  <span className="account-list-icon">
                    <CalendarDays size={19} />
                  </span>
                  <div className="account-list-copy">
                    <strong>
                      {appointment?.service?.name ??
                        appointment?.serviceName ??
                        "Salon appointment"}
                    </strong>
                    <span>
                      {formatDate(appointmentDate(appointment))}
                      {appointment?.time ? ` at ${appointment.time}` : ""}
                    </span>
                  </div>
                  <span className="account-status">
                    {appointment?.status ?? "pending"}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No upcoming appointments"
              description="Choose a service and stylist when you are ready."
              action={
                <Link to="/booking" className="app-button app-button-primary">
                  Book now
                </Link>
              }
            />
          )}
        </AccountSection>

        <AccountSection
          title="Account shortcuts"
          description="Quick access to your most-used customer features."
        >
          <nav className="account-shortcuts" aria-label="Account shortcuts">
            <Link to="/account/manage">
              <MapPin size={20} />
              <span>
                <strong>Manage account</strong>
                <small>Contact details and home address</small>
              </span>
              <ChevronRight size={18} />
            </Link>
            <Link to="/orders">
              <PackageCheck size={20} />
              <span>
                <strong>Order history</strong>
                <small>Track purchases and status</small>
              </span>
              <ChevronRight size={18} />
            </Link>
            <Link to="/services">
              <Scissors size={20} />
              <span>
                <strong>Browse services</strong>
                <small>Explore treatments and prices</small>
              </span>
              <ChevronRight size={18} />
            </Link>
            <Link to="/stylists">
              <UserRound size={20} />
              <span>
                <strong>Meet the stylists</strong>
                <small>Find the right specialist</small>
              </span>
              <ChevronRight size={18} />
            </Link>
            <Link to="/shop">
              <Gift size={20} />
              <span>
                <strong>Haircare shop</strong>
                <small>Products selected by professionals</small>
              </span>
              <ChevronRight size={18} />
            </Link>
          </nav>
        </AccountSection>
      </div>

      <AccountSection
        title="Recent orders"
        description="A snapshot of your latest SalonAI purchases."
        action={
          <Link to="/orders" className="account-text-link">
            View all orders <ChevronRight size={16} />
          </Link>
        }
      >
        {loading ? (
          <div className="account-list">
            <Skeleton />
          </div>
        ) : orders.length ? (
          <div className="account-order-grid">
            {orders.slice(0, 3).map((order, index) => (
              <article
                className="account-order-card"
                key={order?._id ?? order?.id ?? index}
              >
                <div>
                  <span className="account-list-icon">
                    <PackageCheck size={19} />
                  </span>
                  <span className="account-status">
                    {order?.status ?? "processing"}
                  </span>
                </div>
                <strong>
                  Order #{String(order?.orderNumber ?? order?._id ?? index + 1).slice(-8)}
                </strong>
                <p>{formatDate(order?.createdAt)}</p>
                <b>
                  {formatMoney(
                    order?.total ??
                      order?.totalAmount ??
                      order?.pricing?.total
                  )}
                </b>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No orders yet"
            description="Your product purchases will appear here."
            action={
              <Link to="/shop" className="app-button app-button-secondary">
                Visit the shop
              </Link>
            }
          />
        )}
      </AccountSection>

      <footer className="account-note">
        <Clock3 size={18} />
        Appointment and order information is loaded from your authenticated
        SalonAI account.
      </footer>
    </main>
  );
}
