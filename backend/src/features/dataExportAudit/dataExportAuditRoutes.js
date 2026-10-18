import { Router } from "express";

import {
  effectiveAuthorityMiddleware,
} from "../../middleware/effectiveAuthorityMiddleware.js";
import {
  workforcePublicTenantContextMiddleware,
} from "../../middleware/workforceTenantMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../../platform/tenancy/trustedTenantMiddleware.js";
import { exportDataset, getAuditEvents } from "./dataExportAuditController.js";

const router = Router();

router.use(
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware
);

router.get("/exports/:dataset", exportDataset);
router.get("/audit", getAuditEvents);

export default router;
