import { useCallback, useEffect, useState } from "react";
import { Boxes, CircleDollarSign, PackagePlus, ShoppingCart, TriangleAlert } from "lucide-react";

import {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryForecast,
  updateInventoryItem,
} from "../Services/inventoryService.js";
import { EmptyState, ErrorBanner, FeatureHeader, LoadingPanel, Pill, SummaryCard } from "../shared/FutureUi.jsx";
import { formatCurrency, formatDate, getErrorMessage } from "../shared/formatters.js";

const initialForm = {
  sku: "",
  name: "",
  category: "General",
  quantityOnHand: 0,
  reorderPoint: 5,
  reorderQuantity: 10,
  averageDailyUsage: 0,
  leadTimeDays: 7,
  unitCost: 0,
  retailPrice: 0,
};

export default function InventoryForecastingPage() {
  const [analytics, setAnalytics] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (initial = false) => {
    initial ? setLoading(true) : setRefreshing(true);
    setError("");
    try {
      const response = await getInventoryForecast({ active: true });
      setAnalytics(response?.analytics || response);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to load inventory forecasting."));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  async function handleCreate(event) {
    event.preventDefault(); setSaving(true); setError("");
    try { await createInventoryItem(form); setForm(initialForm); await load(); }
    catch (requestError) { setError(getErrorMessage(requestError, "Unable to create inventory item.")); }
    finally { setSaving(false); }
  }

  async function changeQuantity(item, amount) {
    try {
      await updateInventoryItem(item._id, { quantityOnHand: Math.max(0, Number(item.quantityOnHand || 0) + amount) });
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError, "Unable to update stock.")); }
  }

  async function remove(item) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    try { await deleteInventoryItem(item._id); await load(); }
    catch (requestError) { setError(getErrorMessage(requestError, "Unable to delete stock item.")); }
  }

  const summary = analytics?.summary || {};
  const items = analytics?.items || [];

  return <main className="space-y-7 p-6">
    <FeatureHeader icon={Boxes} title="Inventory Forecasting" description="Track salon stock, estimate days of cover and identify urgent supplier reorders." onRefresh={() => load()} refreshing={refreshing} />
    <ErrorBanner message={error} />
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard title="Active items" value={summary.activeItems || 0} description="Items currently monitored" icon={Boxes} loading={loading} /><SummaryCard title="Reorder now" value={summary.reorderNow || 0} description="Items at reorder threshold" icon={ShoppingCart} loading={loading} /><SummaryCard title="Out of stock" value={summary.outOfStock || 0} description="Items with no remaining stock" icon={TriangleAlert} loading={loading} /><SummaryCard title="Inventory value" value={formatCurrency(summary.inventoryValue)} description="Stock value at unit cost" icon={CircleDollarSign} loading={loading} /></section>
    <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2"><PackagePlus className="text-indigo-600" /><h2 className="text-xl font-bold">Add inventory item</h2></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <input required placeholder="SKU" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} className="rounded-lg border p-2.5 text-sm" />
        <input required placeholder="Item name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="rounded-lg border p-2.5 text-sm" />
        <input placeholder="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="rounded-lg border p-2.5 text-sm" />
        <input type="number" min="0" step="0.01" placeholder="On hand" value={form.quantityOnHand} onChange={(event) => setForm({ ...form, quantityOnHand: Number(event.target.value) })} className="rounded-lg border p-2.5 text-sm" />
        <input type="number" min="0" step="0.01" placeholder="Reorder point" value={form.reorderPoint} onChange={(event) => setForm({ ...form, reorderPoint: Number(event.target.value) })} className="rounded-lg border p-2.5 text-sm" />
        <input type="number" min="0" step="0.01" placeholder="Reorder quantity" value={form.reorderQuantity} onChange={(event) => setForm({ ...form, reorderQuantity: Number(event.target.value) })} className="rounded-lg border p-2.5 text-sm" />
        <input type="number" min="0" step="0.01" placeholder="Daily usage" value={form.averageDailyUsage} onChange={(event) => setForm({ ...form, averageDailyUsage: Number(event.target.value) })} className="rounded-lg border p-2.5 text-sm" />
        <input type="number" min="0" placeholder="Lead time days" value={form.leadTimeDays} onChange={(event) => setForm({ ...form, leadTimeDays: Number(event.target.value) })} className="rounded-lg border p-2.5 text-sm" />
        <input type="number" min="0" step="0.01" placeholder="Unit cost" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: Number(event.target.value) })} className="rounded-lg border p-2.5 text-sm" />
        <input type="number" min="0" step="0.01" placeholder="Retail price" value={form.retailPrice} onChange={(event) => setForm({ ...form, retailPrice: Number(event.target.value) })} className="rounded-lg border p-2.5 text-sm" />
      </div>
      <button disabled={saving} className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Adding" : "Add item"}</button>
    </form>
    {loading ? <LoadingPanel /> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{items.length === 0 ? <EmptyState icon={Boxes} title="No inventory items" description="Add the first product or consumable above." /> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{["Item", "On hand", "Reorder point", "Days cover", "Stock-out estimate", "Value", "Urgency", "Actions"].map((heading) => <th key={heading} className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-500">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item._id}><td className="px-5 py-4"><p className="font-semibold">{item.name}</p><p className="text-xs text-slate-400">{item.sku} · {item.category}</p></td><td className="px-5 py-4">{item.quantityOnHand}</td><td className="px-5 py-4">{item.reorderPoint}</td><td className="px-5 py-4">{item.daysOfCover ?? "No usage"}</td><td className="px-5 py-4">{formatDate(item.projectedStockOutAt)}</td><td className="px-5 py-4">{formatCurrency(item.inventoryValue)}</td><td className="px-5 py-4"><Pill tone={item.urgency === "out_of_stock" ? "red" : item.urgency === "reorder_now" ? "amber" : item.urgency === "watch" ? "blue" : "green"}>{item.urgency.replaceAll("_", " ")}</Pill></td><td className="px-5 py-4"><div className="flex gap-2"><button type="button" onClick={() => changeQuantity(item, Number(item.reorderQuantity || 1))} className="rounded-lg border px-2 py-1 text-xs">Restock</button><button type="button" onClick={() => changeQuantity(item, -1)} className="rounded-lg border px-2 py-1 text-xs">Use 1</button><button type="button" onClick={() => remove(item)} className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700">Delete</button></div></td></tr>)}</tbody></table></div>}</section>}
  </main>;
}
