import express from "express";

import templateRoutes from "./templates/templateRoutes.js";
import segmentRoutes from "./segments/segmentRoutes.js";
import campaignRoutes from "./campaigns/campaignRoutes.js";
import schedulerRoutes from "./scheduler/schedulerRoutes.js";
import customerProfileRoutes from "./customerProfiles/futureCustomerProfileRoutes.js";
import retentionActionRoutes from "./customerProfiles/retentionActionRoutes.js";
import appointmentManagementRoutes from "./appointments/appointmentManagementRoutes.js";
import calendarConnectionRoutes from "../integrations/calendar/calendarConnectionRoutes.js";
import waitlistRoutes from "./waitlist/waitlistRoutes.js";
import aiRoutes from "./ai/aiRoutes.js";
import reportRoutes from "./reports/reportRoutes.js";
import revenueForecastRoutes from "./revenueForecasting/revenueForecastRoutes.js";
import loyaltyRoutes from "./loyalty/loyaltyRoutes.js";
import staffRoutes from "./staff/staffRoutes.js";
import staffRotaRoutes from "./staffRota/staffRotaRoutes.js";
import securityRoutes from "./security/securityRoutes.js";

import staffPerformanceRoutes from "./staffPerformance/staffPerformanceRoutes.js";
import servicePerformanceRoutes from "./servicePerformance/servicePerformanceRoutes.js";
import customerValueRoutes from "./customerValue/customerValueRoutes.js";
import bookingDemandRoutes from "./bookingDemand/bookingDemandRoutes.js";
import bookingLossRoutes from "./bookingLoss/bookingLossRoutes.js";
import rebookingOpportunityRoutes from "./rebookingOpportunities/rebookingOpportunityRoutes.js";

import rebookingCampaignRoutes from "./rebookingCampaigns/rebookingCampaignRoutes.js";
import marketingAttributionRoutes from "./marketingAttribution/marketingAttributionRoutes.js";
import smartAppointmentRoutes from "./smartAppointments/smartAppointmentRoutes.js";
import capacityPlanningRoutes from "./capacityPlanning/capacityPlanningRoutes.js";
import dynamicPricingRoutes from "./dynamicPricing/dynamicPricingRoutes.js";
import inventoryRoutes from "./inventory/inventoryRoutes.js";
import feedbackAnalyticsRoutes from "./feedbackAnalytics/feedbackAnalyticsRoutes.js";
import managementCopilotRoutes from "./managementCopilot/managementCopilotRoutes.js";
import executiveCommandRoutes from "./executiveCommand/executiveCommandRoutes.js";
import dataExportAuditRoutes from "./dataExportAudit/dataExportAuditRoutes.js";

import {
  managementOnly,
  protect,
} from "../middleware/authMiddleware.js";
import { auditFutureWrites } from "./security/writeAudit.js";
import { requireFeature } from "../services/featureControlService.js";

const router = express.Router();

router.use(protect);
router.use(auditFutureWrites);

/*
 * Custom staff roles must not inherit blanket access to legacy future-feature
 * routers. Only routers that enforce granular permissions on every operation
 * are mounted before the legacy built-in-role gate.
 */
router.use(
  "/appointment-management",
  appointmentManagementRoutes
);
router.use(
  "/staff",
  staffRoutes
);

router.use(managementOnly);

router.use("/templates", requireFeature("communications"), templateRoutes);
router.use("/segments", segmentRoutes);
router.use("/campaigns", requireFeature("communications"), campaignRoutes);
router.use("/scheduler", requireFeature("communications"), schedulerRoutes);
router.use("/customer-profiles", customerProfileRoutes);
router.use("/retention-actions", retentionActionRoutes);
router.use("/calendar-connections", calendarConnectionRoutes);
router.use("/waitlist", waitlistRoutes);
router.use("/ai", requireFeature("ai-tools"), aiRoutes);
router.use("/reports", reportRoutes);
router.use("/revenue-forecast", revenueForecastRoutes);
router.use("/loyalty", requireFeature("loyalty"), loyaltyRoutes);
router.use("/staff-rota", staffRotaRoutes);
router.use("/security", securityRoutes);

router.use("/staff-performance", staffPerformanceRoutes);
router.use("/service-performance", servicePerformanceRoutes);
router.use("/customer-value", customerValueRoutes);
router.use("/booking-demand", bookingDemandRoutes);
router.use("/booking-loss", bookingLossRoutes);
router.use("/rebooking-opportunities", rebookingOpportunityRoutes);

router.use("/rebooking-campaigns", requireFeature("communications"), rebookingCampaignRoutes);
router.use("/marketing-attribution", requireFeature("ai-tools"), marketingAttributionRoutes);
router.use("/smart-appointments", requireFeature("ai-tools"), smartAppointmentRoutes);
router.use("/capacity-planning", requireFeature("ai-tools"), capacityPlanningRoutes);
router.use("/dynamic-pricing", requireFeature("ai-tools"), dynamicPricingRoutes);
router.use("/inventory", requireFeature("inventory-purchasing"), inventoryRoutes);
router.use("/feedback-analytics", requireFeature("ai-tools"), feedbackAnalyticsRoutes);
router.use("/management-copilot", requireFeature("ai-tools"), managementCopilotRoutes);
router.use("/executive-command-centre", requireFeature("ai-tools"), executiveCommandRoutes);
router.use("/data-export-audit", dataExportAuditRoutes);

export default router;
