import express from "express";

import customerContactController from "../controllers/customerContactController.js";

const router = express.Router();

/*
 * Customer contact and re-engagement routes
 *
 * Add your existing authentication or role middleware here
 * if these endpoints should only be available to authorised staff.
 */

// Create a customer contact record
router.post(
  "/",
  customerContactController.createContactLog
);

// List and filter all customer contact records
router.get(
  "/",
  customerContactController.listContactLogs
);

// Contact campaign analytics
// This route must appear before "/:contactLogId".
router.get(
  "/campaign-summary",
  customerContactController.getCampaignSummary
);

// Contact history for one customer
// This route must appear before "/:contactLogId".
router.get(
  "/customer/:customerId",
  customerContactController.getCustomerContactHistory
);

// Read one contact record
router.get(
  "/:contactLogId",
  customerContactController.getContactLog
);

// Update only the delivery/contact status
router.patch(
  "/:contactLogId/status",
  customerContactController.updateContactStatus
);

// Update a complete contact record
router.patch(
  "/:contactLogId",
  customerContactController.updateContactLog
);

// Delete an incorrect contact record
router.delete(
  "/:contactLogId",
  customerContactController.deleteContactLog
);

export default router;