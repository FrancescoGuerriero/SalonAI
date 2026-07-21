import express from "express";

import {
  createService,
  getServiceById,
  getServices,
  updateService,
  deleteService
} from "../controllers/serviceController.js";

const router = express.Router();

router.get("/", getServices);
router.get("/:id", getServiceById);

router.post("/", createService);
router.put("/:id", updateService);
router.delete("/:id", deleteService);

export default router;