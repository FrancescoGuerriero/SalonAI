import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import * as controller from "./futureCustomerProfileController.js";

const router = express.Router();

router.get(
  "/tags",
  asyncHandler(controller.listTags)
);

router.post(
  "/tags",
  requirePermissions("customer:update"),
  asyncHandler(controller.createTag)
);

router.get(
  "/:customerId",
  asyncHandler(controller.profile)
);

router.post(
  "/:customerId/notes",
  requirePermissions("customer:update"),
  asyncHandler(controller.createNote)
);

router.patch(
  "/notes/:noteId",
  requirePermissions("customer:update"),
  asyncHandler(controller.updateNote)
);

router.delete(
  "/notes/:noteId",
  requirePermissions("customer:delete"),
  asyncHandler(controller.deleteNote)
);

router.post(
  "/:customerId/tags",
  requirePermissions("customer:update"),
  asyncHandler(controller.assignTag)
);

router.delete(
  "/:customerId/tags/:tagId",
  requirePermissions("customer:update"),
  asyncHandler(controller.removeTag)
);

export default router;
