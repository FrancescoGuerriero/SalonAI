import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import CheckoutProgress from "../components/commerce/CheckoutProgress.jsx";
import CommerceTrustBar from "../components/commerce/CommerceTrustBar.jsx";
import useAuth from "../hooks/useAuth.js";
import useCart from "../hooks/useCart.js";
import { formatCurrency } from "../utils/currency.js";

export default function Cart() {
  const { isAuthenticated } = useAuth();
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  const [searchParams] = useSearchParams();

  if (items.length === 0) {
    return (
      <main className="page page-center">
        <ShoppingCart size={58} aria-hidden="true" />
        <h1>Your cart is empty</h1>
        <p>Add an appointment payment or professional haircare products before checkout.</p>
        <div className="button-row">
          <Link className="commerce-link-button" to="/account">View appointments</Link>
          <Link className="commerce-link-button" to="/shop">Browse products</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page commerce-page">
      <div className="commerce-page-heading">
        <div>
          <span className="commerce-eyebrow">Your selection</span>
          <h1>Shopping cart</h1>
          <p>Combine salon appointment payments and retail products in one secure checkout.</p>
        </div>
      </div>

      <CheckoutProgress current="cart" />
      <CommerceTrustBar />

      {searchParams.get("checkout") === "cancelled" && (
        <div className="error-message">Checkout was cancelled. Your cart is still available.</div>
      )}

      <div className="commerce-two-column">
        <section className="commerce-cart-list">
          {items.map((item) => {
            const key = item.cartKey || item.productId || item.appointmentId;
            const isAppointment = item.type === "appointment";

            return (
              <article className="commerce-cart-item" key={key}>
                {isAppointment ? (
                  <div className="commerce-cart-placeholder"><CalendarDays /></div>
                ) : item.image ? (
                  <img src={item.image} alt="" />
                ) : (
                  <div className="commerce-cart-placeholder"><ShoppingCart /></div>
                )}

                <div className="commerce-cart-details">
                  <span className="commerce-eyebrow">
                    {isAppointment ? "Salon appointment" : "Haircare product"}
                  </span>
                  <h2>{item.name}</h2>
                  <p>{item.sku}</p>
                  <strong>{formatCurrency(item.price)}</strong>
                </div>

                {isAppointment ? (
                  <div className="commerce-quantity" aria-label={`Quantity for ${item.name}`}>
                    <span>1</span>
                  </div>
                ) : (
                  <div className="commerce-quantity" aria-label={`Quantity for ${item.name}`}>
                    <button
                      type="button"
                      onClick={() => updateQuantity(key, item.quantity - 1)}
                    >
                      <Minus size={16} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      disabled={item.quantity >= item.stockQuantity}
                      onClick={() => updateQuantity(key, item.quantity + 1)}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                )}

                <strong className="commerce-line-total">
                  {formatCurrency(item.price * item.quantity)}
                </strong>

                <button
                  type="button"
                  className="commerce-icon-danger"
                  onClick={() => removeItem(key)}
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 size={18} />
                </button>
              </article>
            );
          })}
        </section>

        <aside className="commerce-summary-card">
          <h2>Order summary</h2>
          <div><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
          <div><span>Collection</span><strong>Free</strong></div>
          <div className="commerce-summary-total"><span>Total</span><strong>{formatCurrency(subtotal)}</strong></div>
          <p>Appointment balances, current product prices and stock are verified again by SalonAI at checkout.</p>
          <Link className="commerce-link-button" to={isAuthenticated ? "/checkout" : "/login"}>
            {isAuthenticated ? "Continue to checkout" : "Sign in to checkout"}
          </Link>
          <Link className="commerce-text-link" to="/shop">Continue shopping</Link>
          <Link className="commerce-text-link" to="/account">View appointments</Link>
        </aside>
      </div>
    </main>
  );
}
