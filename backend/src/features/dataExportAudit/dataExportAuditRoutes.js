import { Router } from "express";
import { exportDataset, getAuditEvents } from "./dataExportAuditController.js";

const router = Router();
router.get("/exports/:dataset", exportDataset);
router.get("/audit", getAuditEvents);
export default router;
