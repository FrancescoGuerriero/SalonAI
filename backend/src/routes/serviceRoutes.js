import express from "express";

import {
  createService,
  getServiceById,
  getServices
} from "../controllers/serviceController.js";

const router = express.Router();

router.get("/", getServices);
router.get("/:id", getServiceById);
router.post("/", createService);

export default router;