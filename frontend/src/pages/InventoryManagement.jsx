import { AlertTriangle, Boxes, PackagePlus, PoundSterling } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import commerceService from "../Services/commerceService.js";
import { formatCurrency } from "../utils/currency.js";

const emptyProduct = {
  name: "",
  sku: "",
  brand: "",
  category: "Haircare",
  size: "",
  description: "",
  price: "",
  costPrice: "",
  stockQuantity: "0",
  reorderLevel: "5",
  image: "",
  featured: false,
  active: true,
};

export default function InventoryManagement() {
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [productResult, summaryResult] = await Promise.all([
        commerceService.listInventoryProducts({ limit: 100, sort: "name" }),
        commerceService.inventorySummary(),
      ]);
      setProducts(productResult.items || []);
      setSummary(summaryResult);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Inventory could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lowStockIds = useMemo(
    () => new Set((summary?.lowStockProducts || []).map((product) => product._id)),
    [summary]
  );

  function editProduct(product) {
    setEditingId(product._id);
    setForm({
      name: product.name || "",
      sku: product.sku || "",
      brand: product.brand || "",
      category: product.category || "",
      size: product.size || "",
      description: product.description || "",
      price: String(product.price ?? ""),
      costPrice: String(product.costPrice ?? ""),
      stockQuantity: String(product.stockQuantity ?? 0),
      reorderLevel: String(product.reorderLevel ?? 5),
      image: product.images?.[0] || "",
      featured: Boolean(product.featured),
      active: product.active !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId("");
    setForm(emptyProduct);
  }

  async function saveProduct(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      setMessage("");
      const payload = {
        ...form,
        price: Number(form.price),
        costPrice: Number(form.costPrice || 0),
        stockQuantity: Number(form.stockQuantity || 0),
        reorderLevel: Number(form.reorderLevel || 0),
        images: form.image ? [form.image] : [],
      };
      if (editingId) {
        delete payload.stockQuantity;
        await commerceService.updateProduct(editingId, payload);
        setMessage("Product updated.");
      } else {
        await commerceService.createProduct(payload);
        setMessage("Product created.");
      }
      resetForm();
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "The product could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function adjust(product, direction) {
    const raw = window.prompt(
      direction > 0 ? "How many units are being received?" : "How many units should be removed?",
      "1"
    );
    if (raw === null) return;
    const quantity = Number.parseInt(raw, 10);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Enter a positive whole number.");
      return;
    }
    const reason = window.prompt("Reason for this stock adjustment:", direction > 0 ? "Stock delivery" : "Damaged or corrected stock");
    if (!reason) return;

    try {
      await commerceService.adjustStock(product._id, {
        delta: direction * quantity,
        reason,
      });
      setMessage("Stock updated and adjustment recorded.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Stock could not be adjusted.");
    }
  }

  return (
    <main className="page commerce-page">
      <div className="commerce-page-heading">
        <div>
          <span className="commerce-eyebrow">Phase 2 management</span>
          <h1>Product inventory</h1>
          <p>Maintain catalogue details, stock thresholds and auditable adjustments.</p>
        </div>
        <Boxes size={46} />
      </div>

      {summary && (
        <section className="commerce-stat-grid">
          <article><Boxes /><span>Active products</span><strong>{summary.productCount}</strong></article>
          <article><PackagePlus /><span>Units in stock</span><strong>{summary.unitsInStock}</strong></article>
          <article><AlertTriangle /><span>Low stock</span><strong>{summary.lowStockCount}</strong></article>
          <article><PoundSterling /><span>Retail stock value</span><strong>{formatCurrency(summary.retailValue)}</strong></article>
        </section>
      )}

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      <form className="commerce-admin-form" onSubmit={saveProduct}>
        <div className="commerce-form-title">
          <h2>{editingId ? "Edit product" : "Add product"}</h2>
          {editingId && <button type="button" className="secondary-button" onClick={resetForm}>Cancel edit</button>}
        </div>
        <div className="commerce-admin-grid">
          <label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>SKU<input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /></label>
          <label>Brand<input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} /></label>
          <label>Category<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
          <label>Size<input value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} /></label>
          <label>Retail price (£)<input required type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
          <label>Cost price (£)<input type="number" min="0" step="0.01" value={form.costPrice} onChange={(event) => setForm({ ...form, costPrice: event.target.value })} /></label>
          <label>{editingId ? "Current stock (use adjustments below)" : "Opening stock"}<input disabled={Boolean(editingId)} type="number" min="0" step="1" value={form.stockQuantity} onChange={(event) => setForm({ ...form, stockQuantity: event.target.value })} /></label>
          <label>Reorder level<input type="number" min="0" step="1" value={form.reorderLevel} onChange={(event) => setForm({ ...form, reorderLevel: event.target.value })} /></label>
          <label className="commerce-span-two">Image URL<input value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} /></label>
          <label className="commerce-span-two">Description<textarea rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <label className="commerce-checkbox"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Featured product</label>
          <label className="commerce-checkbox"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label>
        </div>
        <button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Create product"}</button>
      </form>

      <section className="commerce-admin-table-wrap">
        <table className="commerce-admin-table">
          <thead><tr><th>Product</th><th>SKU</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {!loading && products.map((product) => (
              <tr key={product._id}>
                <td><strong>{product.name}</strong><span>{product.category}</span></td>
                <td>{product.sku}</td>
                <td>{formatCurrency(product.price)}</td>
                <td className={lowStockIds.has(product._id) ? "commerce-low-stock" : ""}>{product.stockQuantity}</td>
                <td>{product.active ? "Active" : "Inactive"}</td>
                <td className="commerce-table-actions">
                  <button type="button" className="secondary-button" onClick={() => editProduct(product)}>Edit</button>
                  <button type="button" onClick={() => adjust(product, 1)}>Receive</button>
                  <button type="button" className="danger-button" onClick={() => adjust(product, -1)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
