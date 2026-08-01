import { useCallback, useEffect, useState } from "react";
import { Frown, MessageSquareText, Smile, Star, ThumbsUp } from "lucide-react";

import { createFeedback, getFeedbackAnalytics, resolveFeedback } from "../services/feedbackAnalyticsService.js";
import { EmptyState, ErrorBanner, FeatureHeader, LoadingPanel, Pill, SummaryCard } from "../shared/FutureUi.jsx";
import { formatDateTime, getErrorMessage } from "../shared/formatters.js";

export default function FeedbackAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [form, setForm] = useState({ rating: 5, comment: "", customerId: "", serviceId: "", stylistId: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (initial = false) => { initial ? setLoading(true) : setRefreshing(true); setError(""); try { const response = await getFeedbackAnalytics({ limit: 500 }); setAnalytics(response?.analytics || response); } catch (requestError) { setError(getErrorMessage(requestError, "Unable to load feedback analytics.")); } finally { setLoading(false); setRefreshing(false); } }, []);
  useEffect(() => { load(true); }, [load]);

  async function handleCreate(event) { event.preventDefault(); setSaving(true); try { await createFeedback(form); setForm({ rating: 5, comment: "", customerId: "", serviceId: "", stylistId: "" }); await load(); } catch (requestError) { setError(getErrorMessage(requestError, "Unable to save feedback.")); } finally { setSaving(false); } }
  async function markResolved(item) { try { await resolveFeedback(item._id, !item.resolved); await load(); } catch (requestError) { setError(getErrorMessage(requestError, "Unable to update feedback.")); } }

  const summary = analytics?.summary || {};
  const items = analytics?.items || [];

  return <main className="space-y-7 p-6">
    <FeatureHeader icon={MessageSquareText} title="Customer Feedback Analytics" description="Capture customer feedback and monitor ratings, explainable sentiment and unresolved service issues." onRefresh={() => load()} refreshing={refreshing} />
    <ErrorBanner message={error} />
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><SummaryCard title="Feedback" value={summary.feedbackCount || 0} description="Records in the current view" icon={MessageSquareText} loading={loading} /><SummaryCard title="Average rating" value={(summary.averageRating || 0).toFixed(2)} description="Mean customer rating" icon={Star} loading={loading} /><SummaryCard title="Positive" value={summary.positive || 0} description="Positive sentiment records" icon={Smile} loading={loading} /><SummaryCard title="Negative" value={summary.negative || 0} description="Negative sentiment records" icon={Frown} loading={loading} /><SummaryCard title="Unresolved" value={summary.unresolvedNegative || 0} description="Negative feedback needing action" icon={ThumbsUp} loading={loading} /></section>
    <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Add feedback</h2><div className="mt-4 grid gap-3 md:grid-cols-4"><select value={form.rating} onChange={(event) => setForm({ ...form, rating: Number(event.target.value) })} className="rounded-lg border p-2.5"><option value={5}>5 stars</option><option value={4}>4 stars</option><option value={3}>3 stars</option><option value={2}>2 stars</option><option value={1}>1 star</option></select><input value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })} placeholder="Customer ID (optional)" className="rounded-lg border p-2.5 text-sm" /><input value={form.serviceId} onChange={(event) => setForm({ ...form, serviceId: event.target.value })} placeholder="Service ID (optional)" className="rounded-lg border p-2.5 text-sm" /><input value={form.stylistId} onChange={(event) => setForm({ ...form, stylistId: event.target.value })} placeholder="Stylist ID (optional)" className="rounded-lg border p-2.5 text-sm" /></div><textarea required rows={4} value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} placeholder="Customer comment" className="mt-3 w-full rounded-lg border p-3 text-sm" /><button disabled={saving} className="mt-3 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white">{saving ? "Saving" : "Save feedback"}</button></form>
    {loading ? <LoadingPanel /> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{items.length === 0 ? <EmptyState icon={MessageSquareText} title="No feedback" description="Add the first customer feedback record above." /> : <div className="divide-y divide-slate-100">{items.map((item) => <article key={item._id} className="p-5"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><strong>{item.rating}/5</strong><Pill tone={item.sentiment === "positive" ? "green" : item.sentiment === "negative" ? "red" : "slate"}>{item.sentiment}</Pill>{item.resolved ? <Pill tone="blue">resolved</Pill> : null}</div><p className="mt-2 text-sm text-slate-700">{item.comment || "No written comment"}</p><p className="mt-2 text-xs text-slate-400">{formatDateTime(item.createdAt)} · Score {item.sentimentScore}</p></div><button type="button" onClick={() => markResolved(item)} className="rounded-lg border px-3 py-2 text-xs font-semibold">{item.resolved ? "Reopen" : "Mark resolved"}</button></div></article>)}</div>}</section>}
  </main>;
}
