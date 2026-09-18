import express from "express";

import communicationTemplateController from "../controllers/communicationTemplateController.js";

import {
  managementOnly,
  protect,
} from "../middleware/authMiddleware.js";
import {
  requireAnyPermission,
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

const router = express.Router();

const readCommunications =
  requireAnyPermission(
    "communications:read",
    "communications:manage"
  );

const manageCommunications =
  requirePermissions(
    "communications:manage"
  );

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
  manageCommunications,
  communicationTemplateController\.createCommunicationTemplate
);

// List, search, filter, sort and paginate templates.
router.get(
  "/",
  readCommunications,
  communicationTemplateController\.listCommunicationTemplates
);

/*
|--------------------------------------------------------------------------
| Template analytics
|--------------------------------------------------------------------------
*/

// Return template totals, usage, channels and campaigns.
router.get(
  "/summary",
  readCommunications,
  communicationTemplateController\.getCommunicationTemplateSummary
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
  readCommunications,
  communicationTemplateController\.getCommunicationTemplateBySlug
);

// Retrieve one template using its MongoDB ID.
router.get(
  "/:templateId",
  readCommunications,
  communicationTemplateController\.getCommunicationTemplate
);

/*
|--------------------------------------------------------------------------
| Template operations
|--------------------------------------------------------------------------
*/

// Update template content and configuration.
router.patch(
  "/:templateId",
  manageCommunications,
  communicationTemplateController\.updateCommunicationTemplate
);

// Activate or deactivate a template.
router.patch(
  "/:templateId/status",
  manageCommunications,
  communicationTemplateController\.setCommunicationTemplateStatus
);

// Render a template using supplied variables.
router.post(
  "/:templateId/render",
  readCommunications,
  communicationTemplateController\.renderCommunicationTemplate
);

// Duplicate an existing template.
router.post(
  "/:templateId/duplicate",
  manageCommunications,
  communicationTemplateController\.duplicateCommunicationTemplate
);

// Delete a non-system communication template.
router.delete(
  "/:templateId",
  manageCommunications,
  communicationTemplateController\.deleteCommunicationTemplate
);

export default router;