import {
  Router,
} from "express";

import {
  getRebookingOpportunities,
} from "./rebookingOpportunityController.js";

const router =
  Router();

router.get(
  "/",
  getRebookingOpportunities
);

export default router;