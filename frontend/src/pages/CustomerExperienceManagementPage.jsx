import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  MessageSquareText,
  Plus,
  RefreshCw,
  Star,
  Tag,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import customerExperienceService from "../Services/customerExperienceService.js";

const newOffer = () => ({
  code: "",
  title: "",
  description: "",
  discountType: "percentage",
  value: "",
  minimumSpend: "0",
  startsAt: new Date().toISOString().slice(0, 10),
  endsAt: "",
  maxClaims: "",
  active: true,
});

const idOf = (item) => String(item?._id ?? item?.id ?? "");
const appointmentName = (item) => item?.service?.name || "salon appointment";

function formatDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function flatten(profiles, key) {
  return profiles.flatMap((profile) =>
    (profile[key] || []).map((record) => ({ record, customer: profile.user }))
  );
}

function Queue({ title, description, icon: Icon, items, empty, children }) {
  return (
    <section className="experience-management-panel">
      <header>
        <span><Icon size={20} /></span>
        <div><h2>{title}</h2><p>{description}</p></div>
        <b>{items.length}</b>
      </header>
      {items.length ? (
        <div className="experience-management-list">{items.map(children)}</div>
      ) : (
        <div className="experience-empty"><p>{empty}</p></div>
      )}
    </section>
  );
}

