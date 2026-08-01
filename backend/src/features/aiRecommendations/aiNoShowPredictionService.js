import Appointment from "../../models/Appointment.js";
import { predictNoShowRisk } from "../../services/aiMicroserviceClient.js";

const asId = (v) => !v ? null : typeof v === "string" ? v : String(v._id || v.id || v);
const asNumber = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
const status = (x) => String(x.status || x.appointmentStatus || "").trim().toLowerCase();
const when = (x) => x.appointmentDate || x.date || x.scheduledAt || x.startTime || x.createdAt;
const value = (x) => Math.max(0, asNumber(x.totalPrice ?? x.total ?? x.amount ?? x.price ?? x.service?.price));

function historyIndex(rows) {
  const map = new Map();
  for (const row of rows) {
    const customer = asId(row.customer || row.user || row.client);
    if (!customer) continue;
    if (!map.has(customer)) map.set(customer, { bookings: 0, completed: 0, noShows: 0, cancellations: 0, lastVisit: null });
    const target = map.get(customer); target.bookings += 1;
    const state = status(row); const date = when(row) ? new Date(when(row)) : null;
    if (state === "completed") { target.completed += 1; if (date && !Number.isNaN(date) && (!target.lastVisit || date > target.lastVisit)) target.lastVisit = date; }
    if (["no-show", "no_show", "noshow"].includes(state)) target.noShows += 1;
    if (["cancelled", "canceled"].includes(state)) target.cancellations += 1;
  }
  return map;
}

export async function buildNoShowPredictionPayload(options = {}) {
  const asOf = new Date(options.asOfDate || new Date()); asOf.setHours(0,0,0,0);
  const horizon = new Date(asOf); horizon.setDate(horizon.getDate() + Math.max(1, asNumber(options.horizonDays, 14))); horizon.setHours(23,59,59,999);
  const rows = await Appointment.find({ $or: [{ appointmentDate: { $lte: horizon } }, { date: { $lte: horizon } }, { scheduledAt: { $lte: horizon } }] }).lean().exec();
  const history = historyIndex(rows);
  const inactive = new Set(["completed","cancelled","canceled","no-show","no_show","noshow"]);
  const future = rows.filter((row) => { const d = when(row) ? new Date(when(row)) : null; return d && d >= asOf && !inactive.has(status(row)); });
  return {
    as_of_date: asOf.toISOString().slice(0,10),
    appointments: future.map((row) => {
      const customer = asId(row.customer || row.user || row.client) || "unknown";
      const h = history.get(customer) || { bookings:0,completed:0,noShows:0,cancellations:0,lastVisit:null };
      const scheduled = new Date(when(row)); const created = row.createdAt ? new Date(row.createdAt) : asOf;
      return {
        appointment_key: asId(row) || `${customer}-${scheduled.toISOString()}`, customer_key: customer,
        appointment_date: scheduled.toISOString(), created_at: created.toISOString(), service_name: row.service?.name || row.serviceName || null,
        appointment_value: value(row), lead_time_days: Math.max(0,(scheduled-created)/86400000), previous_bookings:h.bookings,
        previous_completed:h.completed, previous_no_shows:h.noShows, previous_cancellations:h.cancellations,
        days_since_last_visit:h.lastVisit ? Math.max(0,Math.round((asOf-h.lastVisit)/86400000)) : null,
        reschedule_count:Math.max(0,asNumber(row.rescheduleCount)),
        reminder_status: row.confirmedAt || row.customerConfirmed ? "confirmed" : row.reminderSentAt || row.reminderStatus === "sent" ? "sent" : row.reminderScheduledAt ? "scheduled" : "none",
        deposit_status: row.depositPaid || asNumber(row.depositAmountPaid)>0 ? "paid" : row.depositRequested || asNumber(row.depositAmount)>0 ? "requested" : "none",
        is_new_customer:h.bookings<=1, is_weekend:[0,6].includes(scheduled.getDay()), is_evening:scheduled.getHours()>=17,
      };
    }),
    settings:{ high_risk_threshold:asNumber(options.highRiskThreshold,.65), medium_risk_threshold:asNumber(options.mediumRiskThreshold,.35), include_recommendations:options.includeRecommendations !== false }
  };
}

export async function generateNoShowPredictions(options = {}) {
  const payload = await buildNoShowPredictionPayload(options);
  if (!payload.appointments.length) return { prediction:{ generated_at:new Date().toISOString(),as_of_date:payload.as_of_date,summary:{total_appointments:0,high_risk_count:0,medium_risk_count:0,low_risk_count:0,expected_no_shows:0,revenue_at_risk:0,average_probability:0,recommended_actions:[]},predictions:[],metadata:{model_name:"salonai-no-show-risk-rules-v1",provider_mode:"local-empty",rules_applied:[]}},source:{appointmentRecords:0,aggregateOnly:false} };
  return { prediction: await predictNoShowRisk(payload,{requestId:options.requestId}), source:{appointmentRecords:payload.appointments.length,asOfDate:payload.as_of_date,aggregateOnly:false} };
}
export default { buildNoShowPredictionPayload, generateNoShowPredictions };
