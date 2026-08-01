import { PackageCheck, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import CommerceTrustBar from "../components/commerce/CommerceTrustBar.jsx";
import commerceService from "../Services/commerceService.js";
import { formatCurrency } from "../utils/currency.js";

function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await commerceService.listMyOrders({ limit: 100 });
      setOrders(result.items || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Orders could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function cancelOrder(orderId) {
    try {
      await commerceService.cancelOrder(orderId);
      await loadOrders();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "The order could not be cancelled.");
    }
  }

  return (
    <main className="page commerce-page">
      <div className="commerce-page-heading">
        <div>
          <span className="commerce-eyebrow">Your purchases</span>
          <h1>Order history</h1>
          <p>Track collection, delivery and payment status.</p>
        </div>
        <PackageCheck size={44} />
      </div>

      <CommerceTrustBar />

      {error && <div className="error-message">{error}</div>}
      {loading && <p>Loading orders…</p>}
      {!loading && orders.length === 0 && (
        <div className="empty-state">
          <ShoppingBag size={46} />
          <h2>No orders yet</h2>
          <p>Your completed checkouts will appear here.</p>
          <Link className="commerce-link-button" to="/shop">Visit the shop</Link>
        </div>
      )}

      <section className="commerce-order-list">
        {orders.map((order) => (
          <article className="commerce-order-card" key={order._id}>
            <header>
              <div>
                <span className="commerce-order-number">{order.orderNumber}</span>
                <p>{formatDate(order.createdAt)}</p>
              </div>
              <span className={`commerce-order-status status-${order.status}`}>
                {order.status.replaceAll("_", " ")}
              </span>
            </header>
            <div className="commerce-order-items">
              {order.items.map((item) => (
                <div key={`${order._id}-${item.product}`}>
                  <span>{item.quantity} × {item.name}</span>
                  <strong>{formatCurrency(item.lineTotal)}</strong>
                </div>
              ))}
            </div>
            <footer>
              <span>{order.fulfilmentType === "delivery" ? "Delivery" : "Salon collection"}</span>
              <strong>{formatCurrency(order.total, order.currency)}</strong>
              {order.status === "pending_payment" && (
                <button type="button" className="danger-button" onClick={() => cancelOrder(order._id)}>
                  Cancel order
                </button>
              )}
            </footer>
          </article>
        ))}
      </section>
    </main>
  );
}
