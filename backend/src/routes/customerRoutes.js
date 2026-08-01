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
  adminOnly,
  managementOnly,
  protect,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(managementOnly);

router.get("/", getCustomers);
router.get("/:id", getCustomer);

router.post("/", adminOnly, createCustomer);
router.put("/:id", adminOnly, updateCustomer);
router.patch("/:id/archive", adminOnly, archiveCustomer);
router.patch("/:id/restore", adminOnly, restoreCustomer);
router.delete("/:id", adminOnly, deleteCustomer);

export default router;
