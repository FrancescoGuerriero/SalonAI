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
import servicePackageRoutes from "./servicePackages/servicePackageRoutes.js";
import groupBookingRoutes from "./groupBookings/groupBookingRoutes.js";
import serviceTrialRoutes from "./serviceTrials/serviceTrialRoutes.js";
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
  protect,
} from "../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";
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
router.use(
  "/service-packages",
  servicePackageRoutes
);
router.use(
  "/group-bookings",
  requireFeature("group-bookings"),
  groupBookingRoutes
);
router.use(
  "/service-trials",
  requireFeature("service-trials"),
  serviceTrialRoutes
);

/*
 * Every dashboard workspace below is protected by the same permission used by
 * its frontend navigation/route guard. The legacy role gate is retained only
 * for the internal security router, which is not a delegated dashboard item.
 */
router.use(
  "/templates",
  requirePermissions("communications:read"),
  requireFeature("communications"),
  templateRoutes
);
router.use(
  "/segments",
  requirePermissions("customer:read"),
  segmentRoutes
);
router.use(
  "/campaigns",
  requirePermissions("communications:read"),
  requireFeature("communications"),
  campaignRoutes
);
router.use(
  "/scheduler",
  requirePermissions("communications:read"),
  requireFeature("communications"),
  schedulerRoutes
);
router.use(
  "/customer-profiles",
  requirePermissions("customer:read"),
  customerProfileRoutes
);
router.use(
  "/retention-actions",
  requirePermissions("customer:read"),
  retentionActionRoutes
);
router.use(
  "/calendar-connections",
  requirePermissions("appointment:read"),
  calendarConnectionRoutes
);
router.use(
  "/waitlist",
  requirePermissions("appointment:read"),
  waitlistRoutes
);
router.use(
  "/ai",
  requirePermissions("ai:use"),
  requireFeature("ai-tools"),
  aiRoutes
);
router.use(
  "/reports",
  requirePermissions("reports:read"),
  reportRoutes
);
router.use(
  "/revenue-forecast",
  requirePermissions("reports:read"),
  revenueForecastRoutes
);
router.use(
  "/loyalty",
  requirePermissions("loyalty:manage"),
  requireFeature("loyalty"),
  loyaltyRoutes
);
router.use(
  "/staff-rota",
  requirePermissions("employee:read"),
  staffRotaRoutes
);

/*
 * Security endpoints enforce their own canonical permissions.
 * Do not add a role-only parent gate here: custom roles and delegated
 * permissions must use the same StaffRole/permission registry.
 */
router.use(
  "/security",
  securityRoutes
);

router.use(
  "/staff-performance",
  requirePermissions("reports:read"),
  staffPerformanceRoutes
);
router.use(
  "/service-performance",
  requirePermissions("reports:read"),
  servicePerformanceRoutes
);
router.use(
  "/customer-value",
  requirePermissions("customer:read"),
  customerValueRoutes
);
router.use(
  "/booking-demand",
  requirePermissions("appointment:read"),
  bookingDemandRoutes
);
router.use(
  "/booking-loss",
  requirePermissions("appointment:read"),
  bookingLossRoutes
);
router.use(
  "/rebooking-opportunities",
  requirePermissions("customer:read"),
  rebookingOpportunityRoutes
);
router.use(
  "/rebooking-campaigns",
  requirePermissions("communications:read"),
  requireFeature("communications"),
  rebookingCampaignRoutes
);
router.use(
  "/marketing-attribution",
  requirePermissions("ai:use"),
  requireFeature("ai-tools"),
  marketingAttributionRoutes
);
router.use(
  "/smart-appointments",
  requirePermissions("ai:use"),
  requireFeature("ai-tools"),
  smartAppointmentRoutes
);
router.use(
  "/capacity-planning",
  requirePermissions("ai:use"),
  requireFeature("ai-tools"),
  capacityPlanningRoutes
);
router.use(
  "/dynamic-pricing",
  requirePermissions("ai:use"),
  requireFeature("ai-tools"),
  dynamicPricingRoutes
);
router.use(
  "/inventory",
  requirePermissions("inventory:read"),
  requireFeature("inventory-purchasing"),
  inventoryRoutes
);
router.use(
  "/feedback-analytics",
  requirePermissions("ai:use"),
  requireFeature("ai-tools"),
  feedbackAnalyticsRoutes
);
router.use(
  "/management-copilot",
  requirePermissions("ai:use"),
  requireFeature("ai-tools"),
  managementCopilotRoutes
);
router.use(
  "/executive-command-centre",
  requirePermissions("ai:use"),
  requireFeature("ai-tools"),
  executiveCommandRoutes
);
router.use(
  "/data-export-audit",
  requirePermissions("reports:read"),
  dataExportAuditRoutes
);

export default router;
