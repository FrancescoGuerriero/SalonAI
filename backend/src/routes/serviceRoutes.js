import express from "express";

import {
  createService,
  deleteService,
  getManagementServices,
  getServiceById,
  getServices,
  updateService,
  updateServicePublication,
} from "../controllers/serviceController.js";

import {
  protect,
  superAdminOnly,
} from "../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

const router = express.Router();

// Customers browse published salon services without signing in.
router.get("/", getServices);

// Management catalogue includes published and unpublished records.
router.get(
  "/management",
  protect,
  requirePermissions(
    "service:read"
  ),
  getManagementServices
);

router.post(
  "/",
  protect,
  requirePermissions(
    "service:create"
  ),
  createService
);

router.patch(
  "/:id/publication",
  protect,
  requirePermissions(
    "service:publish"
  ),
  updateServicePublication
);

router.put(
  "/:id",
  protect,
  requirePermissions(
    "service:update"
  ),
  updateService
);

// Hard deletion remains Super-Admin-only; unpublish is the normal lifecycle.
router.delete(
  "/:id",
  protect,
  superAdminOnly,
  deleteService
);

router.get(
  "/:id",
  getServiceById
);

export default router;
