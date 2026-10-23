import {
  BadgePoundSterling,
  BarChart3,
  ContactRound,
  ExternalLink,
  RefreshCw,
  Star,
  Target,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import API from "../api/axios.js";
import useAuth from "../hooks/useAuth.js";
import { hasPermission } from "../utils/permissions.js";

function money(value, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  } catch {
    return `${currency} ${(Number(value) || 0).toFixed(2)}`;
  }
}

function percent(value) {
  return `${(Number(value) || 0).toFixed(1)}%`;
}

function leadName(lead) {
  const name = `${lead?.firstName || ""} ${lead?.lastName || ""}`.trim();
  return name || lead?.email || lead?.phone || "Unnamed lead";
}

function sourceLabel(lead) {
  const source = lead?.source || {};
  return [source.channel || "other", source.system, source.campaign]
    .filter(Boolean)
    .join(" · ");
}

function Card({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <Icon size={19} aria-hidden="true" />
      <small className="mt-3 block text-stone-500">{label}</small>
      <strong className="mt-1 block text-xl text-black">{value}</strong>
      {detail ? <span className="mt-1 block text-xs text-stone-500">{detail}</span> : null}
    </div>
  );
}

export default function GrowthLeadConversionPage() {
  const { user } = useAuth();
  const canUpdateCustomers = hasPermission(user, "customer:update");
  const canReadReports = hasPermission(user, "reports:read");
  const [leads, setLeads] = useState([]);
  const [attribution, setAttribution] = useState(null);
  const [growthChannels, setGrowthChannels] = useState(null);
  const [externalReviews, setExternalReviews] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadAttribution, setLeadAttribution] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    const requests = [
      API.get("/leads", { params: { limit: 100 } }),
      API.get("/integration-platform/growth-channels/catalogue").catch(() => ({ data: null })),
      API.get("/integration-platform/growth-channels/reviews", { params: { limit: 20 } })
        .catch(() => ({ data: { items: [] } })),
    ];
    if (canReadReports) {
      requests.push(API.get("/leads/attribution/summary"));
    }
    try {
      const [leadResponse, channelResponse, reviewResponse, attributionResponse] = await Promise.all(requests);
      setLeads(leadResponse.data?.items || []);
      setGrowthChannels(channelResponse.data || null);
      setExternalReviews(reviewResponse.data?.items || []);
      setAttribution(attributionResponse?.data || null);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Growth and lead-conversion data could not be loaded.");
    }
  }

  useEffect(() => { void load(); }, [canReadReports]);

  const leadSummary = useMemo(() => {
    const total = leads.length;
    const converted = leads.filter((lead) => lead.status === "converted").length;
    const qualified = leads.filter((lead) => ["qualified", "nurturing"].includes(lead.status)).length;
    const hot = leads.filter((lead) => lead.scoreBand === "hot").length;
    return {
      total,
      converted,
      qualified,
      hot,
      conversionRate: total ? (converted / total) * 100 : 0,
    };
  }, [leads]);

  async function selectLead(lead) {
    setSelectedLead(lead);
    setLeadAttribution(null);
    setError("");
    if (!canReadReports) return;
    try {
      const response = await API.get(`/leads/${lead._id}/attribution`);
      setLeadAttribution(response.data);
    } catch (requestError) {
      if (requestError?.response?.status !== 404) {
        setError(requestError?.response?.data?.message || "Lead attribution could not be loaded.");
      }
    }
  }

  async function reconcileLead(lead) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await API.post(`/leads/${lead._id}/attribution/reconcile`, {
        lookbackDays: 30,
        firstOnly: true,
      });
      setNotice(`Attribution reconciliation checked ${response.data?.candidates || 0} booking candidate(s) and created ${response.data?.created || 0} link(s).`);
      await load();
      await selectLead(lead);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Lead attribution reconciliation failed.");
    } finally {
      setBusy(false);
    }
  }

  const topAttribution = attribution?.items?.slice(0, 8) || [];

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-6 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Stage 6 · Cross-channel growth & lead conversion</p>
              <h1 className="mt-2 text-3xl font-bold text-black">Growth & Lead Conversion</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-600">
                Review canonical leads, opportunities, source mapping and immutable lead → booking → payment attribution. External reviews remain separate provider evidence; first-party Reputation Hub records remain authoritative for SalonAI reviews.
              </p>
            </div>
            <button type="button" onClick={load} className="app-button app-button-secondary"><RefreshCw size={17}/>Refresh</button>
          </div>
        </section>

        {error ? <section className="rounded-2xl border border-amber-500 bg-amber-50 p-4 text-black" role="alert">{error}</section> : null}
        {notice ? <section className="rounded-2xl border border-black/10 bg-white p-4 text-black" role="status">{notice}</section> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card icon={ContactRound} label="Captured leads" value={leadSummary.total} />
          <Card icon={UsersRound} label="Converted customers" value={leadSummary.converted} detail={percent(leadSummary.conversionRate)} />
          <Card icon={Target} label="Qualified / nurturing" value={leadSummary.qualified} />
          <Card icon={BarChart3} label="Attributed bookings" value={attribution?.totals?.attributedBookings ?? "—"} detail={attribution ? `${attribution.totals?.paidBookings || 0} paid` : "Requires reports access"} />
          <Card icon={BadgePoundSterling} label="Attributed net revenue" value={attribution ? money(attribution.totals?.netRevenue, attribution.totals?.currency) : "—"} detail={`${leadSummary.hot} hot lead(s)`} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">Lead pipeline</h2>
            <p className="mt-1 text-sm text-stone-600">The existing Lead domain remains the CRM authority. Click a lead to inspect its payment-backed attribution evidence.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-3 pr-3">Lead</th><th className="py-3 pr-3">Status</th><th className="py-3 pr-3">Score</th><th className="py-3 pr-3">Source</th><th className="py-3">Actions</th></tr></thead>
                <tbody>{leads.map((lead) => <tr key={lead._id} className="border-b border-stone-100 align-top"><td className="py-3 pr-3"><button type="button" className="font-semibold text-left underline-offset-2 hover:underline" onClick={()=>selectLead(lead)}>{leadName(lead)}</button><div className="text-xs text-stone-500">{lead.email || lead.phone || "No contact detail"}</div></td><td className="py-3 pr-3 capitalize">{String(lead.status || "new").replaceAll("_", " ")}</td><td className="py-3 pr-3">{lead.currentScore || 0} · {lead.scoreBand || "cold"}</td><td className="py-3 pr-3">{sourceLabel(lead)}</td><td className="py-3">{canUpdateCustomers && lead.customer ? <button type="button" disabled={busy} onClick={()=>reconcileLead(lead)} className="app-button app-button-secondary app-button-sm">Reconcile booking</button> : <span className="text-xs text-stone-500">{lead.customer ? "Read only" : "Convert first"}</span>}</td></tr>)}</tbody>
              </table>
              {!leads.length ? <p className="py-6 text-sm text-stone-500">No leads are currently available.</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">Lead attribution evidence</h2>
            {!selectedLead ? <p className="mt-3 text-sm text-stone-500">Select a lead to inspect its source, bookings and canonical Payment evidence.</p> : <div className="mt-4 space-y-4"><div><small className="text-stone-500">Selected lead</small><h3 className="font-bold">{leadName(selectedLead)}</h3><p className="text-sm text-stone-600">{sourceLabel(selectedLead)}</p></div>{leadAttribution ? <><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-stone-50 p-3"><small className="text-stone-500">Attributed bookings</small><strong className="block text-lg">{leadAttribution.summary?.bookingCount || 0}</strong></div><div className="rounded-xl bg-stone-50 p-3"><small className="text-stone-500">Net revenue</small><strong className="block text-lg">{money(leadAttribution.summary?.netRevenue, leadAttribution.summary?.currency)}</strong></div></div><div className="divide-y divide-stone-200">{(leadAttribution.bookings || []).map((entry)=><div key={entry.attribution?._id} className="py-3 text-sm"><strong>Booking {String(entry.attribution?.appointment || "").slice(-8)}</strong><p className="text-stone-600">{entry.payments?.length || 0} payment(s) · {money(entry.revenue?.net, entry.revenue?.currency)}</p></div>)}</div></> : <p className="text-sm text-stone-500">No attributed booking evidence yet.</p>}</div>}
          </div>
        </section>

        {canReadReports ? <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Channel & campaign attribution</h2><p className="mt-1 text-sm text-stone-600">Revenue is calculated from canonical Payment records linked through immutable booking attribution.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-3">Channel</th><th>System</th><th>Campaign</th><th>Bookings</th><th>Paid</th><th>Booking→payment</th><th>Net revenue</th></tr></thead><tbody>{topAttribution.map((item)=><tr key={`${item.channel}-${item.system}-${item.campaign}`} className="border-b border-stone-100"><td className="py-3 capitalize">{item.channel}</td><td>{item.system || "—"}</td><td>{item.campaign || "—"}</td><td>{item.bookings}</td><td>{item.paidBookings}</td><td>{percent(item.bookingToPaymentRate)}</td><td>{money(item.netRevenue, item.currency)}</td></tr>)}</tbody></table></div></section> : null}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Growth connector contracts</h2><p className="mt-1 text-sm text-stone-600">Provider connectors remain governed through IntegrationApp credentials and explicit activation.</p><div className="mt-4 space-y-3">{(growthChannels?.connectors || []).map((connector)=><article key={connector.key} className="rounded-xl border border-stone-200 p-3"><strong>{connector.label}</strong><p className="mt-1 text-xs text-stone-500">{(connector.capabilities || []).join(" · ")}</p></article>)}</div></div>
          <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Star size={18}/><h2 className="text-xl font-bold">External reputation evidence</h2></div><p className="mt-1 text-sm text-stone-600">Provider reviews are provenance records, not duplicates of first-party SalonAI reviews. External replies require explicit human approval.</p><div className="mt-4 divide-y divide-stone-200">{externalReviews.slice(0,8).map((review)=><article key={review._id} className="py-3"><div className="flex items-center justify-between gap-3"><strong>{review.provider === "google_business_profile" ? "Google" : review.provider}</strong><span className="text-sm">{"★".repeat(Math.max(0, Math.min(5, review.rating || 0)))}</span></div><p className="mt-1 line-clamp-2 text-sm text-stone-600">{review.comment || "No written comment."}</p><div className="mt-2 flex items-center gap-3 text-xs text-stone-500"><span>{review.response?.status ? `Reply: ${review.response.status}` : "No reply draft"}</span>{review.sourceUrl ? <a href={review.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">Provider <ExternalLink size={12}/></a> : null}</div></article>)}{!externalReviews.length ? <p className="py-5 text-sm text-stone-500">No external provider reviews have been synchronised.</p> : null}</div></div>
        </section>
      </div>
    </main>
  );
}
