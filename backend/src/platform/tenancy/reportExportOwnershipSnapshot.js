import Appointment from "../../models/Appointment.js";
import Business from "../../models/Business.js";
import Customer from "../../models/customer.js";
import Location from "../../models/Location.js";
import Service from "../../models/service.js";
import Stylist from "../../models/Stylist.js";
import CustomerContactLog from "../../models/customerContactLog.js";
import Campaign from "../../features/campaigns/Campaign.js";
import RebookingCampaign from "../../features/rebookingCampaigns/RebookingCampaign.js";
import InventoryItem from "../../features/inventory/InventoryItem.js";
import CustomerFeedback from "../../features/feedbackAnalytics/CustomerFeedback.js";
import FutureAuditEvent from "../../features/dataExportAudit/FutureAuditEvent.js";

function withSession(query, session) {
  return session ? query.session(session) : query;
}

export async function loadReportExportOwnershipMigrationSnapshot({ session = null } = {}) {
  const [
    businesses,
    locations,
    customers,
    appointments,
    services,
    stylists,
    customerContactLogs,
    campaigns,
    rebookingCampaigns,
    inventoryItems,
    customerFeedback,
    exportAuditEvents,
  ] = await Promise.all([
    withSession(Business.find({}).sort({ _id: 1 }).select("_id"), session).lean(),
    withSession(
      Location.find({}).sort({ _id: 1 }).select("_id business status"),
      session
    ).lean(),
    withSession(Customer.find({}).sort({ _id: 1 }).select("_id business"), session).lean(),
    withSession(
      Appointment.find({})
        .sort({ _id: 1 })
        .select("_id business location customer service stylist"),
      session
    ).lean(),
    withSession(Service.find({}).sort({ _id: 1 }).select("_id business"), session).lean(),
    withSession(
      Stylist.find({}).sort({ _id: 1 }).select("_id business workingLocations"),
      session
    ).lean(),
    withSession(
      CustomerContactLog.find({})
        .sort({ _id: 1 })
        .select("_id business location customer appointment"),
      session
    ).lean(),
    withSession(
      Campaign.find({}).sort({ _id: 1 }).select("_id business recipients"),
      session
    ).lean(),
    withSession(
      RebookingCampaign.find({})
        .sort({ _id: 1 })
        .select("_id business recipients.customer recipients.service recipients.rebookedAppointment"),
      session
    ).lean(),
    withSession(
      InventoryItem.find({}).sort({ _id: 1 }).select("_id business location"),
      session
    ).lean(),
    withSession(
      CustomerFeedback.find({})
        .sort({ _id: 1 })
        .select("_id business location customer appointment service stylist"),
      session
    ).lean(),
    withSession(
      FutureAuditEvent.find({})
        .sort({ _id: 1 })
        .select("_id business location locationScope"),
      session
    ).lean(),
  ]);

  return Object.freeze({
    businesses: Object.freeze([...businesses]),
    locations: Object.freeze([...locations]),
    customers: Object.freeze([...customers]),
    appointments: Object.freeze([...appointments]),
    services: Object.freeze([...services]),
    stylists: Object.freeze([...stylists]),
    customerContactLogs: Object.freeze([...customerContactLogs]),
    campaigns: Object.freeze([...campaigns]),
    rebookingCampaigns: Object.freeze([...rebookingCampaigns]),
    inventoryItems: Object.freeze([...inventoryItems]),
    customerFeedback: Object.freeze([...customerFeedback]),
    exportAuditEvents: Object.freeze([...exportAuditEvents]),
  });
}

export default {
  loadReportExportOwnershipMigrationSnapshot,
};
