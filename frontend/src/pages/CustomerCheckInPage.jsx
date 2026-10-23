import { CalendarCheck, CheckCircle2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getAppointments } from "../Services/appointmentApi.js";
import customerExperienceService from "../Services/customerExperienceService.js";

function unwrap(value) {
  const payload = value?.data ?? value ?? {};
  return Array.isArray(payload) ? payload : payload.appointments || [];
}

function startOf(item) {
  if (item.startsAt) return new Date(item.startsAt);
  const date = new Date(item.appointmentDate);
  const [hours, minutes] = String(item.appointmentTime || "00:00").split(":").map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

export default function CustomerCheckInPage() {
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    try { setAppointments(unwrap(await getAppointments())); }
    catch (requestError) { setError(requestError.response?.data?.message || "Appointments could not be loaded."); }
  }
  useEffect(() => { void load(); }, []);

  const eligible = useMemo(() => appointments
    .filter((item) => ["pending", "confirmed"].includes(String(item.status || "").toLowerCase()))
    .sort((a,b)=>startOf(a)-startOf(b)), [appointments]);

  async function checkIn(appointment) {
    setBusy(true); setError(""); setNotice("");
    try {
      await customerExperienceService.checkIn(appointment._id || appointment.id);
      setNotice("You are checked in. Reception can now see that you have arrived.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Check-in is not available for this appointment yet.");
    } finally { setBusy(false); }
  }

  return (
    <main className="customer-page" id="main-content" tabIndex="-1">
      <div className="customer-page-container">
        <header className="customer-page-header"><div><p className="customer-eyebrow"><CalendarCheck size={16}/>Arrival</p><h1>Check in for your appointment</h1><p>This customer-signed-in prototype updates the same canonical appointment used by reception. No separate kiosk booking record is created.</p></div><button type="button" className="customer-secondary-link" onClick={load}><RefreshCw size={16}/>Refresh</button></header>
        {error ? <div className="experience-message is-error" role="alert">{error}</div> : null}
        {notice ? <div className="experience-message is-success" role="status"><CheckCircle2 size={17}/>{notice}</div> : null}
        <section className="experience-panel"><h2>Upcoming appointments</h2>{eligible.length ? <div className="experience-record-list">{eligible.map((item)=><article key={item._id||item.id}><div><small>{startOf(item).toLocaleString("en-GB")}</small><strong>{item.service?.name || item.serviceName || "Salon appointment"}</strong><p>{item.stylist?.name || [item.stylist?.firstName,item.stylist?.lastName].filter(Boolean).join(" ") || "Salon team"}</p></div><button type="button" disabled={busy} className="app-button app-button-primary" onClick={()=>checkIn(item)}>Check in</button></article>)}</div>:<p>No pending or confirmed appointments are available for check-in.</p>}</section>
      </div>
    </main>
  );
}
