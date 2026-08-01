import { useCallback, useEffect, useState } from "react";
import { CalendarCheck2, Clock3, Search, Sparkles, UserRound } from "lucide-react";

import { getSmartAppointmentRecommendations } from "../Services/smartAppointmentService.js";
import { EmptyState, ErrorBanner, FeatureHeader, LoadingPanel, Pill, SummaryCard } from "../shared/FutureUi.jsx";
import { formatDateTime, getErrorMessage } from "../shared/formatters.js";

export default function SmartAppointmentsPage() {
  const [form, setForm] = useState({ customerId: "", serviceId: "", days: 21, duration: 60 });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (initial = false) => {
    initial ? setLoading(true) : setRefreshing(true);
    setError("");
    try {
      const response = await getSmartAppointmentRecommendations(form);
      setAnalytics(response?.analytics || response);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to generate appointment recommendations."));
    } finally { setLoading(false); setRefreshing(false); }
  }, [form]);

  useEffect(() => { load(true); }, []);

  const summary = analytics?.summary || {};
  const rows = analytics?.recommendations || [];

  return <main className="space-y-7 p-6">
    <FeatureHeader icon={Sparkles} title="Smart Appointment Recommendations" description="Recommend available slots by combining current bookings, customer history, stylist affinity and workload balancing." generatedAt={analytics?.generatedAt} onRefresh={() => load()} refreshing={refreshing} />
    <ErrorBanner message={error} />
    <form onSubmit={(event) => { event.preventDefault(); load(); }} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-5">
      <input value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })} placeholder="Customer ID (optional)" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
      <input value={form.serviceId} onChange={(event) => setForm({ ...form, serviceId: event.target.value })} placeholder="Service ID (optional)" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
      <input type="number" min="1" max="90" value={form.days} onChange={(event) => setForm({ ...form, days: Number(event.target.value) })} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
      <input type="number" min="15" max="480" value={form.duration} onChange={(event) => setForm({ ...form, duration: Number(event.target.value) })} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
      <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white"><Search size={17} />Recommend</button>
    </form>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard title="Recommendations" value={summary.recommendationCount || 0} description="Available ranked slots" icon={CalendarCheck2} loading={loading} />
      <SummaryCard title="Stylists" value={summary.stylistCount || 0} description="Stylists considered" icon={UserRound} loading={loading} />
      <SummaryCard title="Upcoming checked" value={summary.checkedUpcomingBookings || 0} description="Existing bookings checked for overlap" icon={Clock3} loading={loading} />
      <SummaryCard title="History used" value={summary.historicalAppointments || 0} description="Completed appointments used for preferences" icon={Sparkles} loading={loading} />
    </section>
    {loading ? <LoadingPanel /> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {rows.length === 0 ? <EmptyState icon={CalendarCheck2} title="No suitable slots" description="Increase the date range or check that appointments contain stylist references." /> : <div className="divide-y divide-slate-100">{rows.map((row) => <article key={`${row.stylistId}-${row.startsAt}`} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><span className="font-bold text-slate-900">#{row.rank} {row.stylistName}</span><Pill tone="blue">Score {row.score}</Pill></div><p className="mt-2 text-sm text-slate-600">{formatDateTime(row.startsAt)} · {row.duration} minutes</p><p className="mt-1 text-xs text-slate-400">{row.reasons?.join(" · ")}</p></div><Pill tone="green">Available</Pill></article>)}</div>}
    </section>}
  </main>;
}
