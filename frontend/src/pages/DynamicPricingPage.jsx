import { useCallback, useEffect, useState } from "react";
import { BadgePoundSterling, BarChart3, ShieldCheck, TrendingUp } from "lucide-react";

import { getDynamicPricingRecommendations } from "../Services/dynamicPricingService.js";
import { EmptyState, ErrorBanner, FeatureHeader, LoadingPanel, Pill, SummaryCard } from "../shared/FutureUi.jsx";
import { formatCurrency, formatPercentage, getErrorMessage } from "../shared/formatters.js";

export default function DynamicPricingPage() {
  const [months, setMonths] = useState(6);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (initial = false) => { initial ? setLoading(true) : setRefreshing(true); setError(""); try { const response = await getDynamicPricingRecommendations({ months }); setAnalytics(response?.analytics || response); } catch (requestError) { setError(getErrorMessage(requestError, "Unable to load pricing recommendations.")); } finally { setLoading(false); setRefreshing(false); } }, [months]);
  useEffect(() => { load(true); }, [load]);

  const summary = analytics?.summary || {};
  const rows = analytics?.recommendations || [];
  const currency = analytics?.currency || "GBP";

  return <main className="space-y-7 p-6">
    <FeatureHeader icon={BadgePoundSterling} title="Dynamic Pricing Recommendations" description="Generate bounded, explainable pricing recommendations without automatically changing service prices." generatedAt={analytics?.generatedAt} onRefresh={() => load()} refreshing={refreshing} />
    <ErrorBanner message={error} />
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><ShieldCheck className="mr-2 inline" size={18} />Recommendations are limited to -15% and +20%. No automatic price changes occur.</section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><label className="text-sm font-semibold">Reporting period <select value={months} onChange={(event) => setMonths(Number(event.target.value))} className="ml-3 rounded-lg border p-2"><option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>12 months</option><option value={24}>24 months</option></select></label></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard title="Services" value={summary.serviceCount || 0} description="Services analysed" icon={BarChart3} loading={loading} /><SummaryCard title="Increase tests" value={summary.increaseRecommendations || 0} description="High-demand premium tests" icon={TrendingUp} loading={loading} /><SummaryCard title="Off-peak tests" value={summary.discountRecommendations || 0} description="Targeted discount tests" icon={BadgePoundSterling} loading={loading} /><SummaryCard title="Estimated difference" value={formatCurrency(summary.estimatedRevenueDifference, currency)} description="Modelled revenue difference" icon={ShieldCheck} loading={loading} /></section>
    {loading ? <LoadingPanel /> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{rows.length === 0 ? <EmptyState icon={BadgePoundSterling} title="No pricing records" description="Completed appointments with service references are required." /> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{["Service", "Demand index", "Completion", "Loss", "Base price", "Modifier", "Suggested price", "Recommendation"].map((heading) => <th key={heading} className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-500">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.serviceId}><td className="px-5 py-4"><p className="font-semibold">{row.name}</p><p className="text-xs text-slate-400">{row.category}</p></td><td className="px-5 py-4">{row.demandIndex}</td><td className="px-5 py-4">{formatPercentage(row.completionRate)}</td><td className="px-5 py-4">{formatPercentage(row.lossRate)}</td><td className="px-5 py-4">{formatCurrency(row.basePrice, currency)}</td><td className="px-5 py-4"><Pill tone={row.modifierPercent > 0 ? "green" : row.modifierPercent < 0 ? "amber" : "slate"}>{row.modifierPercent > 0 ? "+" : ""}{row.modifierPercent}%</Pill></td><td className="px-5 py-4 font-semibold text-indigo-700">{formatCurrency(row.suggestedPrice, currency)}</td><td className="max-w-sm px-5 py-4 text-sm text-slate-600">{row.recommendation}</td></tr>)}</tbody></table></div>}</section>}
  </main>;
}
