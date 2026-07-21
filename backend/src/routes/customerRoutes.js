import express from "express";

import {
  createCustomer,
  getCustomers,
  getCustomer,
  updateCustomer,
  archiveCustomer,
  restoreCustomer,
  deleteCustomer,
} from "../controllers/customerController.js";

import {
  protect,
  adminOnly,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Customer Routes
|--------------------------------------------------------------------------
*/

// View customers
router.get("/", protect, getCustomers);

// View single customer
router.get("/:id", protect, getCustomer);

// Create customer
router.post("/", protect, adminOnly, createCustomer);

// Update customer
router.put("/:id", protect, adminOnly, updateCustomer);

// Archive customer
router.patch("/:id/archive", protect, adminOnly, archiveCustomer);

// Restore customer
router.patch("/:id/restore", protect, adminOnly, restoreCustomer);

// Soft delete customer
router.delete("/:id", protect, adminOnly, deleteCustomer);

export default router;