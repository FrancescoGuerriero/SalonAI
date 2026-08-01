import { useCallback, useEffect, useState } from "react";
import { Boxes, Building2, CalendarDays, MessageSquareText, PoundSterling, Send } from "lucide-react";

import { getExecutiveCommandCentre } from "../services/executiveCommandService.js";
import { EmptyState, ErrorBanner, FeatureHeader, LoadingPanel, Pill, SummaryCard } from "../shared/FutureUi.jsx";
import { formatCurrency, formatPercentage, getErrorMessage } from "../shared/formatters.js";

export default function ExecutiveCommandCentrePage() {
  const [days, setDays] = useState(90);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (initial = false) => { initial ? setLoading(true) : setRefreshing(true); setError(""); try { const response = await getExecutiveCommandCentre({ days }); setAnalytics(response?.analytics || response); } catch (requestError) { setError(getErrorMessage(requestError, "Unable to load the executive command centre.")); } finally { setLoading(false); setRefreshing(false); } }, [days]);
  useEffect(() => { load(true); }, [load]);

  const summary = analytics?.summary || {};
  const alerts = analytics?.alerts || [];
  const topServices = analytics?.topServices || [];

  return <main className="space-y-7 p-6">
    <FeatureHeader icon={Building2} title="Executive Command Centre" description="A consolidated management view of appointments, revenue, customers, campaigns, inventory and feedback." generatedAt={analytics?.generatedAt} onRefresh={() => load()} refreshing={refreshing} />
    <ErrorBanner message={error} />
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><label className="text-sm font-semibold">Reporting window <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="ml-3 rounded-lg border p-2"><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>365 days</option></select></label></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><SummaryCard title="Appointments" value={summary.appointments || 0} description="Appointments in period" icon={CalendarDays} loading={loading} /><SummaryCard title="Upcoming" value={summary.upcomingAppointments || 0} description="Active next-30-day bookings" icon={CalendarDays} loading={loading} /><SummaryCard title="Revenue" value={formatCurrency(summary.revenue)} description="Completed appointment revenue" icon={PoundSterling} loading={loading} /><SummaryCard title="Completion" value={formatPercentage(summary.completionRate)} description="Completed share of bookings" icon={Building2} loading={loading} /><SummaryCard title="Low stock" value={summary.lowStockItems || 0} description="Inventory items at threshold" icon={Boxes} loading={loading} /><SummaryCard title="Campaign conversion" value={formatPercentage(summary.campaignConversionRate)} description="Campaign recipients who rebooked" icon={Send} loading={loading} /></section>
    {loading ? <LoadingPanel /> : <section className="grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Executive alerts</h2>{alerts.length === 0 ? <EmptyState icon={Building2} title="No executive alerts" description="Current metrics are below configured alert thresholds." /> : <div className="mt-4 space-y-3">{alerts.map((alert, index) => <div key={`${alert.type}-${index}`} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2"><Pill tone={alert.severity === "high" ? "red" : "amber"}>{alert.severity}</Pill><strong className="capitalize">{alert.type}</strong></div><p className="mt-2 text-sm text-slate-600">{alert.message}</p></div>)}</div>}</article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Top services by revenue</h2>{topServices.length === 0 ? <EmptyState icon={PoundSterling} title="No service revenue" description="Completed service appointments are required." /> : <div className="mt-4 divide-y divide-slate-100">{topServices.map((service, index) => <div key={service.name} className="flex items-center justify-between py-4"><div><strong>#{index + 1} {service.name}</strong><p className="text-xs text-slate-400">{service.appointments} completed</p></div><span className="font-bold text-emerald-700">{formatCurrency(service.revenue)}</span></div>)}</div>}</article></section>}
    {!loading ? <section className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><MessageSquareText className="text-indigo-600" /><p className="mt-3 text-sm text-slate-500">Average rating</p><p className="text-2xl font-bold">{Number(summary.averageRating || 0).toFixed(2)}</p></div><div className="rounded-2xl border bg-white p-5"><Boxes className="text-indigo-600" /><p className="mt-3 text-sm text-slate-500">Active inventory items</p><p className="text-2xl font-bold">{summary.activeInventoryItems || 0}</p></div><div className="rounded-2xl border bg-white p-5"><Send className="text-indigo-600" /><p className="mt-3 text-sm text-slate-500">Sent campaigns</p><p className="text-2xl font-bold">{summary.sentCampaigns || 0}</p></div></section> : null}
  </main>;
}
