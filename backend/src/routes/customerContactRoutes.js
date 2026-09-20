import express from "express";

import customerContactController from "../controllers/customerContactController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

const router = express.Router();

router.use(protect);

/*
 * Customer contact and re-engagement routes
 *
 * Add your existing authentication or role middleware here
 * if these endpoints should only be available to authorised staff.
 */

// Create a customer contact record
router.post(
  "/",
  requirePermissions(
    "customer:update"
  ),
  customerContactController.createContactLog
);

// List and filter all customer contact records
router.get(
  "/",
  requirePermissions(
    "customer:read"
  ),
  customerContactController.listContactLogs
);

// Contact campaign analytics
// This route must appear before "/:contactLogId".
router.get(
  "/campaign-summary",
  requirePermissions(
    "customer:read"
  ),
  customerContactController.getCampaignSummary
);

// Contact history for one customer
// This route must appear before "/:contactLogId".
router.get(
  "/customer/:customerId",
  requirePermissions(
    "customer:read"
  ),
  customerContactController.getCustomerContactHistory
);

// Read one contact record
router.get(
  "/:contactLogId",
  requirePermissions(
    "customer:read"
  ),
  customerContactController.getContactLog
);

// Update only the delivery/contact status
router.patch(
  "/:contactLogId/status",
  requirePermissions(
    "customer:update"
  ),
  customerContactController.updateContactStatus
);

// Update a complete contact record
router.patch(
  "/:contactLogId",
  requirePermissions(
    "customer:update"
  ),
  customerContactController.updateContactLog
);

// Delete an incorrect contact record
router.delete(
  "/:contactLogId",
  requirePermissions(
    "customer:update"
  ),
  customerContactController.deleteContactLog
);

export default router;