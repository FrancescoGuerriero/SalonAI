import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import { protect } from "../../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import {
  commitDataImport,
  getDataImportHistory,
  previewDataImport,
} from "./dataImportController.js";

const router = express.Router();

router.use(
  protect,
  requirePermissions(
    "data-import:manage"
  )
);

router.get("/history", asyncHandler(getDataImportHistory));
router.post("/preview", asyncHandler(previewDataImport));
router.post("/commit", asyncHandler(commitDataImport));

export default router;
