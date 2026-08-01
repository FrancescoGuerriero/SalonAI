import express from "express";

import communicationTemplateController from "../controllers/communicationTemplateController.js";

import {
  managementOnly,
  protect,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(managementOnly);

/*
|--------------------------------------------------------------------------
| Communication template collection
|--------------------------------------------------------------------------
*/

// Create a new communication template.
router.post(
  "/",
  communicationTemplateController.createCommunicationTemplate
);

// List, search, filter, sort and paginate templates.
router.get(
  "/",
  communicationTemplateController.listCommunicationTemplates
);

/*
|--------------------------------------------------------------------------
| Template analytics
|--------------------------------------------------------------------------
*/

// Return template totals, usage, channels and campaigns.
router.get(
  "/summary",
  communicationTemplateController.getCommunicationTemplateSummary
);

/*
|--------------------------------------------------------------------------
| Template lookup
|--------------------------------------------------------------------------
*/

// Retrieve a template using its slug.
// This route must remain above "/:templateId".
router.get(
  "/slug/:slug",
  communicationTemplateController.getCommunicationTemplateBySlug
);

// Retrieve one template using its MongoDB ID.
router.get(
  "/:templateId",
  communicationTemplateController.getCommunicationTemplate
);

/*
|--------------------------------------------------------------------------
| Template operations
|--------------------------------------------------------------------------
*/

// Update template content and configuration.
router.patch(
  "/:templateId",
  communicationTemplateController.updateCommunicationTemplate
);

// Activate or deactivate a template.
router.patch(
  "/:templateId/status",
  communicationTemplateController.setCommunicationTemplateStatus
);

// Render a template using supplied variables.
router.post(
  "/:templateId/render",
  communicationTemplateController.renderCommunicationTemplate
);

// Duplicate an existing template.
router.post(
  "/:templateId/duplicate",
  communicationTemplateController.duplicateCommunicationTemplate
);

// Delete a non-system communication template.
router.delete(
  "/:templateId",
  communicationTemplateController.deleteCommunicationTemplate
);

export default router;