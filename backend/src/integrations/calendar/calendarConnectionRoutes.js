import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  listConnections,
  removeConnection,
  startConnection,
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

router.patch(
  "/:provider/sync",
  asyncHandler(updateSync)
);

router.delete(
  "/:provider",
  asyncHandler(removeConnection)
);

export default router;
