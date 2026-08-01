import { CreditCard, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import CheckoutProgress from "../components/commerce/CheckoutProgress.jsx";
import CommerceTrustBar from "../components/commerce/CommerceTrustBar.jsx";
import useAuth from "../hooks/useAuth.js";
import useCart from "../hooks/useCart.js";
import commerceService from "../Services/commerceService.js";
import { formatCurrency } from "../utils/currency.js";

const emptyAddress = {
  line1: "",
  line2: "",
  city: "",
  postcode: "",
  country: "United Kingdom",
};

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, subtotal, clearCart } = useCart();
  const [fulfilmentType, setFulfilmentType] = useState("collection");
  const [commerceConfig, setCommerceConfig] = useState({ deliveryFee: 4.95, currency: "GBP" });
  const [contact, setContact] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
  });
  const [deliveryAddress, setDeliveryAddress] = useState(emptyAddress);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [demoCheckout, setDemoCheckout] = useState(null);

  useEffect(() => {
    commerceService.getConfig().then(setCommerceConfig).catch(() => {});
  }, []);

  if (items.length === 0 && !demoCheckout) {
    return <Navigate to="/cart" replace />;
  }

  const deliveryFee = fulfilmentType === "delivery"
    ? Number(commerceConfig.deliveryFee || 0)
    : 0;

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      const result = await commerceService.createCheckout({
        items: items.map((item) => ({ product: item.productId, quantity: item.quantity })),
        fulfilmentType,
        contact,
        deliveryAddress: fulfilmentType === "delivery" ? deliveryAddress : undefined,
        notes,
      });

      if (result.payment?.checkoutUrl) {
        clearCart();
        window.location.assign(result.payment.checkoutUrl);
        return;
      }

      if (result.requiresDemoConfirmation) {
        setDemoCheckout(result);
      } else {
        clearCart();
        navigate(`/checkout/success?order=${result.order._id}`);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Checkout could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDemoPayment() {
    try {
      setSubmitting(true);
      setError("");
      await commerceService.confirmDemoCheckout(demoCheckout.order._id);
      clearCart();
      navigate(`/checkout/success?order=${demoCheckout.order._id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Demo payment could not be confirmed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (demoCheckout) {
    return (
      <main className="page narrow-page">
        <section className="commerce-demo-payment">
          <CreditCard size={52} />
          <span className="commerce-eyebrow">Local development mode</span>
          <h1>Confirm demo payment</h1>
          <p>
            Stripe is not enabled, so no card will be charged. Confirming simulates a
            successful payment and commits the stock movement.
          </p>
          {error && <div className="error-message">{error}</div>}
          <button type="button" disabled={submitting} onClick={confirmDemoPayment}>
            {submitting ? "Confirming…" : `Confirm ${formatCurrency(demoCheckout.order.total)}`}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page commerce-page">
      <div className="commerce-page-heading">
        <div>
          <span className="commerce-eyebrow">Secure order</span>
          <h1>Checkout</h1>
          <p>Totals are verified by the SalonAI server before payment.</p>
        </div>
        <LockKeyhole size={42} />
      </div>

      <CheckoutProgress current="checkout" />
      <CommerceTrustBar />

      <form className="commerce-two-column" onSubmit={handleSubmit}>
        <div className="commerce-checkout-form">
          {error && <div className="error-message">{error}</div>}
          <section className="commerce-form-section">
            <h2>Contact details</h2>
            <label>Name<input required value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} /></label>
            <label>Email<input required type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} /></label>
            <label>Phone<input value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} /></label>
          </section>

          <section className="commerce-form-section">
            <h2>Fulfilment</h2>
            <div className="commerce-choice-grid">
              <label><input type="radio" name="fulfilment" checked={fulfilmentType === "collection"} onChange={() => setFulfilmentType("collection")} /> Salon collection · Free</label>
              <label><input type="radio" name="fulfilment" checked={fulfilmentType === "delivery"} onChange={() => setFulfilmentType("delivery")} /> UK delivery · {formatCurrency(commerceConfig.deliveryFee, commerceConfig.currency)}</label>
            </div>
          </section>

          {fulfilmentType === "delivery" && (
            <section className="commerce-form-section commerce-address-grid">
              <h2>Delivery address</h2>
              <label>Address line 1<input required value={deliveryAddress.line1} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, line1: event.target.value })} /></label>
              <label>Address line 2<input value={deliveryAddress.line2} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, line2: event.target.value })} /></label>
              <label>Town or city<input required value={deliveryAddress.city} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, city: event.target.value })} /></label>
              <label>Postcode<input required value={deliveryAddress.postcode} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, postcode: event.target.value })} /></label>
            </section>
          )}

          <section className="commerce-form-section">
            <label>Order notes<textarea rows="3" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Collection or delivery instructions" /></label>
          </section>
        </div>

        <aside className="commerce-summary-card">
          <h2>Order summary</h2>
          {items.map((item) => (
            <div key={item.productId}><span>{item.quantity} × {item.name}</span><strong>{formatCurrency(item.price * item.quantity)}</strong></div>
          ))}
          <div><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
          <div><span>Delivery</span><strong>{deliveryFee ? formatCurrency(deliveryFee) : "Free"}</strong></div>
          <div className="commerce-summary-total"><span>Total</span><strong>{formatCurrency(subtotal + deliveryFee, commerceConfig.currency)}</strong></div>
          <button type="submit" disabled={submitting}>
            {submitting ? "Creating checkout…" : "Proceed to secure payment"}
          </button>
        </aside>
      </form>
    </main>
  );
}
