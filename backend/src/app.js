import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import aiRecommendationRoutes from "./features/aiRecommendations/aiRecommendationRoutes.js";
import futureFeatureRoutes from "./features/futureFeatureRoutes.js";
import commerceRoutes from "./features/commerce/commerceRoutes.js";
import commerceWebhookRoutes from "./features/commerce/commerceWebhookRoutes.js";
import chatbotRoutes from "./features/chatbot/chatbotRoutes.js";
import customerExperienceRoutes from "./features/customerExperience/customerExperienceRoutes.js";
import dataImportRoutes from "./features/dataImport/dataImportRoutes.js";

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
  supplierRoutes
);

app.use(
  "/api/purchase-orders",
  purchaseOrderRoutes
);

app.use(
  "/api/inventory-purchasing",
  inventoryPurchasingRoutes
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
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

app.use(cookieParser());

/*
|--------------------------------------------------------------------------
| Premium feature routes
|--------------------------------------------------------------------------
| Mounted after JSON, URL-encoded and cookie middleware so authenticated
| premium endpoints can read request bodies and cookie-based access tokens.
*/
app.use("/api/loyalty", loyaltyRoutes);
app.use("/api/gift-cards", giftCardRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/email-campaigns", emailCampaignRoutes);
app.use("/api/sms", smsRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/retention-automation", automationRoutes);
app.use("/api/premium-analytics", premiumAnalyticsRoutes);
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
  "/api/services",
  serviceRoutes
);

app.use(
  "/api/stylists",
  stylistRoutes
);

app.use(
  "/api/commerce",
  commerceRoutes
);

app.use(
  "/api/chatbot",
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
  communicationTemplateRoutes
);

app.use(
  "/api/communication-campaigns",
  communicationCampaignRoutes
);

app.use(
  "/api/scheduled-communications",
  scheduledCommunicationRoutes
);

app.use(
  "/api/message-delivery",
  messageDeliveryRoutes
);

app.use(
  "/api/campaign-delivery",
  campaignDeliveryRoutes
);

app.use(
  "/api/message-delivery-scheduler",
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
