import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  Megaphone,
  Play,
  Plus,
  PoundSterling,
  Send,
  UsersRound,
  XCircle,
} from "lucide-react";

import {
  cancelRebookingCampaign,
  createRebookingCampaign,
  getRebookingCampaignResults,
  listRebookingCampaigns,
  scheduleRebookingCampaign,
  sendRebookingCampaign,
} from "../Services/rebookingCampaignService.js";
import {
  EmptyState,
  ErrorBanner,
  FeatureHeader,
  LoadingPanel,
  Pill,
  SummaryCard,
} from "../shared/FutureUi.jsx";
import { formatCurrency, formatDateTime, getErrorMessage } from "../shared/formatters.js";

const initialForm = {
  name: "",
  channel: "email",
  subject: "Time to rebook your salon appointment",
  message: "Hello {{name}}, it may be time to rebook your {{serviceName}} appointment. Reply or book online to reserve a suitable time.",
  recipientName: "",
  recipientEmail: "",
  recipientPhone: "",
  serviceName: "",
  estimatedRevenue: "",
};

export default function RebookingCampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState({});

  const loadCampaigns = useCallback(async (initial = false) => {
    initial ? setLoading(true) : setRefreshing(true);
    setError("");
    try {
      const response = await listRebookingCampaigns({ limit: 100 });
      setCampaigns(response?.campaigns || []);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to load rebooking campaigns."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns(true);
  }, [loadCampaigns]);

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createRebookingCampaign({
        name: form.name,
        channel: form.channel,
        subject: form.channel === "email" ? form.subject : "",
        message: form.message,
        recipients: [
          {
            name: form.recipientName,
            email: form.recipientEmail,
            phone: form.recipientPhone,
            serviceName: form.serviceName,
            estimatedRevenue: Number(form.estimatedRevenue || 0),
            sourceStatus: "manual",
            priority: "medium",
          },
        ],
      });
      setForm(initialForm);
      await loadCampaigns();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to create the campaign."));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action, campaign) {
    setError("");
    try {
      if (action === "schedule") {
        const value = window.prompt(
          "Enter a future date and time, for example 2026-08-01T10:00",
          ""
        );
        if (!value) return;
        await scheduleRebookingCampaign(campaign._id, new Date(value).toISOString());
      }
      if (action === "send") await sendRebookingCampaign(campaign._id);
      if (action === "cancel") await cancelRebookingCampaign(campaign._id);
      if (action === "results") {
        const response = await getRebookingCampaignResults(campaign._id);
        setResults((current) => ({ ...current, [campaign._id]: response?.results }));
      }
      await loadCampaigns();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Campaign action failed."));
    }
  }

  const recipientCount = campaigns.reduce(
    (total, campaign) => total + (campaign.recipients?.length || 0),
    0
  );
  const sentCount = campaigns.filter((campaign) => campaign.status === "sent").length;
  const recoverable = campaigns.reduce(
    (total, campaign) =>
      total +
      (campaign.recipients || []).reduce(
        (recipientTotal, recipient) =>
          recipientTotal + Number(recipient.estimatedRevenue || 0),
        0
      ),
    0
  );

  return (
    <main className="space-y-7 p-6">
      <FeatureHeader
        icon={Megaphone}
        title="Automated Rebooking Campaigns"
        description="Create, schedule, queue and measure personalised customer rebooking outreach."
        onRefresh={() => loadCampaigns()}
        refreshing={refreshing}
      />
      <ErrorBanner message={error} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Campaigns" value={campaigns.length} description="All rebooking campaigns" icon={Megaphone} loading={loading} />
        <SummaryCard title="Recipients" value={recipientCount} description="Customers included in campaigns" icon={UsersRound} loading={loading} />
        <SummaryCard title="Sent" value={sentCount} description="Campaigns dispatched through an adapter" icon={Send} loading={loading} />
        <SummaryCard title="Opportunity value" value={formatCurrency(recoverable)} description="Estimated recipient revenue" icon={PoundSterling} loading={loading} />
      </section>

      <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Plus size={20} className="text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-900">Create a campaign</h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Campaign name" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          <select value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value })} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
          <input required value={form.recipientName} onChange={(event) => setForm({ ...form, recipientName: event.target.value })} placeholder="Recipient name" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          <input value={form.serviceName} onChange={(event) => setForm({ ...form, serviceName: event.target.value })} placeholder="Service name" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          <input type="email" value={form.recipientEmail} onChange={(event) => setForm({ ...form, recipientEmail: event.target.value })} placeholder="Recipient email" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          <input value={form.recipientPhone} onChange={(event) => setForm({ ...form, recipientPhone: event.target.value })} placeholder="Recipient phone" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          <input type="number" min="0" step="0.01" value={form.estimatedRevenue} onChange={(event) => setForm({ ...form, estimatedRevenue: event.target.value })} placeholder="Estimated revenue" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          {form.channel === "email" ? (
            <input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Email subject" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          ) : <div />}
        </div>
        <textarea required rows={4} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
        <button disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          <Plus size={17} /> {saving ? "Creating" : "Create campaign"}
        </button>
      </form>

      {loading ? (
        <LoadingPanel />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-bold text-slate-900">Campaign library</h2>
          </header>
          {campaigns.length === 0 ? (
            <EmptyState icon={Megaphone} title="No campaigns" description="Create the first rebooking campaign above." />
          ) : (
            <div className="divide-y divide-slate-100">
              {campaigns.map((campaign) => {
                const campaignResults = results[campaign._id];
                return (
                  <article key={campaign._id} className="p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900">{campaign.name}</h3>
                          <Pill tone={campaign.status === "sent" ? "green" : campaign.status === "cancelled" ? "red" : "blue"}>{campaign.status}</Pill>
                          <Pill>{campaign.channel}</Pill>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{campaign.message}</p>
                        <p className="mt-2 text-xs text-slate-400">Created {formatDateTime(campaign.createdAt)} · {campaign.recipients?.length || 0} recipients</p>
                        {campaignResults ? (
                          <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                            {campaignResults.rebookedCount} rebooked · {campaignResults.conversionRate}% conversion · {formatCurrency(campaignResults.recoveredRevenue)} recovered
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => runAction("schedule", campaign)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"><CalendarClock size={14} />Schedule</button>
                        <button type="button" onClick={() => runAction("send", campaign)} className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-700"><Send size={14} />Send</button>
                        <button type="button" onClick={() => runAction("results", campaign)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700"><Play size={14} />Results</button>
                        <button type="button" onClick={() => runAction("cancel", campaign)} className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700"><XCircle size={14} />Cancel</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
