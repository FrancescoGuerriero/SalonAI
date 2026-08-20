import { CheckCircle2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import useCart from "../hooks/useCart.js";
import commerceService from "../Services/commerceService.js";
import { formatCurrency } from "../utils/currency.js";

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const orderId = params.get("order");
  const sessionId = params.get("session_id");
  const { clearCart } = useCart();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setError("The order reference is missing.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setOrder(await commerceService.getOrder(orderId));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "The order could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (sessionId) {
      clearCart();
    }
  }, [sessionId, clearCart]);

  return (
    <main className="page narrow-page">
      <section className="commerce-success-card">
        <CheckCircle2 size={60} />
        <span className="commerce-eyebrow">Order received</span>
        <h1>Thank you for your order</h1>
        {loading && <p>Checking payment status…</p>}
        {error && <div className="error-message">{error}</div>}
        {order && (
          <>
            <p>
              Order <strong>{order.orderNumber}</strong> is currently
              <strong> {order.status.replaceAll("_", " ")}</strong>.
            </p>
            <div className="commerce-success-summary">
              <span>Total</span>
              <strong>{formatCurrency(order.total, order.currency)}</strong>
            </div>
            {Number(order.appointmentSubtotal || 0) > 0 ? (
              <div className="commerce-success-summary">
                <span>Appointment payments</span>
                <strong>{formatCurrency(order.appointmentSubtotal, order.currency)}</strong>
              </div>
            ) : null}
            {order.status === "pending_payment" && (
              <p>
                Stripe confirmation can take a few seconds. Refresh the status after
                the payment webhook is processed.
              </p>
            )}
          </>
        )}
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={loadOrder}>
            <RefreshCw size={16} /> Refresh status
          </button>
          <Link className="commerce-link-button" to="/orders">View order history</Link>
          <Link className="commerce-text-link" to="/account">Back to account</Link>
        </div>
      </section>
    </main>
  );
}
