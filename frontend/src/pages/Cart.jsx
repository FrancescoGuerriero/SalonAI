import { Link, useSearchParams } from "react-router-dom";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

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
        <p>Add professional haircare products before continuing to checkout.</p>
        <Link className="commerce-link-button" to="/shop">Browse products</Link>
      </main>
    );
  }

  return (
    <main className="page commerce-page">
      <div className="commerce-page-heading">
        <div>
          <span className="commerce-eyebrow">Your selection</span>
          <h1>Shopping cart</h1>
        </div>
      </div>

      <CheckoutProgress current="cart" />
      <CommerceTrustBar />

      {searchParams.get("checkout") === "cancelled" && (
        <div className="error-message">Checkout was cancelled. Your cart is still available.</div>
      )}

      <div className="commerce-two-column">
        <section className="commerce-cart-list">
          {items.map((item) => (
            <article className="commerce-cart-item" key={item.productId}>
              {item.image ? (
                <img src={item.image} alt="" />
              ) : (
                <div className="commerce-cart-placeholder"><ShoppingCart /></div>
              )}
              <div className="commerce-cart-details">
                <h2>{item.name}</h2>
                <p>{item.sku}</p>
                <strong>{formatCurrency(item.price)}</strong>
              </div>
              <div className="commerce-quantity" aria-label={`Quantity for ${item.name}`}>
                <button type="button" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                  <Minus size={16} />
                </button>
                <span>{item.quantity}</span>
                <button
                  type="button"
                  disabled={item.quantity >= item.stockQuantity}
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                >
                  <Plus size={16} />
                </button>
              </div>
              <strong className="commerce-line-total">
                {formatCurrency(item.price * item.quantity)}
              </strong>
              <button
                type="button"
                className="commerce-icon-danger"
                onClick={() => removeItem(item.productId)}
                aria-label={`Remove ${item.name}`}
              >
                <Trash2 size={18} />
              </button>
            </article>
          ))}
        </section>

        <aside className="commerce-summary-card">
          <h2>Order summary</h2>
          <div><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
          <div><span>Collection</span><strong>Free</strong></div>
          <div className="commerce-summary-total"><span>Total</span><strong>{formatCurrency(subtotal)}</strong></div>
          <p>Delivery charges, when selected, are calculated securely at checkout.</p>
          <Link className="commerce-link-button" to={isAuthenticated ? "/checkout" : "/login"}>
            {isAuthenticated ? "Continue to checkout" : "Sign in to checkout"}
          </Link>
          <Link className="commerce-text-link" to="/shop">Continue shopping</Link>
        </aside>
      </div>
    </main>
  );
}
