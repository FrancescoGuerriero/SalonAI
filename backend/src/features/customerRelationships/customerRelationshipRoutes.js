import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import { protect } from "../../middleware/authMiddleware.js";
import * as controller from "./customerRelationshipController.js";

const router = express.Router();
router.use(protect);

router.get("/me", asyncHandler(controller.listMine));
router.post("/me", asyncHandler(controller.invite));
router.patch("/me/:id", asyncHandler(controller.respond));
router.delete("/me/:id", asyncHandler(controller.revoke));

export default router;
