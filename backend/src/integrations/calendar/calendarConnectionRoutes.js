import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  calendars,
  listConnections,
  removeConnection,
  startConnection,
  updateCalendar,
  updateSync,
} from "./calendarConnectionController.js";

const router = express.Router();

router.get(
  "/",
  asyncHandler(listConnections)
);

router.post(
  "/:provider/connect",
  asyncHandler(startConnection)
);

router.get(
  "/:provider/calendars",
  asyncHandler(calendars)
);

router.patch(
  "/:provider/calendar",
  asyncHandler(updateCalendar)
);

router.patch(
  "/:provider/sync",
  asyncHandler(updateSync)
);

router.delete(
  "/:provider",
  asyncHandler(removeConnection)
);

export default router;
