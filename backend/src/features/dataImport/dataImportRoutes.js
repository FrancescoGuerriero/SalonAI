import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import { adminOnly, protect } from "../../middleware/authMiddleware.js";
import {
  commitDataImport,
  getDataImportHistory,
  previewDataImport,
} from "./dataImportController.js";

const router = express.Router();

router.use(protect, adminOnly);

router.get("/history", asyncHandler(getDataImportHistory));
router.post("/preview", asyncHandler(previewDataImport));
router.post("/commit", asyncHandler(commitDataImport));

export default router;
