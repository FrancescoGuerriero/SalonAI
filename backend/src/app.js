import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { apiRateLimiter } from "./middleware/securityMiddleware.js";

import aiRecommendationRoutes from "./features/aiRecommendations/aiRecommendationRoutes.js";
import futureFeatureRoutes from "./features/futureFeatureRoutes.js";
import commerceRoutes from "./features/commerce/commerceRoutes.js";
import commerceWebhookRoutes from "./features/commerce/commerceWebhookRoutes.js";
import chatbotRoutes from "./features/chatbot/chatbotRoutes.js";
import customerExperienceRoutes from "./features/customerExperience/customerExperienceRoutes.js";
import dataImportRoutes from "./features/dataImport/dataImportRoutes.js";
import servicePackageCustomerRoutes from "./features/servicePackages/servicePackageCustomerRoutes.js";

import adminRoutes from "./routes/adminRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import campaignDeliveryRoutes from "./routes/campaignDeliveryRoutes.js";
import communicationCampaignRoutes from "./routes/communicationCampaignRoutes.js";
import communicationTemplateRoutes from "./routes/communicationTemplateRoutes.js";
import customerContactRoutes from "./routes/customerContactRoutes.js";
import customerNoteRoutes from "./routes/customerNoteRoutes.js";
import customerProfileRoutes from "./routes/customerProfileRoutes.js";
import customerRetentionRoutes from "./routes/customerRetentionRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import customerSegmentationRoutes from "./routes/customerSegmentationRoutes.js";
import dashboardInsightsRoutes from "./routes/dashboardInsightsRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import dailyCloseRoutes from "./routes/dailyCloseRoutes.js";
import messageDeliveryRoutes from "./routes/messageDeliveryRoutes.js";
import messageDeliverySchedulerRoutes from "./routes/messageDeliverySchedulerRoutes.js";
import scheduledCommunicationRoutes from "./routes/scheduledCommunicationRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import stylistRoutes from "./routes/stylistRoutes.js";
import appConfigurationRoutes from "./routes/appConfigurationRoutes.js";
import systemAdministrationRoutes from "./routes/systemAdministrationRoutes.js";
import staffRoleRoutes from "./routes/staffRoleRoutes.js";
import calendarOAuthCallbackRoutes from "./integrations/calendar/calendarOAuthCallbackRoutes.js";
import calendarWebhookRoutes from "./integrations/calendar/calendarWebhookRoutes.js";
import sendGridEventWebhookRoutes from "./integrations/messaging/sendGridEventWebhookRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import legalRoutes from "./routes/legalRoutes.js";
import publicMarketingPreferenceRoutes from "./routes/publicMarketingPreferenceRoutes.js";
import { requireFeature } from "./services/featureControlService.js";

import supplierRoutes from "./features/inventoryPurchasing/routes/supplierRoutes.js";
import purchaseOrderRoutes from "./features/inventoryPurchasing/routes/purchaseOrderRoutes.js";
import inventoryPurchasingRoutes from "./features/inventoryPurchasing/routes/inventoryPurchasingRoutes.js";

import loyaltyRoutes from "./features/premium/loyalty/loyaltyRoutes.js";
import giftCardRoutes from "./features/premium/giftCards/giftCardRoutes.js";
import referralRoutes from "./features/premium/referrals/referralRoutes.js";
import notificationRoutes from "./features/premium/notifications/notificationRoutes.js";
import pushRoutes from "./features/premium/push/pushRoutes.js";
import emailCampaignRoutes from "./features/premium/emailCampaigns/emailCampaignRoutes.js";
import smsRoutes from "./features/premium/sms/smsRoutes.js";
import whatsappRoutes from "./features/premium/whatsapp/whatsappRoutes.js";
import automationRoutes from "./features/premium/automation/automationRoutes.js";
import premiumAnalyticsRoutes from "./features/premium/analytics/premiumAnalyticsRoutes.js";


const app = express();

const frontendOrigin =
  process.env.FRONTEND_URL ||
  process.env.CLIENT_URL ||
  "http://localhost:5173";

/*
|--------------------------------------------------------------------------
| Core application middleware
|--------------------------------------------------------------------------
*/
app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(morgan("dev"));

/* Stripe requires the original raw request body for signature verification. */
app.use(
  "/api/commerce/webhooks",
  commerceWebhookRoutes
);
app.use(
  "/api/suppliers",
  requireFeature("inventory-purchasing"),
  supplierRoutes
);

app.use(
  "/api/purchase-orders",
  requireFeature("inventory-purchasing"),
  purchaseOrderRoutes
);

