import { CreditCard, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import CheckoutProgress from "../components/commerce/CheckoutProgress.jsx";
import CommerceTrustBar from "../components/commerce/CommerceTrustBar.jsx";
import useAuth from "../hooks/useAuth.js";
import useCart from "../hooks/useCart.js";
import commerceService from "../Services/commerceService.js";
import { formatCurrency } from "../utils/currency.js";

const PENDING_ORDER_KEY = "salonai_pending_checkout_order";

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
  const {
    items,
    productItems,
    appointmentItems,
    subtotal,
    clearCart,
  } = useCart();
  const [fulfilmentType, setFulfilmentType] = useState("collection");
  const [commerceConfig, setCommerceConfig] = useState({ deliveryFee: 4.95, currency: "GBP" });
  const [contact, setContact] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [deliveryAddress, setDeliveryAddress] = useState({
    ...emptyAddress,
    ...(user?.homeAddress || {}),
  });
  const [notes, setNotes] = useState("");
  const [offerCode, setOfferCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [demoCheckout, setDemoCheckout] = useState(null);

  const hasProducts = productItems.length > 0;

  useEffect(() => {
    commerceService.getConfig().then(setCommerceConfig).catch(() => {});
  }, []);

  useEffect(() => {
    if (!hasProducts && fulfilmentType !== "collection") {
      setFulfilmentType("collection");
    }
  }, [hasProducts, fulfilmentType]);

  if (items.length === 0 && !demoCheckout) {
    return <Navigate to="/cart" replace />;
  }

  const deliveryFee = hasProducts && fulfilmentType === "delivery"
    ? Number(commerceConfig.deliveryFee || 0)
    : 0;

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      const result = await commerceService.createCheckout({
        items: items.map((item) =>
          item.type === "appointment"
            ? {
                type: "appointment",
                appointment: item.appointmentId,
                purpose: item.paymentPurpose,
              }
            : {
                type: "product",
                product: item.productId,
                quantity: item.quantity,
              }
        ),
        fulfilmentType: hasProducts ? fulfilmentType : "collection",
        contact,
        deliveryAddress:
          hasProducts && fulfilmentType === "delivery"
            ? deliveryAddress
            : undefined,
        notes,
        offerCode: hasProducts && offerCode.trim() ? offerCode.trim() : undefined,
      });

      if (result.payment?.checkoutUrl) {
        sessionStorage.setItem(PENDING_ORDER_KEY, String(result.order._id));
        window.location.assign(result.payment.checkoutUrl);
        return;
      }

      if (result.requiresDemoConfirmation) {
        setDemoCheckout(result);
      } else {
        sessionStorage.removeItem(PENDING_ORDER_KEY);
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
      sessionStorage.removeItem(PENDING_ORDER_KEY);
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
            successful payment and commits product stock plus appointment balances.
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
          <p>Appointment balances, product prices, stock and totals are verified by SalonAI before Stripe payment.</p>
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

          {hasProducts ? (
            <section className="commerce-form-section">
              <h2>Product fulfilment</h2>
              <div className="commerce-choice-grid">
                <label><input type="radio" name="fulfilment" checked={fulfilmentType === "collection"} onChange={() => setFulfilmentType("collection")} /> Salon collection · Free</label>
                <label><input type="radio" name="fulfilment" checked={fulfilmentType === "delivery"} onChange={() => setFulfilmentType("delivery")} /> UK delivery · {formatCurrency(commerceConfig.deliveryFee, commerceConfig.currency)}</label>
              </div>
            </section>
          ) : (
            <section className="commerce-form-section">
              <h2>Appointment payment</h2>
              <p>No physical products are in this basket, so delivery details are not required.</p>
            </section>
          )}

          {hasProducts && fulfilmentType === "delivery" && (
            <section className="commerce-form-section commerce-address-grid">
              <h2>Delivery address</h2>
              <label>Address line 1<input required value={deliveryAddress.line1} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, line1: event.target.value })} /></label>
              <label>Address line 2<input value={deliveryAddress.line2} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, line2: event.target.value })} /></label>
              <label>Town or city<input required value={deliveryAddress.city} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, city: event.target.value })} /></label>
              <label>Postcode<input required value={deliveryAddress.postcode} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, postcode: event.target.value })} /></label>
            </section>
          )}

          {hasProducts ? (
            <section className="commerce-form-section">
              <label>Saved offer code<input value={offerCode} onChange={(event) => setOfferCode(event.target.value.toUpperCase())} placeholder="Optional promotion code" /></label>
              <small>Offers apply to retail products only. The server verifies eligibility and recalculates the final payment total.</small>
            </section>
          ) : null}

          <section className="commerce-form-section">
            <label>Order notes<textarea rows="3" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Collection, delivery or appointment-payment notes" /></label>
          </section>
        </div>

        <aside className="commerce-summary-card">
          <h2>Order summary</h2>
          {appointmentItems.length ? <span className="commerce-eyebrow">Appointments</span> : null}
          {appointmentItems.map((item) => (
            <div key={item.cartKey}><span>{item.name}</span><strong>{formatCurrency(item.price)}</strong></div>
          ))}
          {productItems.length ? <span className="commerce-eyebrow">Products</span> : null}
          {productItems.map((item) => (
            <div key={item.cartKey}><span>{item.quantity} × {item.name}</span><strong>{formatCurrency(item.price * item.quantity)}</strong></div>
          ))}
          <div><span>Basket subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
          <div><span>Delivery</span><strong>{deliveryFee ? formatCurrency(deliveryFee) : "Free"}</strong></div>
          {hasProducts && offerCode ? <div><span>Promotion</span><strong>Verified at payment</strong></div> : null}
          <div className="commerce-summary-total"><span>Estimated total</span><strong>{formatCurrency(subtotal + deliveryFee, commerceConfig.currency)}</strong></div>
          <button type="submit" disabled={submitting}>
            {submitting ? "Creating checkout…" : "Proceed to secure payment"}
          </button>
        </aside>
      </form>
    </main>
  );
}
