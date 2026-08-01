import { ClipboardList } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import commerceService from "../Services/commerceService.js";
import { formatCurrency } from "../utils/currency.js";

const statuses = ["paid", "processing", "ready", "completed", "cancelled", "refunded"];

export default function OrderManagement() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await commerceService.listOrders({ status: status || undefined, limit: 100 });
      setOrders(result.items || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Orders could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(orderId, nextStatus) {
    try {
      await commerceService.updateOrderStatus(orderId, nextStatus);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Order status could not be updated.");
    }
  }

  return (
    <main className="page commerce-page">
      <div className="commerce-page-heading">
        <div><span className="commerce-eyebrow">E-commerce operations</span><h1>Product orders</h1><p>Process paid orders through collection, delivery and completion.</p></div>
        <ClipboardList size={46} />
      </div>
      <div className="commerce-toolbar">
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="pending_payment">Pending payment</option>
          {statuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
        </select>
      </div>
      {error && <div className="error-message">{error}</div>}
      {loading && <p>Loading orders…</p>}
      <section className="commerce-admin-table-wrap">
        <table className="commerce-admin-table">
          <thead><tr><th>Order</th><th>Customer</th><th>Fulfilment</th><th>Total</th><th>Status</th><th>Update</th></tr></thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order._id}>
                <td><strong>{order.orderNumber}</strong><span>{order.items.length} item(s)</span></td>
                <td><strong>{order.contact?.name}</strong><span>{order.contact?.email}</span></td>
                <td>{order.fulfilmentType}</td>
                <td>{formatCurrency(order.total)}</td>
                <td><span className={`commerce-order-status status-${order.status}`}>{order.status.replaceAll("_", " ")}</span></td>
                <td>
                  <select value={order.status} onChange={(event) => changeStatus(order._id, event.target.value)}>
                    {order.status === "pending_payment" && <option value="pending_payment">pending payment</option>}
                    {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
