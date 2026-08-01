import { useCallback, useEffect, useState } from "react";
import { Activity, Clock3, Gauge, UsersRound } from "lucide-react";

import { getCapacityPlan } from "../services/capacityPlanningService.js";
import { EmptyState, ErrorBanner, FeatureHeader, LoadingPanel, Pill, SummaryCard } from "../shared/FutureUi.jsx";
import { formatNumber, formatPercentage, getErrorMessage } from "../shared/formatters.js";

export default function CapacityPlanningPage() {
  const [months, setMonths] = useState(3);
  const [weeklyHoursPerStaff, setWeeklyHoursPerStaff] = useState(40);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (initial = false) => {
    initial ? setLoading(true) : setRefreshing(true); setError("");
    try { const response = await getCapacityPlan({ months, weeklyHoursPerStaff }); setAnalytics(response?.analytics || response); }
    catch (requestError) { setError(getErrorMessage(requestError, "Unable to load capacity planning.")); }
    finally { setLoading(false); setRefreshing(false); }
  }, [months, weeklyHoursPerStaff]);

  useEffect(() => { load(true); }, [load]);
  const summary = analytics?.summary || {};
  const staff = analytics?.staff || [];

  return <main className="space-y-7 p-6">
    <FeatureHeader icon={Gauge} title="Staff Capacity Planning" description="Compare booked service time with configurable staff capacity and identify underused or overloaded schedules." generatedAt={analytics?.generatedAt} onRefresh={() => load()} refreshing={refreshing} />
    <ErrorBanner message={error} />
    <section className="flex flex-wrap gap-4 rounded-2xl border border-slate-200 bg-white p-5"><label className="text-sm font-semibold">Months <select value={months} onChange={(event) => setMonths(Number(event.target.value))} className="ml-2 rounded-lg border p-2"><option value={1}>1</option><option value={3}>3</option><option value={6}>6</option><option value={12}>12</option></select></label><label className="text-sm font-semibold">Weekly hours per staff <input type="number" min="1" max="80" value={weeklyHoursPerStaff} onChange={(event) => setWeeklyHoursPerStaff(Number(event.target.value))} className="ml-2 w-24 rounded-lg border p-2" /></label></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard title="Staff" value={summary.staffCount || 0} description="Staff with capacity data" icon={UsersRound} loading={loading} /><SummaryCard title="Booked hours" value={formatNumber(summary.totalBookedHours)} description="Total service time booked" icon={Clock3} loading={loading} /><SummaryCard title="Spare hours" value={formatNumber(summary.spareHours)} description="Estimated unused capacity" icon={Activity} loading={loading} /><SummaryCard title="Utilisation" value={formatPercentage(summary.utilisationRate)} description="Booked share of available hours" icon={Gauge} loading={loading} /></section>
    {loading ? <LoadingPanel /> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{staff.length === 0 ? <EmptyState icon={UsersRound} title="No staff capacity data" description="Appointments need stylist references to calculate utilisation." /> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{["Staff", "Appointments", "Booked hours", "Available hours", "Spare hours", "Utilisation", "Status"].map((heading) => <th key={heading} className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-500">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{staff.map((row) => <tr key={row.stylistId}><td className="px-5 py-4 font-semibold">{row.name}</td><td className="px-5 py-4">{row.appointmentCount}</td><td className="px-5 py-4">{row.bookedHours}</td><td className="px-5 py-4">{row.availableHours}</td><td className="px-5 py-4">{row.spareHours}</td><td className="px-5 py-4">{formatPercentage(row.utilisationRate)}</td><td className="px-5 py-4"><Pill tone={row.status === "overloaded" ? "red" : row.status === "balanced" ? "green" : "amber"}>{row.status}</Pill></td></tr>)}</tbody></table></div>}</section>}
  </main>;
}
