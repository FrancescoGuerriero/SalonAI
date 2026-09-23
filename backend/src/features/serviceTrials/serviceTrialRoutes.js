import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import {
  book,
  bookings,
  conversion,
  createDefinition,
  definitions,
  getBooking,
  updateDefinition,
} from "./serviceTrialController.js";

const router = express.Router();

router.get(
  "/definitions",
  requirePermissions("appointment:read"),
  asyncHandler(definitions)
);
router.post(
  "/definitions",
  requirePermissions("service:update"),
  asyncHandler(createDefinition)
);
router.patch(
  "/definitions/:id",
  requirePermissions("service:update"),
  asyncHandler(updateDefinition)
);

router.get(
  "/bookings",
  requirePermissions("appointment:read"),
  asyncHandler(bookings)
);
router.post(
  "/bookings",
  requirePermissions("appointment:create"),
  asyncHandler(book)
);
router.get(
  "/bookings/:id",
  requirePermissions("appointment:read"),
  asyncHandler(getBooking)
);
router.post(
  "/bookings/:id/conversion",
  requirePermissions("appointment:update"),
  asyncHandler(conversion)
);

export default router;
