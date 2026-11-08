import express from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  effectiveAuthorityMiddleware,
} from "../middleware/effectiveAuthorityMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";
import {
  workforcePublicTenantContextMiddleware,
} from "../middleware/workforceTenantMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../platform/tenancy/trustedTenantMiddleware.js";
import enterpriseSsoRoutes from "../features/enterpriseSso/enterpriseSsoRoutes.js";
import { moduleCatalogueController } from "../features/moduleCatalogue/moduleCatalogueController.js";
import { inspectTrustedTenantModuleEvidence } from "../features/moduleCatalogue/moduleCatalogueTenantRuntimeEvidence.js";
import { inspectModuleDeploymentProvenance } from "../features/moduleCatalogue/moduleCatalogueDeploymentProvenance.js";
import { inspectBackendRuntimeReleaseIdentity } from "../features/moduleCatalogue/moduleCatalogueBackendRuntimeIdentity.js";
import { inspectFullStackRuntimeSnapshot } from "../features/moduleCatalogue/moduleCatalogueFullStackRuntimeSnapshot.js";
import {
  getConfigurationStudio,
  listAuditLogs,
  listDeadLetters,
  listFeatureControls,
  listSettings,
  getSocialAuthReadiness,
  resetFeatureControl,
  updateFeatureControl,
  updateSetting,
} from "../controllers/systemAdministrationController.js";

const router = express.Router();

router.use(protect);

router.use(
  "/enterprise-sso",
  enterpriseSsoRoutes
);

// Read-only recent operator-collected full-stack snapshot; not live attestation.
router.get(
  "/module-catalogue/fullstack-runtime-snapshot",
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requirePermissions("feature-control:read"),
  asyncHandler(async (request, response) => {
    const snapshot = await inspectFullStackRuntimeSnapshot({
      effectiveAuthority: request.effectiveAuthority,
    });
    response.status(200).json({ success: true, snapshot });
  })
);

// Current backend process identity is independent of full-stack runtime health.
router.get(
  "/module-catalogue/backend-runtime-identity",
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requirePermissions("feature-control:read"),
  asyncHandler(async (request, response) => {
    const runtimeIdentity = await inspectBackendRuntimeReleaseIdentity({
      effectiveAuthority: request.effectiveAuthority,
    });
    response.status(200).json({ success: true, runtimeIdentity });
  })
);

// Archived deployment provenance: no upload, client paths, activation or writes.
router.get(
  "/module-catalogue/deployment-provenance",
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requirePermissions("feature-control:read"),
  asyncHandler(async (request, response) => {
    const provenance = await inspectModuleDeploymentProvenance({
      effectiveAuthority: request.effectiveAuthority,
    });
    response.status(200).json({ success: true, provenance });
  })
);

// Read-only tenant evidence requires membership-resolved all-location authority.
router.get(
  "/module-catalogue/tenant-evidence",
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requirePermissions("feature-control:read"),
  asyncHandler(async (request, response) => {
    const evidence = await inspectTrustedTenantModuleEvidence({
      effectiveAuthority: request.effectiveAuthority,
    });
    response.status(200).json({ success: true, evidence });
  })
);

// Planning dashboard only: server RBAC, no activation or write endpoints.
router.get(
  "/module-catalogue",
  requirePermissions("feature-control:read"),
  asyncHandler(moduleCatalogueController)
);

router.get(
  "/configuration-studio",
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requirePermissions(
    "feature-control:read"
  ),
  asyncHandler(
    getConfigurationStudio
  )
);
router.get(
  "/features",
  requirePermissions(
    "feature-control:read"
  ),
  asyncHandler(
    listFeatureControls
  )
);
router.patch(
  "/features/:featureId",
  requirePermissions(
    "feature-control:update"
  ),
  asyncHandler(
    updateFeatureControl
  )
);
router.delete(
  "/features/:featureId",
  requirePermissions(
    "feature-control:update"
  ),
  asyncHandler(
    resetFeatureControl
  )
);
router.get(
  "/settings",
  requirePermissions(
    "feature-control:read"
  ),
  asyncHandler(
    listSettings
  )
);
router.get(
  "/social-auth-readiness",
  requirePermissions(
    "feature-control:read"
  ),
  asyncHandler(
    getSocialAuthReadiness
  )
);
router.patch(
  "/settings/:key",
  requirePermissions(
    "feature-control:update"
  ),
  asyncHandler(
    updateSetting
  )
);
router.get(
  "/audit-logs",
  requirePermissions(
    "feature-control:read"
  ),
  asyncHandler(
    listAuditLogs
  )
);
router.get(
  "/dead-letters",
  requirePermissions(
    "feature-control:read"
  ),
  asyncHandler(
    listDeadLetters
  )
);

export default router;
