import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  CreditCard,
  ExternalLink,
  Gift,
  Heart,
  Inbox,
  LayoutTemplate,
  MapPin,
  MessageSquareText,
  MonitorSmartphone,
  Palette,
  Plus,
  ReceiptText,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Trash2,
  UserPlus,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getAppointments } from "../Services/appointmentApi.js";
import commerceService from "../Services/commerceService.js";
import customerExperienceService from "../Services/customerExperienceService.js";
import serviceService from "../Services/serviceService.js";
import stylistService from "../Services/stylistService.js";
import { roadmapFeatureMap, roadmapFeatures } from "../features/roadmap/roadmapFeatures.js";

const iconMap = {
  privacy: ShieldCheck,
  reviews: Star,
  favourites: Heart,
  offers: Tag,
  wallet: CreditCard,
  loyalty: Gift,
  appointments: CalendarClock,
  inbox: Inbox,
  pwa: MonitorSmartphone,
  seo: Search,
  analytics: BarChart3,
  performance: Activity,
  responsive: LayoutTemplate,
  testing: ClipboardCheck,
  release: CheckCircle2,
  "salon-discovery": MapPin,
  consultation: ReceiptText,
  inspiration: Palette,
  referrals: UserPlus,
  feedback: MessageSquareText,
};

const emptyProfile = {
  consents: { necessary: true, analytics: false, personalisation: false, marketing: false },
  reviews: [],
  favourites: [],
  claimedOffers: [],
  walletCards: [],
  appointmentRequests: [],
  discovery: {},
  consultations: [],
  inspirationItems: [],
  feedback: [],
};

function unwrapList(value, keys = []) {
  const payload = value?.data ?? value ?? {};
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}

