import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./schedulerController.js";

const router = express.Router();

router.get("/", asyncHandler(controller.list));
router.post(
  "/process",
  asyncHandler(controller.process)
);
router.post(
  "/:id/cancel",
  asyncHandler(controller.cancel)
);

export default router;
