import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  oauthCallback,
} from "./calendarConnectionController.js";

const router = express.Router();

router.get(
  "/:provider/callback",
  asyncHandler(oauthCallback)
);

export default router;
