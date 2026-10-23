import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import * as controller from "./campaignController.js";

const router = express.Router();

router
  .route("/")
  .get(asyncHandler(controller.list))
  .post(
    requirePermissions("communications:manage"),
    asyncHandler(controller.create)
  );

router.get(
  "/:id/preview",
  asyncHandler(controller.preview)
);

router.get(
  "/:id/jobs",
  asyncHandler(controller.jobs)
);

router
  .route("/:id/executions")
  .get(asyncHandler(controller.executions))
  .post(
    requirePermissions("communications:manage"),
    asyncHandler(controller.createExecution)
  );

router
  .route("/:id/publications")
  .get(asyncHandler(controller.publications))
  .post(
    requirePermissions("communications:manage"),
    asyncHandler(controller.createPublication)
  );

router.post(
  "/:id/publications/:publicationId/queue",
  requirePermissions("communications:manage"),
  asyncHandler(controller.queuePublication)
);

router.post(
  "/:id/publications/:publicationId/publish",
  requirePermissions("communications:manage"),
  asyncHandler(controller.publishPublication)
);

router.post(
  "/:id/schedule",
  requirePermissions("communications:manage"),
  asyncHandler(controller.schedule)
);

router.post(
  "/:id/cancel",
  requirePermissions("communications:manage"),
  asyncHandler(controller.cancel)
);

router
  .route("/:id")
  .get(asyncHandler(controller.get))
  .patch(
    requirePermissions("communications:manage"),
    asyncHandler(controller.update)
  );

export default router;
