import express from "express";

import {
  managementOnly,
  protect,
} from "../../middleware/authMiddleware.js";

import asyncHandler from "../../shared/asyncHandler.js";

import {
  analyseCustomerSegmentation,
} from "./aiCustomerSegmentationController.js";

import {
  generateAppointmentDemandForecast,
} from "./aiDemandForecastingController.js";

import {
  recommendHaircare,
  status,
} from "./aiRecommendationController.js";

import {
  generateCustomerSummary,
} from "./aiCustomerSummaryController.js";

import {
  generateAiSalesForecast,
} from "./aiSalesForecastingController.js";

import {
  generateAiMarketingInsights,
} from "./aiMarketingInsightsController.js";

const router = express.Router();


/*
|--------------------------------------------------------------------------
| Authentication and authorisation
|--------------------------------------------------------------------------
|
| Every route in this router contains operational or AI-generated management
| information. A valid authenticated management account is therefore required.
|
*/

router.use(protect);
router.use(managementOnly);


/*
|--------------------------------------------------------------------------
| AI-service status
|--------------------------------------------------------------------------
*/

router.get(
  "/status",
  asyncHandler(status)
);


/*
|--------------------------------------------------------------------------
| Haircare recommendations
|--------------------------------------------------------------------------
*/

router.post(
  "/haircare/recommendations",
  asyncHandler(
    recommendHaircare
  )
);


/*
|--------------------------------------------------------------------------
| Customer AI summaries
|--------------------------------------------------------------------------
*/

router.get(
  "/customers/:customerId/summary",
  asyncHandler(
    generateCustomerSummary
  )
);


/*
|--------------------------------------------------------------------------
| AI customer segmentation
|--------------------------------------------------------------------------
*/

router.get(
  "/customer-segmentation",
  asyncHandler(
    analyseCustomerSegmentation
  )
);


/*
|--------------------------------------------------------------------------
| AI appointment-demand forecasting
|--------------------------------------------------------------------------
|
| Examples:
|
| GET /api/ai/appointment-demand-forecast
| GET /api/ai/appointment-demand-forecast?horizonDays=28
| GET /api/ai/appointment-demand-forecast?lookbackDays=180&horizonDays=28
|
*/

router.get(
  "/appointment-demand-forecast",
  asyncHandler(
    generateAppointmentDemandForecast
  )
);


/*
|--------------------------------------------------------------------------
| AI sales forecasting
|--------------------------------------------------------------------------
|
| Examples:
|
| GET /api/ai/sales-forecast
| GET /api/ai/sales-forecast?horizonDays=90
| GET /api/ai/sales-forecast?lookbackDays=365&horizonDays=90
| GET /api/ai/sales-forecast?scenarioAdjustment=0.1
|
*/

router.get(
  "/sales-forecast",
  asyncHandler(
    generateAiSalesForecast
  )
);

router.get(
  "/marketing-insights",
  asyncHandler(
    generateAiMarketingInsights
  )
);

export default router;