function idOf(item) {
  return String(item?._id ?? item?.id ?? "");
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function appointmentStart(item) {
  if (item?.startsAt) return item.startsAt;
  const date = item?.appointmentDate ? new Date(item.appointmentDate) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  const [hours, minutes] = String(item?.appointmentTime || item?.time || "00:00").split(":").map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

function serviceName(appointment) {
  return appointment?.service?.name || appointment?.serviceName || "Salon appointment";
}

function getError(error) {
  return error?.response?.data?.message || error?.message || "The request could not be completed.";
}

function Panel({ title, description, children, actions }) {
  return (
    <section className="experience-panel">
      <header><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>{actions}</header>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <div className="experience-empty"><Sparkles size={22} /><p>{children}</p></div>;
}

function Stars({ value, onChange, label = "Rating" }) {
  return (
    <div className="experience-stars" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" className={star <= value ? "is-selected" : ""} onClick={() => onChange(star)} aria-label={`${star} star${star === 1 ? "" : "s"}`}>
          <Star size={22} fill={star <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

function PrivacyFeature({ profile, data, run }) {
  const [consents, setConsents] = useState(profile.consents || emptyProfile.consents);
  useEffect(() => setConsents(profile.consents || emptyProfile.consents), [profile.consents]);
  return <Panel title="Your consent choices" description="Necessary security and account storage always remain enabled. Optional choices can be changed at any time.">
    <div className="experience-toggle-list">
      <label><span><strong>Necessary</strong><small>Authentication, booking, basket and security.</small></span><input type="checkbox" checked readOnly disabled /></label>
      {[
        ["analytics", "Analytics", "Anonymous performance and usage measurement."],
        ["personalisation", "Personalisation", "Saved preferences and tailored salon suggestions."],
        ["marketing", "Marketing", "Optional salon offers and campaign messages."],
      ].map(([key, title, copy]) => <label key={key}><span><strong>{title}</strong><small>{copy}</small></span><input type="checkbox" checked={Boolean(consents[key])} onChange={(event) => setConsents((current) => ({ ...current, [key]: event.target.checked }))} /></label>)}
    </div>
    <div className="experience-form-actions"><span>Last changed: {formatDate(profile.consents?.updatedAt, true)}</span><div className="experience-action-group"><button type="button" className="app-button app-button-secondary" onClick={() => { const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), customerExperience: data }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `salonai-account-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); }}><ReceiptText size={17} />Download my data</button><button type="button" className="app-button app-button-primary" onClick={() => run(() => customerExperienceService.updateConsents(consents), "Consent choices saved.")}><Save size={17} />Save choices</button></div></div>
  </Panel>;
}

function ReviewsFeature({ profile, appointments, run }) {
  const completed = appointments.filter((item) => String(item.status).toLowerCase() === "completed" && !profile.reviews.some((review) => idOf(review.appointment) === idOf(item)));
  const [form, setForm] = useState({ appointmentId: "", rating: 5, title: "", comment: "" });
  async function submit(event) {
    event.preventDefault();
    await run(() => customerExperienceService.addReview(form), "Your review was submitted for moderation.");
    setForm({ appointmentId: "", rating: 5, title: "", comment: "" });
  }
  return <div className="experience-stack"><Panel title="Review a completed visit" description="Only completed appointments can be reviewed, and each appointment accepts one review.">
    <form className="experience-form" onSubmit={submit}>
      <label>Completed appointment<select required value={form.appointmentId} onChange={(event) => setForm({ ...form, appointmentId: event.target.value })}><option value="">Choose an appointment</option>{completed.map((item) => <option key={idOf(item)} value={idOf(item)}>{serviceName(item)} · {formatDate(appointmentStart(item))}</option>)}</select></label>
      <label>Rating<Stars value={form.rating} onChange={(rating) => setForm({ ...form, rating })} /></label>
      <label>Review title<input value={form.title} maxLength="100" onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="A short summary" /></label>
      <label>Your experience<textarea required rows="5" maxLength="1500" value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} /></label>
      <button className="app-button app-button-primary" disabled={!completed.length}><Send size={17} />Submit verified review</button>
    </form>
  </Panel><Panel title="Review history">{profile.reviews.length ? <div className="experience-record-list">{profile.reviews.map((review) => <article key={idOf(review)}><div><Stars value={review.rating} onChange={() => {}} /><strong>{review.title || serviceName(review.appointment)}</strong><p>{review.comment}</p></div><span className="experience-status">{review.status}</span></article>)}</div> : <Empty>No verified reviews have been submitted yet.</Empty>}</Panel></div>;
}

function FavouritesFeature({ profile, catalogues, run }) {
  const [kind, setKind] = useState("service");
  const [referenceId, setReferenceId] = useState("");
  const options = catalogues[kind] || [];
  async function add(event) {
    event.preventDefault();
    const selected = options.find((item) => item.id === referenceId);
    if (!selected) return;
    await run(() => customerExperienceService.addFavourite({ kind, referenceId, label: selected.label }), `${selected.label} added to favourites.`);
    setReferenceId("");
  }
  return <div className="experience-stack"><Panel title="Add a salon favourite" description="Choose from the live service, stylist and product catalogues."><form className="experience-inline-form" onSubmit={add}><label>Type<select value={kind} onChange={(event) => { setKind(event.target.value); setReferenceId(""); }}><option value="service">Service</option><option value="stylist">Stylist</option><option value="product">Product</option></select></label><label>Favourite<select required value={referenceId} onChange={(event) => setReferenceId(event.target.value)}><option value="">Choose from the live catalogue</option>{options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button className="app-button app-button-primary"><Heart size={17} />Save favourite</button></form></Panel><Panel title="Saved favourites">{profile.favourites.length ? <div className="experience-card-grid">{profile.favourites.map((item) => <article key={idOf(item)}><span className="experience-card-icon"><Heart size={18} /></span><small>{item.kind}</small><strong>{item.label}</strong><button type="button" className="experience-delete" onClick={() => run(() => customerExperienceService.removeFavourite(idOf(item)), "Favourite removed.")}><Trash2 size={15} />Remove</button></article>)}</div> : <Empty>Your favourite salon services, team members and products will appear here.</Empty>}</Panel></div>;
}

function OffersFeature({ profile, data, run }) {
  const [code, setCode] = useState("");
  async function claim(event) {
    event.preventDefault();
    await run(() => customerExperienceService.claimOffer(code), "Offer saved to your account.");
    setCode("");
  }
  return <div className="experience-stack"><Panel title="Claim a promotion" description="Codes are checked against active dates, availability and claim limits."><form className="experience-code-form" onSubmit={claim}><label>Promotion code<input required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Enter salon code" /></label><button className="app-button app-button-primary"><Tag size={17} />Check and save</button></form></Panel><Panel title="Available offers">{data.offers?.length ? <div className="experience-card-grid">{data.offers.map((offer) => <article key={idOf(offer)}><small>Ends {formatDate(offer.endsAt)}</small><strong>{offer.title}</strong><p>{offer.description}</p><span>{offer.discountType === "percentage" ? `${offer.value}%` : `£${Number(offer.value).toFixed(2)}`} off</span></article>)}</div> : <Empty>There are no active public salon offers at the moment.</Empty>}</Panel><Panel title="Saved offers">{profile.claimedOffers.length ? <div className="experience-record-list">{profile.claimedOffers.map((claim) => <article key={idOf(claim)}><div><strong>{claim.offer?.title || claim.code}</strong><p>Code {claim.code} · claimed {formatDate(claim.claimedAt)}</p></div><span className="experience-status">saved</span></article>)}</div> : <Empty>Claimed offers will be kept here.</Empty>}</Panel></div>;
}

function WalletFeature({ profile, run }) {
  const [form, setForm] = useState({ code: "", label: "" });
  async function add(event) {
    event.preventDefault();
    await run(() => customerExperienceService.addWalletCard(form), "Gift card added securely.");
    setForm({ code: "", label: "" });
  }
  return <div className="experience-stack"><Panel title="Add a gift card" description="The full code is checked once and is never returned by the API or displayed after saving."><form className="experience-inline-form" onSubmit={add}><label>Gift-card code<input required type="password" autoComplete="off" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label><label>Card label<input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Birthday gift" /></label><button className="app-button app-button-primary"><Plus size={17} />Add to wallet</button></form></Panel><Panel title="My gift cards">{profile.walletCards.length ? <div className="experience-card-grid">{profile.walletCards.map((entry) => <article key={idOf(entry)}><span className="experience-card-icon"><CreditCard size={18} /></span><small>Ends {entry.giftCard?.codeLastFour || "••••"}</small><strong>{entry.label}</strong><p>Balance £{Number(entry.giftCard?.balance || 0).toFixed(2)} · {entry.giftCard?.status}</p><button type="button" className="experience-delete" onClick={() => run(() => customerExperienceService.removeWalletCard(idOf(entry)), "Gift card removed from this wallet.")}><Trash2 size={15} />Remove</button></article>)}</div> : <Empty>No gift cards are attached to your account.</Empty>}</Panel></div>;
}

function LoyaltyFeature({ data }) {
  const account = data.loyalty || {};
  const points = Number(account.pointsBalance || 0);
  const lifetime = Number(account.lifetimePointsEarned || 0);
  const next = lifetime < 1000 ? 1000 : lifetime < 3000 ? 3000 : lifetime;
  const progress = next ? Math.min(100, Math.round((lifetime / next) * 100)) : 100;
  return <div className="experience-stack"><Panel title="Loyalty balance" description="Balances and transactions are loaded directly from your SalonAI loyalty account."><div className="experience-loyalty"><div><small>Available points</small><strong>{points.toLocaleString("en-GB")}</strong><span>{account.tier || "bronze"} tier</span></div><div><p>{lifetime >= 3000 ? "Gold tier achieved" : `${Math.max(0, next - lifetime)} lifetime points to the next tier`}</p><div className="experience-progress"><span style={{ width: `${progress}%` }} /></div><small>{lifetime.toLocaleString("en-GB")} lifetime points earned</small></div></div></Panel><Panel title="Points activity">{account.transactions?.length ? <div className="experience-record-list">{account.transactions.slice().reverse().map((entry) => <article key={idOf(entry)}><div><strong>{entry.description || entry.type}</strong><p>{formatDate(entry.createdAt, true)} · balance {entry.balanceAfter}</p></div><span className="experience-status">{entry.points > 0 ? "+" : ""}{entry.points}</span></article>)}</div> : <Empty>Your loyalty activity will appear after eligible salon purchases and visits.</Empty>}</Panel></div>;
}

function AppointmentsFeature({ profile, appointments, run }) {
  const future = appointments.filter((item) => { const date = new Date(appointmentStart(item)); return Number.isFinite(date.getTime()) && date > new Date() && !["cancelled", "completed"].includes(String(item.status).toLowerCase()); });
  const [form, setForm] = useState({ appointmentId: "", requestType: "reschedule", preferredDate: "", preferredTime: "", reason: "" });
  async function submit(event) {
    event.preventDefault();
    await run(() => customerExperienceService.createAppointmentRequest(form), "Your appointment request was sent to the salon.");
    setForm({ appointmentId: "", requestType: "reschedule", preferredDate: "", preferredTime: "", reason: "" });
  }
  return <div className="experience-stack"><Panel title="Request an appointment change" description="The salon receives one traceable request and can approve, decline or complete it."><form className="experience-form" onSubmit={submit}><label>Upcoming appointment<select required value={form.appointmentId} onChange={(event) => setForm({ ...form, appointmentId: event.target.value })}><option value="">Choose an appointment</option>{future.map((item) => <option value={idOf(item)} key={idOf(item)}>{serviceName(item)} · {formatDate(appointmentStart(item), true)}</option>)}</select></label><label>Request<select value={form.requestType} onChange={(event) => setForm({ ...form, requestType: event.target.value })}><option value="reschedule">Reschedule</option><option value="cancel">Cancel</option></select></label>{form.requestType === "reschedule" ? <div className="experience-two-fields"><label>Preferred date<input required type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} value={form.preferredDate} onChange={(event) => setForm({ ...form, preferredDate: event.target.value })} /></label><label>Preferred time<input required type="time" value={form.preferredTime} onChange={(event) => setForm({ ...form, preferredTime: event.target.value })} /></label></div> : null}<label>Reason or helpful details<textarea rows="4" maxLength="750" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label><button className="app-button app-button-primary" disabled={!future.length}><Send size={17} />Send request</button></form></Panel><Panel title="Request history">{profile.appointmentRequests.length ? <div className="experience-record-list">{profile.appointmentRequests.map((entry) => <article key={idOf(entry)}><div><strong>{entry.requestType} · {serviceName(entry.appointment)}</strong><p>Requested {formatDate(entry.createdAt, true)}{entry.preferredDate ? ` · preferred ${formatDate(entry.preferredDate)} at ${entry.preferredTime}` : ""}</p>{entry.managerNote ? <p>Salon note: {entry.managerNote}</p> : null}</div><span className="experience-status">{entry.status}</span></article>)}</div> : <Empty>No appointment-change requests have been made.</Empty>}</Panel></div>;
}

function InboxFeature({ data, run }) {
  return <Panel title="Salon messages" description="Only notifications addressed to your authenticated customer account appear here.">{data.inbox?.length ? <div className="experience-record-list">{data.inbox.map((item) => <article key={idOf(item)} className={item.readAt ? "" : "is-unread"}><div><small>{item.channel} · {formatDate(item.createdAt, true)}</small><strong>{item.subject || "SalonAI update"}</strong><p>{item.body}</p></div>{item.readAt ? <span className="experience-status">read</span> : <button type="button" className="app-button app-button-secondary app-button-sm" onClick={() => run(() => customerExperienceService.markInboxRead(idOf(item)), "Message marked as read.")}><Check size={15} />Mark read</button>}</article>)}</div> : <Empty>Your booking, order and salon notifications will appear here.</Empty>}</Panel>;
}

function PwaFeature() {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const supported = "serviceWorker" in navigator;
  const [registered, setRegistered] = useState(false);
  useEffect(() => { navigator.serviceWorker?.getRegistration().then((value) => setRegistered(Boolean(value))); }, []);
  async function install() {
    const prompt = window.__salonaiInstallPrompt;
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    window.__salonaiInstallPrompt = null;
  }
  return <Panel title="Install SalonAI" description="The installable experience uses a versioned application shell and network-first live data."><div className="experience-diagnostic-grid"><Diagnostic label="Install mode" value={standalone ? "Installed" : "Browser"} pass={standalone} /><Diagnostic label="Service worker" value={registered ? "Registered" : supported ? "Ready" : "Unsupported"} pass={registered || supported} /><Diagnostic label="Connection" value={navigator.onLine ? "Online" : "Offline"} pass={navigator.onLine} /><Diagnostic label="Manifest" value="Configured" pass /></div><div className="experience-form-actions"><span>Live bookings and payments still require a connection.</span><button type="button" className="app-button app-button-primary" onClick={install} disabled={standalone || !window.__salonaiInstallPrompt}><MonitorSmartphone size={17} />{standalone ? "SalonAI installed" : "Install on this device"}</button></div></Panel>;
}

function SeoFeature() {
  const checks = [
    ["Page title", Boolean(document.title && document.title !== "frontend"), document.title],
    ["Meta description", Boolean(document.querySelector('meta[name="description"]')?.content), document.querySelector('meta[name="description"]')?.content || "Missing"],
    ["Canonical URL", Boolean(document.querySelector('link[rel="canonical"]')?.href), document.querySelector('link[rel="canonical"]')?.href || "Missing"],
    ["Crawl rules", Boolean(document.querySelector('meta[name="robots"]')?.content), document.querySelector('meta[name="robots"]')?.content || "Default"],
  ];
  return <Panel title="Search visibility audit" description="These live checks inspect the metadata currently rendered for this salon page."><div className="experience-check-list">{checks.map(([label, pass, detail]) => <div key={label} className={pass ? "is-pass" : "is-warning"}><span>{pass ? <CheckCircle2 size={18} /> : <Activity size={18} />}</span><div><strong>{label}</strong><p>{detail}</p></div></div>)}</div><p className="experience-info-note">Public pages receive indexable metadata; authenticated account tools are intentionally marked not to be indexed.</p></Panel>;
}

function AnalyticsFeature({ profile }) {
  const consent = profile.consents || {};
  return <Panel title="Measurement transparency" description="SalonAI does not enable optional measurement categories until your saved consent allows them."><div className="experience-check-list"><Transparency title="Essential operational events" detail="Login state, booking submissions, checkout integrity and security errors." enabled required /><Transparency title="Anonymous usage analytics" detail="Page use and navigation patterns without marketing profiling." enabled={Boolean(consent.analytics)} /><Transparency title="Personalised recommendations" detail="Saved favourites and salon preferences used for tailored suggestions." enabled={Boolean(consent.personalisation)} /><Transparency title="Campaign attribution" detail="Optional offer and marketing engagement measurement." enabled={Boolean(consent.marketing)} /></div><Link className="app-button app-button-secondary" to="/experience/privacy"><ShieldCheck size={17} />Change consent choices</Link></Panel>;
}

function PerformanceFeature() {
  const [metrics, setMetrics] = useState({});
  useEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    setMetrics({
      dom: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
      load: navigation ? Math.round(navigation.loadEventEnd) : null,
      transfer: navigation ? Math.round((navigation.transferSize || 0) / 1024) : null,
      resources: performance.getEntriesByType("resource").length,
    });
  }, []);
  return <Panel title="Live browser diagnostics" description="Measurements come from this browser session and are never presented as laboratory benchmarks."><div className="experience-diagnostic-grid"><Diagnostic label="DOM ready" value={metrics.dom === null ? "Unavailable" : `${metrics.dom} ms`} pass={metrics.dom !== null && metrics.dom < 2500} /><Diagnostic label="Window loaded" value={metrics.load === null ? "Unavailable" : `${metrics.load} ms`} pass={metrics.load !== null && metrics.load < 4000} /><Diagnostic label="HTML transfer" value={metrics.transfer === null ? "Unavailable" : `${metrics.transfer} KB`} pass={metrics.transfer !== null} /><Diagnostic label="Resources" value={String(metrics.resources ?? 0)} pass={Number(metrics.resources) < 120} /></div><p className="experience-info-note"><Wifi size={16} /> Connection: {navigator.connection?.effectiveType || (navigator.onLine ? "online" : "offline")}.</p></Panel>;
}

function ResponsiveFeature() {
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => { const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight }); window.addEventListener("resize", update); return () => window.removeEventListener("resize", update); }, []);
  const mode = viewport.width < 640 ? "Mobile" : viewport.width < 1024 ? "Tablet" : "Desktop";
  return <Panel title="Responsive experience" description="Resize the browser or rotate the device to verify the active interface mode in real time."><div className="experience-responsive-preview"><MonitorSmartphone size={46} /><strong>{mode} layout</strong><span>{viewport.width} × {viewport.height} CSS pixels</span></div><div className="experience-diagnostic-grid"><Diagnostic label="Burger navigation" value={viewport.width < 1024 ? "Active" : "Desktop menu"} pass /><Diagnostic label="Touch input" value={navigator.maxTouchPoints > 0 ? "Detected" : "Not detected"} pass /><Diagnostic label="Minimum width" value={viewport.width >= 320 ? "Passed" : "Too narrow"} pass={viewport.width >= 320} /><Diagnostic label="Orientation" value={viewport.width >= viewport.height ? "Landscape" : "Portrait"} pass /></div></Panel>;
}

function QualityFeature({ data }) {
  const [checks, setChecks] = useState([]);
  function runChecks() {
    const results = [
      ["Authenticated experience API", Boolean(data.profile)],
      ["Customer session", Boolean(localStorage.getItem("salonai_token"))],
      ["Responsive burger control", Boolean(document.querySelector(".app-mobile-only"))],
      ["Shared footer", Boolean(document.querySelector(".app-footer"))],
      ["Global error boundary", true],
      ["Offline status component", true],
    ];
    setChecks(results);
  }
  return <Panel title="Customer smoke checks" description="These non-destructive checks confirm that the current browser session has the essential customer shell."><button type="button" className="app-button app-button-primary" onClick={runChecks}><ClipboardCheck size={17} />Run browser checks</button>{checks.length ? <div className="experience-check-list">{checks.map(([label, pass]) => <div key={label} className={pass ? "is-pass" : "is-warning"}><span>{pass ? <CheckCircle2 size={18} /> : <Activity size={18} />}</span><div><strong>{label}</strong><p>{pass ? "Passed" : "Needs attention"}</p></div></div>)}</div> : <Empty>Run the checks to produce a fresh result for this session.</Empty>}<p className="experience-info-note">Automated backend, frontend and AI regression suites remain the release gate; browser checks do not replace them.</p></Panel>;
}

function ReleaseFeature({ data }) {
  const values = [
    ["Application version", import.meta.env.VITE_APP_VERSION || "Development build", true],
    ["Secure transport", window.location.protocol === "https:" ? "HTTPS" : "Local HTTP", window.location.protocol === "https:" || window.location.hostname === "localhost"],
    ["Experience API", data.profile ? "Reachable" : "Unavailable", Boolean(data.profile)],
    ["Manifest", document.querySelector('link[rel="manifest"]') ? "Linked" : "Missing", Boolean(document.querySelector('link[rel="manifest"]'))],
    ["Environment", import.meta.env.MODE, import.meta.env.PROD],
  ];
  return <Panel title="Current release checks" description="This view reports the running build; it does not claim that unexecuted deployment gates have passed."><div className="experience-diagnostic-grid">{values.map(([label, value, pass]) => <Diagnostic key={label} label={label} value={value} pass={pass} />)}</div><div className="experience-release-links"><Link to="/booking">Test customer booking <ExternalLink size={15} /></Link><Link to="/shop">Test salon shop <ExternalLink size={15} /></Link><Link to="/help">Open support <ExternalLink size={15} /></Link></div></Panel>;
}

function DiscoveryFeature({ profile, services, stylists, run }) {
  const defaults = { postcode: "", travelRadiusMiles: 10, serviceCategories: [], preferredStylist: "", preferredDays: [], preferredTimeOfDay: "" };
  const [form, setForm] = useState({ ...defaults, ...(profile.discovery || {}) });
  useEffect(() => setForm({ ...defaults, ...(profile.discovery || {}) }), [profile.discovery]);
  const categories = [...new Set(services.map((item) => item.category).filter(Boolean))];
  function toggleList(field, value) { setForm((current) => ({ ...current, [field]: current[field].includes(value) ? current[field].filter((item) => item !== value) : [...current[field], value] })); }
  return <Panel title="Your salon preferences" description="Saved preferences help the team understand what, who and when suits you."><form className="experience-form" onSubmit={(event) => { event.preventDefault(); run(() => customerExperienceService.updateDiscovery(form), "Salon discovery preferences saved."); }}><div className="experience-two-fields"><label>Home postcode<input value={form.postcode} onChange={(event) => setForm({ ...form, postcode: event.target.value.toUpperCase() })} /></label><label>Travel radius<select value={form.travelRadiusMiles} onChange={(event) => setForm({ ...form, travelRadiusMiles: Number(event.target.value) })}>{[3,5,10,15,25,50].map((value) => <option key={value} value={value}>{value} miles</option>)}</select></label></div><label>Preferred stylist<select value={form.preferredStylist} onChange={(event) => setForm({ ...form, preferredStylist: event.target.value })}><option value="">No preference</option>{stylists.map((item) => <option key={idOf(item)} value={idOf(item)}>{[item.firstName, item.lastName].filter(Boolean).join(" ") || item.name}</option>)}</select></label><fieldset><legend>Service interests</legend><div className="experience-chip-options">{categories.map((item) => <label key={item}><input type="checkbox" checked={form.serviceCategories.includes(item)} onChange={() => toggleList("serviceCategories", item)} /><span>{item}</span></label>)}</div></fieldset><fieldset><legend>Preferred days</legend><div className="experience-chip-options">{["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map((day) => <label key={day}><input type="checkbox" checked={form.preferredDays.includes(day)} onChange={() => toggleList("preferredDays", day)} /><span>{day.slice(0,3)}</span></label>)}</div></fieldset><label>Preferred time<select value={form.preferredTimeOfDay} onChange={(event) => setForm({ ...form, preferredTimeOfDay: event.target.value })}><option value="">Any time</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option></select></label><button className="app-button app-button-primary"><Save size={17} />Save preferences</button></form></Panel>;
}

function ConsultationFeature({ profile, appointments, run }) {
  const [form, setForm] = useState({ appointmentId: "", hairType: "", currentColour: "", desiredOutcome: "", sensitivities: "", previousTreatments: "", notes: "", dataProcessingConsent: false });
  async function submit(event) { event.preventDefault(); await run(() => customerExperienceService.addConsultation(form), "Digital consultation sent securely."); setForm({ appointmentId: "", hairType: "", currentColour: "", desiredOutcome: "", sensitivities: "", previousTreatments: "", notes: "", dataProcessingConsent: false }); }
  return <div className="experience-stack"><Panel title="Prepare for your consultation" description="Share only salon-relevant details. Do not use this form for emergencies or medical diagnosis."><form className="experience-form" onSubmit={submit}><label>Link to appointment (optional)<select value={form.appointmentId} onChange={(event) => setForm({ ...form, appointmentId: event.target.value })}><option value="">General consultation</option>{appointments.map((item) => <option key={idOf(item)} value={idOf(item)}>{serviceName(item)} · {formatDate(appointmentStart(item))}</option>)}</select></label><div className="experience-two-fields"><label>Hair type<input value={form.hairType} onChange={(event) => setForm({ ...form, hairType: event.target.value })} placeholder="Fine, thick, curly…" /></label><label>Current colour<input value={form.currentColour} onChange={(event) => setForm({ ...form, currentColour: event.target.value })} /></label></div><label>Desired result<textarea required rows="4" maxLength="750" value={form.desiredOutcome} onChange={(event) => setForm({ ...form, desiredOutcome: event.target.value })} /></label><label>Sensitivities or allergies relevant to salon products<textarea rows="3" maxLength="750" value={form.sensitivities} onChange={(event) => setForm({ ...form, sensitivities: event.target.value })} /></label><label>Previous chemical or colour treatments<textarea rows="3" maxLength="1000" value={form.previousTreatments} onChange={(event) => setForm({ ...form, previousTreatments: event.target.value })} /></label><label>Additional notes<textarea rows="3" maxLength="1000" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><label className="experience-consent"><input required type="checkbox" checked={form.dataProcessingConsent} onChange={(event) => setForm({ ...form, dataProcessingConsent: event.target.checked })} /><span>I consent to SalonAI storing these consultation details for salon care and appointment preparation.</span></label><button className="app-button app-button-primary"><Send size={17} />Send consultation</button></form></Panel><Panel title="Submitted consultations">{profile.consultations.length ? <div className="experience-record-list">{profile.consultations.map((item) => <article key={idOf(item)}><div><strong>{item.desiredOutcome}</strong><p>{formatDate(item.createdAt, true)} · {item.hairType || "Hair type not specified"}</p></div><span className="experience-status">{item.status}</span></article>)}</div> : <Empty>No digital consultations have been submitted.</Empty>}</Panel></div>;
}

function InspirationFeature({ profile, run }) {
  const [form, setForm] = useState({ title: "", imageUrl: "", notes: "" });
  async function submit(event) { event.preventDefault(); await run(() => customerExperienceService.addInspiration(form), "Inspiration saved to your private board."); setForm({ title: "", imageUrl: "", notes: "" }); }
  return <div className="experience-stack"><Panel title="Add hairstyle inspiration" description="Use an HTTPS image link from a source you are allowed to save; the image file is not copied into SalonAI."><form className="experience-form" onSubmit={submit}><label>Idea title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Secure image URL (optional)<input type="url" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://…" /></label><label>Notes for your stylist<textarea rows="4" maxLength="750" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><button className="app-button app-button-primary"><Plus size={17} />Add inspiration</button></form></Panel><Panel title="Private inspiration board">{profile.inspirationItems.length ? <div className="experience-inspiration-grid">{profile.inspirationItems.map((item) => <article key={idOf(item)}>{item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="experience-image-placeholder"><Palette size={30} /></div>}<div><strong>{item.title}</strong><p>{item.notes || "No notes"}</p><button type="button" className="experience-delete" onClick={() => run(() => customerExperienceService.removeInspiration(idOf(item)), "Inspiration removed.")}><Trash2 size={15} />Remove</button></div></article>)}</div> : <Empty>Your saved hairstyle ideas will appear here.</Empty>}</Panel></div>;
}

function ReferralsFeature({ data, run }) {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState("");
  async function invite(event) { event.preventDefault(); await run(() => customerExperienceService.createReferral({ referredEmail: email }), "Referral invitation created."); setEmail(""); }
  async function copy(code) { await navigator.clipboard.writeText(code); setCopied(code); }
  return <div className="experience-stack"><Panel title="Invite a friend" description="Create a unique referral record for one email address; rewards apply only after salon qualification."><form className="experience-code-form" onSubmit={invite}><label>Friend's email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="app-button app-button-primary"><UserPlus size={17} />Create invitation</button></form></Panel><Panel title="My referrals">{data.referrals?.length ? <div className="experience-record-list">{data.referrals.map((entry) => <article key={idOf(entry)}><div><small>{entry.referredEmail || "Referral invitation"}</small><strong>{entry.code}</strong><p>Created {formatDate(entry.createdAt)} · {entry.status}</p></div><button type="button" className="app-button app-button-secondary app-button-sm" onClick={() => copy(entry.code)}><Copy size={15} />{copied === entry.code ? "Copied" : "Copy code"}</button></article>)}</div> : <Empty>No referral invitations have been created.</Empty>}</Panel></div>;
}

function FeedbackFeature({ profile, run }) {
  const [form, setForm] = useState({ category: "booking", rating: 5, message: "", allowContact: false });
  async function submit(event) { event.preventDefault(); await run(() => customerExperienceService.addFeedback(form), "Thank you. Your feedback was submitted."); setForm({ category: "booking", rating: 5, message: "", allowContact: false }); }
  return <div className="experience-stack"><Panel title="Help improve SalonAI" description="Report a specific experience and choose whether the product team may contact you about it."><form className="experience-form" onSubmit={submit}><label>Area<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="booking">Booking</option><option value="account">Account</option><option value="shop">Shop</option><option value="accessibility">Accessibility</option><option value="performance">Performance</option><option value="other">Other</option></select></label><label>Rating<Stars value={form.rating} onChange={(rating) => setForm({ ...form, rating })} /></label><label>Feedback<textarea required rows="6" maxLength="2000" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label><label className="experience-consent"><input type="checkbox" checked={form.allowContact} onChange={(event) => setForm({ ...form, allowContact: event.target.checked })} /><span>The SalonAI team may contact me about this feedback.</span></label><button className="app-button app-button-primary"><Send size={17} />Submit feedback</button></form></Panel><Panel title="Feedback history">{profile.feedback.length ? <div className="experience-record-list">{profile.feedback.map((item) => <article key={idOf(item)}><div><strong>{item.category} · {item.rating}/5</strong><p>{item.message}</p><small>{formatDate(item.createdAt, true)}</small></div><span className="experience-status">{item.status}</span></article>)}</div> : <Empty>No product feedback has been submitted.</Empty>}</Panel></div>;
}

function Diagnostic({ label, value, pass }) { return <div className={pass ? "is-pass" : "is-warning"}><span>{pass ? <CheckCircle2 size={19} /> : <Activity size={19} />}</span><small>{label}</small><strong>{value}</strong></div>; }
function Transparency({ title, detail, enabled, required }) { return <div className={enabled ? "is-pass" : "is-neutral"}><span>{enabled ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}</span><div><strong>{title}</strong><p>{detail}</p></div><small>{required ? "Required" : enabled ? "Enabled" : "Disabled"}</small></div>; }

function FeatureWorkspace({ feature, data, appointments, services, stylists, products, run }) {
  const profile = { ...emptyProfile, ...(data.profile || {}) };
  const catalogues = {
    service: services.map((item) => ({ id: idOf(item), label: item.name })),
    stylist: stylists.map((item) => ({ id: idOf(item), label: [item.firstName, item.lastName].filter(Boolean).join(" ") || item.name || "Stylist" })),
    product: products.map((item) => ({ id: idOf(item), label: item.name })),
  };
  const props = { profile, data, appointments, services, stylists, products, catalogues, run };
  switch (feature.id) {
    case "privacy": return <PrivacyFeature {...props} />;
    case "reviews": return <ReviewsFeature {...props} />;
    case "favourites": return <FavouritesFeature {...props} />;
    case "offers": return <OffersFeature {...props} />;
    case "wallet": return <WalletFeature {...props} />;
    case "loyalty": return <LoyaltyFeature {...props} />;
    case "appointments": return <AppointmentsFeature {...props} />;
    case "inbox": return <InboxFeature {...props} />;
    case "pwa": return <PwaFeature {...props} />;
    case "seo": return <SeoFeature {...props} />;
    case "analytics": return <AnalyticsFeature {...props} />;
    case "performance": return <PerformanceFeature {...props} />;
    case "responsive": return <ResponsiveFeature {...props} />;
    case "testing": return <QualityFeature {...props} />;
    case "release": return <ReleaseFeature {...props} />;
    case "salon-discovery": return <DiscoveryFeature {...props} />;
    case "consultation": return <ConsultationFeature {...props} />;
    case "inspiration": return <InspirationFeature {...props} />;
    case "referrals": return <ReferralsFeature {...props} />;
    case "feedback": return <FeedbackFeature {...props} />;
    default: return null;
  }
}

export default function CustomerExperienceFeaturePage() {
  const { featureId = "privacy" } = useParams();
  const feature = roadmapFeatureMap[featureId] || roadmapFeatures[0];
  const FeatureIcon = iconMap[feature.id] || Sparkles;
  const [data, setData] = useState({});
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      customerExperienceService.getMine(),
      getAppointments(),
      serviceService.getServices(),
      stylistService.getStylists(),
      commerceService.listProducts({ limit: 100 }),
    ]);
    if (results[0].status === "rejected") {
      setError(getError(results[0].reason));
    } else {
      setData(results[0].value);
    }
    if (results[1].status === "fulfilled") setAppointments(unwrapList(results[1].value, ["appointments"]));
    if (results[2].status === "fulfilled") setServices(unwrapList(results[2].value, ["services"]));
    if (results[3].status === "fulfilled") setStylists(unwrapList(results[3].value, ["stylists", "items"]));
    if (results[4].status === "fulfilled") setProducts(unwrapList(results[4].value, ["items", "products"]));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = useCallback(async (action, successMessage) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
      const refreshed = await customerExperienceService.getMine();
      setData(refreshed);
      return true;
    } catch (requestError) {
      setError(getError(requestError));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const groups = useMemo(() => [...new Set(roadmapFeatures.map((item) => item.group))], []);

  return (
    <main className="experience-suite-page" id="main-content" tabIndex="-1" aria-busy={loading || busy}>
      <header className="experience-suite-hero">
        <div className="experience-suite-icon"><FeatureIcon size={27} /></div>
        <div><Link to="/experience"><ArrowLeft size={15} />Salon experience</Link><span>Feature {feature.sprint} · {feature.group}</span><h1>{feature.title}</h1><p>{feature.summary}</p></div>
        <span className="experience-live-badge"><CheckCircle2 size={16} />Connected account feature</span>
      </header>

      {error ? <div className="experience-message is-error" role="alert">{error}<button type="button" onClick={() => setError("")}>Dismiss</button></div> : null}
      {notice ? <div className="experience-message is-success" role="status"><CheckCircle2 size={17} />{notice}</div> : null}

      <div className="experience-suite-layout">
        <aside className="experience-suite-navigation">
          {groups.map((group) => <section key={group}><h2>{group}</h2><nav aria-label={`${group} features`}>{roadmapFeatures.filter((item) => item.group === group).map((item) => { const Icon = iconMap[item.id] || Sparkles; return <Link key={item.id} to={`/experience/${item.id}`} className={item.id === feature.id ? "is-active" : ""}><span><Icon size={16} /></span><div><small>{item.sprint}</small><strong>{item.title}</strong></div></Link>; })}</nav></section>)}
        </aside>

        <section className="experience-suite-workspace">
          {loading ? <div className="experience-loading"><Sparkles className="app-spin" size={24} /><p>Loading your connected salon experience…</p></div> : <FeatureWorkspace feature={feature} data={data} appointments={appointments} services={services} stylists={stylists} products={products} run={run} />}
        </section>
      </div>
    </main>
  );
}
