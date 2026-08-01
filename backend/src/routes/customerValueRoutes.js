import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./futureCustomerProfileController.js";

const router = express.Router();

router.get(
  "/tags",
  asyncHandler(controller.listTags)
);

router.post(
  "/tags",
  asyncHandler(controller.createTag)
);

router.get(
  "/:customerId",
  asyncHandler(controller.profile)
);

router.post(
  "/:customerId/notes",
  asyncHandler(controller.createNote)
);

router.patch(
  "/notes/:noteId",
  asyncHandler(controller.updateNote)
);

router.delete(
  "/notes/:noteId",
  asyncHandler(controller.deleteNote)
);

router.post(
  "/:customerId/tags",
  asyncHandler(controller.assignTag)
);

router.delete(
  "/:customerId/tags/:tagId",
  asyncHandler(controller.removeTag)
);

export default router;