app.use(
  "/api/inventory-purchasing",
  requireFeature("inventory-purchasing"),
  inventoryPurchasingRoutes
);

/*
|--------------------------------------------------------------------------
| External provider webhooks
|--------------------------------------------------------------------------
| Calendar provider callbacks authenticate with provider-issued channel state.
| They are mounted before the general API rate limiter so provider delivery
| is not coupled to interactive API traffic.
*/
app.use(
  "/api/calendar-webhooks",
  calendarWebhookRoutes
);

/*
 * SendGrid signature verification requires
 * the exact raw JSON bytes. Keep this route
 * before express.json(), JWT middleware and
 * interactive API rate limiting.
 */
app.use(
  "/api/message-delivery/webhooks/sendgrid",
  sendGridEventWebhookRoutes
);

app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Twilio-Signature",
    ],
  })
);

app.use(
  "/api",
  apiRateLimiter
);

app.use(
  express.json({
    limit: "2mb",

    verify: (
      request,
      response,
      buffer
    ) => {
      if (
        String(
          request.originalUrl || ""
        ).startsWith(
          "/api/whatsapp/webhook"
        )
      ) {
        request.rawBody =
          Buffer.from(buffer);
      }
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

/*
|--------------------------------------------------------------------------
| Premium feature routes
|--------------------------------------------------------------------------
| Mounted after the API rate limiter and body-parsing middleware so authenticated
| premium endpoints can safely read request bodies.
*/
app.use("/api/loyalty", requireFeature("loyalty"), loyaltyRoutes);
app.use("/api/gift-cards", requireFeature("wallet"), giftCardRoutes);
app.use("/api/referrals", requireFeature("referrals"), referralRoutes);
app.use("/api/notifications", requireFeature("notifications"), notificationRoutes);
app.use("/api/push", requireFeature("notifications"), pushRoutes);
app.use("/api/email-campaigns", requireFeature("communications"), emailCampaignRoutes);
app.use("/api/sms", requireFeature("communications"), smsRoutes);
app.use("/api/whatsapp", requireFeature("whatsapp-booking"), whatsappRoutes);
app.use("/api/retention-automation", requireFeature("retention-automation"), automationRoutes);
app.use("/api/premium-analytics", requireFeature("premium-analytics"), premiumAnalyticsRoutes);
app.use("/api/customer-experience", customerExperienceRoutes);
app.use("/api/data-imports", dataImportRoutes);

/*
|--------------------------------------------------------------------------
| API health routes
|--------------------------------------------------------------------------
*/

app.get("/", (request, response) => {
  return response.status(200).json({
    success: true,
    message:
      "SalonAI Backend API is running.",
    environment:
      process.env.NODE_ENV ||
      "development",
    timestamp:
      new Date().toISOString(),
  });
});

app.get(
  "/api/health",
  (request, response) => {
    return response.status(200).json({
      success: true,
      service: "SalonAI API",
      status: "healthy",
      timestamp:
        new Date().toISOString(),
    });
  }
);

app.use(
  "/api/health",
  healthRoutes
);

/*
|--------------------------------------------------------------------------
| Public and authentication routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/legal",
  legalRoutes
);

app.use(
  "/api/marketing-preferences",
  publicMarketingPreferenceRoutes
);

app.use(
  "/api/app-configuration",
  appConfigurationRoutes
);

app.use(
  "/api/services",
  serviceRoutes
);

app.use(
  "/api/stylists",
  stylistRoutes
);

app.use(
  "/api/service-packages",
  servicePackageCustomerRoutes
);

app.use(
  "/api/commerce",
  commerceRoutes
);

app.use(
  "/api/chatbot",
  requireFeature("salon-chatbot"),
  chatbotRoutes
);

/*
|--------------------------------------------------------------------------
| Appointment and customer routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/appointments",
  appointmentRoutes
);

app.use(
  "/api/customers",
  customerRoutes
);

app.use(
  "/api/customer-profiles",
  customerProfileRoutes
);

app.use(
  "/api/customer-notes",
  customerNoteRoutes
);

app.use(
  "/api/customer-segments",
  customerSegmentationRoutes
);

app.use(
  "/api/customer-contacts",
  customerContactRoutes
);

/*
|--------------------------------------------------------------------------
| Communication and delivery routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/communication-templates",
  requireFeature("communications"),
  communicationTemplateRoutes
);

app.use(
  "/api/communication-campaigns",
  requireFeature("communications"),
  communicationCampaignRoutes
);

app.use(
  "/api/scheduled-communications",
  requireFeature("communications"),
  scheduledCommunicationRoutes
);

app.use(
  "/api/message-delivery",
  requireFeature("communications"),
  messageDeliveryRoutes
);

app.use(
  "/api/campaign-delivery",
  requireFeature("communications"),
  campaignDeliveryRoutes
);

app.use(
  "/api/message-delivery-scheduler",
  requireFeature("communications"),
  messageDeliverySchedulerRoutes
);

/*
|--------------------------------------------------------------------------
| Dashboard and retention analytics routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/dashboard/insights",
  dashboardInsightsRoutes
);

app.use(
  "/api/dashboard/customer-retention",
  customerRetentionRoutes
);

app.use(
  "/api/dashboard",
  dashboardRoutes
);

app.use(
  "/api/daily-close",
  dailyCloseRoutes
);

/*
|--------------------------------------------------------------------------
| Phase 4 AI microservice routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/ai",
  requireFeature("ai-tools"),
  aiRecommendationRoutes
);


/*
|--------------------------------------------------------------------------
| Future feature routes
|--------------------------------------------------------------------------
|
| These routes provide the operational implementations for retention actions,
| appointment management, waitlists, AI features, reports, commerce, loyalty,
| staff management and security.
|
| Customer retention actions are available at:
|
| /api/future/retention-actions
|
*/

app.use(
  "/api/calendar-oauth",
  calendarOAuthCallbackRoutes
);

app.use(
  "/api/future",
  futureFeatureRoutes
);

/*
|--------------------------------------------------------------------------
| Administration routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/admin",
  adminRoutes
);

app.use(
  "/api/system-administration",
  systemAdministrationRoutes
);

app.use(
  "/api/staff-roles",
  staffRoleRoutes
);

/*
|--------------------------------------------------------------------------
| Unknown route handler
|--------------------------------------------------------------------------
*/

app.use(
  (request, response) => {
    return response.status(404).json({
      success: false,
      message: `Route not found: ${request.method} ${request.originalUrl}`,
      code: "ROUTE_NOT_FOUND",
    });
  }
);

/*
|--------------------------------------------------------------------------
| Application error handler
|--------------------------------------------------------------------------
*/

app.use(
  (
    error,
    request,
    response,
    next
  ) => {
    if (response.headersSent) {
      return next(error);
    }

    let statusCode =
      Number(
        error.statusCode ||
          error.status
      ) || 500;

    let message =
      error.message ||
      "Internal server error.";

    const defaultErrorCodes = {
      400: "BAD_REQUEST",
      401: "AUTHENTICATION_REQUIRED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "UNPROCESSABLE_ENTITY",
      429: "TOO_MANY_REQUESTS",
    };

    let code =
      error.code ||
      defaultErrorCodes[statusCode] ||
      "INTERNAL_SERVER_ERROR";

    if (
      error.name ===
      "ValidationError"
    ) {
      statusCode = 400;
      code =
        "MONGOOSE_VALIDATION_ERROR";

      const validationMessages =
        Object.values(
          error.errors || {}
        )
          .map(
            (validationError) =>
              validationError.message
          )
          .filter(Boolean);

      if (
        validationMessages.length >
        0
      ) {
        message =
          validationMessages.join(
            " "
          );
      }
    }

    if (
      error.name ===
      "CastError"
    ) {
      statusCode = 400;
      code =
        "INVALID_DATABASE_VALUE";

      message = `Invalid value supplied for ${error.path}.`;
    }

    if (
      Number(error.code) === 11000
    ) {
      statusCode = 409;
      code =
        "DUPLICATE_DATABASE_VALUE";

      const duplicateFields =
        Object.keys(
          error.keyPattern ||
            error.keyValue ||
            {}
        );

      message =
        duplicateFields.length > 0
          ? `A record already exists with the supplied ${duplicateFields.join(
              ", "
            )}.`
          : "A record already exists with the supplied value.";
    }

    if (statusCode >= 500) {
      console.error(error);
    }

    const responseBody = {
      success: false,
      message,
      code,
    };

    if (error.field) {
      responseBody.field =
        error.field;
    }

    if (
      error.retryable !==
      undefined
    ) {
      responseBody.retryable =
        Boolean(
          error.retryable
        );
    }

    if (error.channel) {
      responseBody.channel =
        error.channel;
    }

    if (
      error.providerResponse
    ) {
      responseBody.providerResponse =
        error.providerResponse;
    }

    if (error.details) {
      responseBody.details =
        error.details;
    }

    if (
      process.env.NODE_ENV ===
      "development"
    ) {
      responseBody.stack =
        error.stack;
    }

    return response
      .status(statusCode)
      .json(responseBody);
  }
);

export default app;
