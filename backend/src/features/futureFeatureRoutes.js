import express from "express";

import templateRoutes from "./templates/templateRoutes.js";
import segmentRoutes from "./segments/segmentRoutes.js";
import campaignRoutes from "./campaigns/campaignRoutes.js";
import schedulerRoutes from "./scheduler/schedulerRoutes.js";
import customerProfileRoutes from "./customerProfiles/futureCustomerProfileRoutes.js";
import retentionActionRoutes from "./customerProfiles/retentionActionRoutes.js";
import appointmentManagementRoutes from "./appointments/appointmentManagementRoutes.js";
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

const router = express.Router();

router.use(protect);
router.use(managementOnly);
router.use(auditFutureWrites);

router.use("/templates", templateRoutes);
router.use("/segments", segmentRoutes);
router.use("/campaigns", campaignRoutes);
router.use("/scheduler", schedulerRoutes);
router.use("/customer-profiles", customerProfileRoutes);
router.use("/retention-actions", retentionActionRoutes);
router.use("/appointment-management", appointmentManagementRoutes);
router.use("/waitlist", waitlistRoutes);
router.use("/ai", aiRoutes);
router.use("/reports", reportRoutes);
router.use("/revenue-forecast", revenueForecastRoutes);
router.use("/loyalty", loyaltyRoutes);
router.use("/staff", staffRoutes);
router.use("/staff-rota", staffRotaRoutes);
router.use("/security", securityRoutes);

router.use("/staff-performance", staffPerformanceRoutes);
router.use("/service-performance", servicePerformanceRoutes);
router.use("/customer-value", customerValueRoutes);
router.use("/booking-demand", bookingDemandRoutes);
router.use("/booking-loss", bookingLossRoutes);
router.use("/rebooking-opportunities", rebookingOpportunityRoutes);

router.use("/rebooking-campaigns", rebookingCampaignRoutes);
router.use("/marketing-attribution", marketingAttributionRoutes);
router.use("/smart-appointments", smartAppointmentRoutes);
router.use("/capacity-planning", capacityPlanningRoutes);
router.use("/dynamic-pricing", dynamicPricingRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/feedback-analytics", feedbackAnalyticsRoutes);
router.use("/management-copilot", managementCopilotRoutes);
router.use("/executive-command-centre", executiveCommandRoutes);
router.use("/data-export-audit", dataExportAuditRoutes);

export default router;
