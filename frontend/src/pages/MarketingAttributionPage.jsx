import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Megaphone, MousePointerClick, PoundSterling } from "lucide-react";
import { getMarketingAttribution } from "../services/marketingAttributionService.js";
import { EmptyState, ErrorBanner, FeatureHeader, LoadingPanel, SummaryCard } from "../shared/FutureUi.jsx";
import { formatCurrency, formatPercentage, getErrorMessage } from "../shared/formatters.js";
function AttributionTable({
  title,
  rows,
  currency
}) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 p-5"><h2 className="text-xl font-bold text-slate-900">{title}</h2></header>
      {rows.length === 0 ? <EmptyState icon={BarChart3} title="No attribution records" description="Appointments do not yet contain campaign or source fields for this period." /> : <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50"><tr>{["Name", "Appointments", "Completed", "Conversion", "Customers", "Revenue"].map(heading => <th key={heading} className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-500">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.key}><td className="px-5 py-4 font-semibold text-slate-900 capitalize">{row.name}</td><td className="px-5 py-4">{row.appointments}</td><td className="px-5 py-4">{row.completedAppointments}</td><td className="px-5 py-4">{formatPercentage(row.conversionRate)}</td><td className="px-5 py-4">{row.uniqueCustomers}</td><td className="px-5 py-4 font-semibold text-emerald-700">{formatCurrency(row.revenue, currency)}</td></tr>)}</tbody>
          </table>
        </div>}
    </section>;
}
export default function MarketingAttributionPage() {
  const [months, setMonths] = useState(12);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (initial = false) => {
    initial ? setLoading(true) : setRefreshing(true);
    setError("");
    try {
      const response = await getMarketingAttribution({
        months
      });
      setAnalytics(response?.analytics || response);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to load marketing attribution."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [months]);
  useEffect(() => {
    load(true);
  }, [load]);
  const summary = analytics?.summary || {};
  const currency = analytics?.currency || "GBP";
  return <main className="space-y-7 p-6">
    <FeatureHeader icon={MousePointerClick} title="Marketing Attribution" description="Measure which acquisition sources and campaigns produce appointments, completed visits and revenue." generatedAt={analytics?.generatedAt} onRefresh={() => load()} refreshing={refreshing} />
    <ErrorBanner message={error} />
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><label className="text-sm font-semibold text-slate-700">Reporting period<select value={months} onChange={event => setMonths(Number(event.target.value))} className="ml-3 rounded-xl border border-slate-300 px-3 py-2"><option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>12 months</option><option value={24}>24 months</option></select></label></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard title="Attributed bookings" value={summary.attributedAppointments || 0} description="Appointments with a source classification" icon={Megaphone} loading={loading} />
      <SummaryCard title="Completed" value={summary.completedAppointments || 0} description="Attributed completed appointments" icon={CheckCircle2} loading={loading} />
      <SummaryCard title="Conversion" value={formatPercentage(summary.overallConversionRate)} description="Completed share of attributed appointments" icon={BarChart3} loading={loading} />
      <SummaryCard title="Revenue" value={formatCurrency(summary.attributedRevenue, currency)} description="Revenue from completed attributed appointments" icon={PoundSterling} loading={loading} />
    </section>
    {loading ? <LoadingPanel /> : <><AttributionTable title="Acquisition sources" rows={analytics?.sources || []} currency={currency} /><AttributionTable title="Campaign attribution" rows={analytics?.campaigns || []} currency={currency} /></>}
  </main>;
}
