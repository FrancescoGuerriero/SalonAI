import express from "express";

import {
  archiveCustomer,
  createCustomer,
  deleteCustomer,
  getCustomer,
  getCustomers,
  restoreCustomer,
  updateCustomer,
} from "../controllers/customerController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

const router = express.Router();

router.use(protect);

router.get(
  "/",
  requirePermissions(
    "customer:read"
  ),
  getCustomers
);

router.get(
  "/:id",
  requirePermissions(
    "customer:read"
  ),
  getCustomer
);

router.post(
  "/",
  requirePermissions(
    "customer:create"
  ),
  createCustomer
);

router.put(
  "/:id",
  requirePermissions(
    "customer:update"
  ),
  updateCustomer
);

router.patch(
  "/:id/archive",
  requirePermissions(
    "customer:archive"
  ),
  archiveCustomer
);

router.patch(
  "/:id/restore",
  requirePermissions(
    "customer:archive"
  ),
  restoreCustomer
);

router.delete(
  "/:id",
  requirePermissions(
    "customer:delete"
  ),
  deleteCustomer
);

export default router;
