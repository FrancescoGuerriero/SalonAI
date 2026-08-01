import express from "express";

import {
  createService,
  deleteService,
  getServiceById,
  getServices,
  updateService,
} from "../controllers/serviceController.js";

import {
  adminOnly,
  protect,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Customers may browse active salon services without signing in.
router.get("/", getServices);
router.get("/:id", getServiceById);

// Only administrators may change the service catalogue.
router.post("/", protect, adminOnly, createService);
router.put("/:id", protect, adminOnly, updateService);
router.delete("/:id", protect, adminOnly, deleteService);

export default router;
