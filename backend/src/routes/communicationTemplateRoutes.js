import express from "express";

import communicationTemplateController from "../controllers/communicationTemplateController.js";
import {
  createScopedTemplate,
  getScopedTemplateSummary,
  listScopedTemplates,
} from "../controllers/communicationTenantController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  communicationEffectiveScopeMiddleware,
  scopedTemplateMutationResource,
  scopedTemplateResource,
  scopedTemplateSlugResource,
} from "../middleware/communicationTenantMiddleware.js";
import {
  effectiveAuthorityMiddleware,
} from "../middleware/effectiveAuthorityMiddleware.js";
import {
  requireAnyPermission,
  requirePermissions,
} from "../middleware/permissionMiddleware.js";
import {
  workforcePublicTenantContextMiddleware,
} from "../middleware/workforceTenantMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../platform/tenancy/trustedTenantMiddleware.js";

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

router.use(
  protect,
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  communicationEffectiveScopeMiddleware
);

/*
|--------------------------------------------------------------------------
| Communication template collection
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  manageCommunications,
  createScopedTemplate
);

router.get(
  "/",
  readCommunications,
  listScopedTemplates
);

/*
|--------------------------------------------------------------------------
| Template analytics
|--------------------------------------------------------------------------
*/

router.get(
  "/summary",
  readCommunications,
  getScopedTemplateSummary
);

/*
|--------------------------------------------------------------------------
| Template lookup
|--------------------------------------------------------------------------
*/

router.get(
  "/slug/:slug",
  readCommunications,
  scopedTemplateSlugResource,
  communicationTemplateController.getCommunicationTemplateBySlug
);

router.get(
  "/:templateId",
  readCommunications,
  scopedTemplateResource,
  communicationTemplateController.getCommunicationTemplate
);

/*
|--------------------------------------------------------------------------
| Template operations
|--------------------------------------------------------------------------
*/

router.patch(
  "/:templateId",
  manageCommunications,
  scopedTemplateMutationResource,
  communicationTemplateController.updateCommunicationTemplate
);

router.patch(
  "/:templateId/status",
  manageCommunications,
  scopedTemplateMutationResource,
  communicationTemplateController.setCommunicationTemplateStatus
);

router.post(
  "/:templateId/render",
  readCommunications,
  scopedTemplateResource,
  communicationTemplateController.renderCommunicationTemplate
);

router.post(
  "/:templateId/duplicate",
  manageCommunications,
  scopedTemplateMutationResource,
  communicationTemplateController.duplicateCommunicationTemplate
);

router.delete(
  "/:templateId",
  manageCommunications,
  scopedTemplateMutationResource,
  communicationTemplateController.deleteCommunicationTemplate
);

export default router;