export default function CustomerExperienceManagementPage() {
  const [data, setData] = useState({ profiles: [], offers: [] });
  const [offer, setOffer] = useState(newOffer);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await customerExperienceService.getManagementOverview());
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Customer experience work could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = useCallback(async (action, message) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(message);
      setData(await customerExperienceService.getManagementOverview());
      return true;
    } catch (requestError) {
      setError(requestError.response?.data?.message || "The update could not be completed.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const queues = useMemo(() => ({
    requests: flatten(data.profiles || [], "appointmentRequests").filter(({ record }) => record.status === "pending"),
    reviews: flatten(data.profiles || [], "reviews").filter(({ record }) => record.status === "pending"),
    consultations: flatten(data.profiles || [], "consultations").filter(({ record }) => record.status === "submitted"),
    feedback: flatten(data.profiles || [], "feedback").filter(({ record }) => !["resolved", "closed"].includes(record.status)),
  }), [data.profiles]);

  async function submitOffer(event) {
    event.preventDefault();
    const saved = await act(
      () => customerExperienceService.createOffer({
        ...offer,
        value: Number(offer.value),
        minimumSpend: Number(offer.minimumSpend),
        maxClaims: offer.maxClaims ? Number(offer.maxClaims) : null,
      }),
      "Salon offer published."
    );
    if (saved) setOffer(newOffer());
  }

  return (
    <main className="experience-management-page" aria-busy={loading || busy}>
      <header className="app-page-header">
        <div>
          <div><p className="app-eyebrow">Premium customer care</p><h1>Customer experience desk</h1><p className="app-page-description">Publish salon offers and process appointment changes, verified reviews, consultations and product feedback.</p></div>
          <div className="app-page-actions"><button type="button" className="app-button app-button-secondary" onClick={load}><RefreshCw size={17} />Refresh</button></div>
        </div>
      </header>

      {error ? <div className="experience-message is-error" role="alert">{error}</div> : null}
      {notice ? <div className="experience-message is-success" role="status"><CheckCircle2 size={17} />{notice}</div> : null}

      <section className="experience-management-summary">
        <div><CalendarClock /><small>Appointment requests</small><strong>{queues.requests.length}</strong></div>
        <div><Star /><small>Reviews to moderate</small><strong>{queues.reviews.length}</strong></div>
        <div><ClipboardCheck /><small>Consultations</small><strong>{queues.consultations.length}</strong></div>
        <div><MessageSquareText /><small>Open feedback</small><strong>{queues.feedback.length}</strong></div>
      </section>

      <section className="experience-management-panel">
        <header><span><Tag size={20} /></span><div><h2>Offers and promotions</h2><p>Create dated, limited salon offers that customers can discover and claim.</p></div><b>{data.offers?.length || 0}</b></header>
        <form className="experience-offer-form" onSubmit={submitOffer}>
          <label>Code<input required value={offer.code} onChange={(event) => setOffer({ ...offer, code: event.target.value.toUpperCase() })} /></label>
          <label>Title<input required value={offer.title} onChange={(event) => setOffer({ ...offer, title: event.target.value })} /></label>
          <label className="is-wide">Description<textarea required rows="3" value={offer.description} onChange={(event) => setOffer({ ...offer, description: event.target.value })} /></label>
          <label>Discount<select value={offer.discountType} onChange={(event) => setOffer({ ...offer, discountType: event.target.value })}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></label>
          <label>Value<input required min="0.01" step="0.01" type="number" value={offer.value} onChange={(event) => setOffer({ ...offer, value: event.target.value })} /></label>
          <label>Minimum spend<input min="0" step="0.01" type="number" value={offer.minimumSpend} onChange={(event) => setOffer({ ...offer, minimumSpend: event.target.value })} /></label>
          <label>Maximum claims<input min="1" type="number" value={offer.maxClaims} onChange={(event) => setOffer({ ...offer, maxClaims: event.target.value })} placeholder="No limit" /></label>
          <label>Starts<input required type="date" value={offer.startsAt} onChange={(event) => setOffer({ ...offer, startsAt: event.target.value })} /></label>
          <label>Ends<input required type="date" value={offer.endsAt} onChange={(event) => setOffer({ ...offer, endsAt: event.target.value })} /></label>
          <button className="app-button app-button-primary"><Plus size={17} />Publish offer</button>
        </form>
        {data.offers?.length ? (
          <div className="experience-management-list is-compact">
            {data.offers.map((item) => (
              <article key={idOf(item)}>
                <div><small>{item.code} · ends {formatDate(item.endsAt)}</small><strong>{item.title}</strong><p>{item.description} · {item.claimCount || 0} claims</p></div>
                <button type="button" className="app-button app-button-secondary app-button-sm" onClick={() => act(() => customerExperienceService.updateOffer(idOf(item), { ...item, active: !item.active }), item.active ? "Offer paused." : "Offer activated.")}>{item.active ? "Pause" : "Activate"}</button>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <div className="experience-management-grid">
        <Queue title="Appointment requests" description="Approval applies the cancellation or verifies and performs the requested reschedule." icon={CalendarClock} items={queues.requests} empty="No appointment requests are waiting.">
          {({ record, customer }) => <article key={idOf(record)}><div><small>{customer?.name} · {customer?.email}</small><strong>{record.requestType} {appointmentName(record.appointment)}</strong><p>{record.reason || "No reason supplied"}{record.preferredDate ? ` · ${formatDate(record.preferredDate)} at ${record.preferredTime}` : ""}</p></div><div><button type="button" className="app-button app-button-primary app-button-sm" onClick={() => act(() => customerExperienceService.resolveAppointmentRequest(idOf(record), { status: "approved" }), "Appointment request completed.")}>Approve</button><button type="button" className="app-button app-button-secondary app-button-sm" onClick={() => act(() => customerExperienceService.resolveAppointmentRequest(idOf(record), { status: "declined" }), "Appointment request declined.")}>Decline</button></div></article>}
        </Queue>
        <Queue title="Verified reviews" description="Publish authentic completed-appointment reviews or reject unsuitable content." icon={Star} items={queues.reviews} empty="No reviews require moderation.">
          {({ record, customer }) => <article key={idOf(record)}><div><small>{customer?.name} · {record.rating}/5</small><strong>{record.title || appointmentName(record.appointment)}</strong><p>{record.comment}</p></div><div><button type="button" className="app-button app-button-primary app-button-sm" onClick={() => act(() => customerExperienceService.updateReviewStatus(idOf(record), "published"), "Review published.")}>Publish</button><button type="button" className="app-button app-button-secondary app-button-sm" onClick={() => act(() => customerExperienceService.updateReviewStatus(idOf(record), "rejected"), "Review rejected.")}>Reject</button></div></article>}
        </Queue>
        <Queue title="Digital consultations" description="Mark preparation details as reviewed before the customer visit." icon={ClipboardCheck} items={queues.consultations} empty="No consultations are awaiting review.">
          {({ record, customer }) => <article key={idOf(record)}><div><small>{customer?.name} · {formatDate(record.createdAt)}</small><strong>{record.desiredOutcome}</strong><p>{record.hairType || "Hair type not supplied"}{record.sensitivities ? ` · Sensitivities: ${record.sensitivities}` : ""}</p></div><button type="button" className="app-button app-button-primary app-button-sm" onClick={() => act(() => customerExperienceService.updateConsultationStatus(idOf(record), "reviewed"), "Consultation marked reviewed.")}>Mark reviewed</button></article>}
        </Queue>
        <Queue title="Product feedback" description="Triage customer feedback into review, planning and resolution states." icon={MessageSquareText} items={queues.feedback} empty="No open product feedback.">
          {({ record, customer }) => <article key={idOf(record)}><div><small>{customer?.name} · {record.category} · {record.rating}/5</small><strong>{record.message}</strong><p>{record.allowContact ? "Customer permits follow-up" : "No follow-up permission"}</p></div><button type="button" className="app-button app-button-primary app-button-sm" onClick={() => act(() => customerExperienceService.updateFeedbackStatus(idOf(record), record.status === "new" ? "reviewing" : "resolved"), record.status === "new" ? "Feedback moved to review." : "Feedback resolved.")}>{record.status === "new" ? "Review" : "Resolve"}</button></article>}
        </Queue>
      </div>
    </main>
  );
}
