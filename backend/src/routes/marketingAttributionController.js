import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./loyaltyController.js";

const router = express.Router();

router.get(
  "/accounts/:customerId",
  asyncHandler(controller.account)
);

router.post(
  "/accounts/:customerId/transactions",
  asyncHandler(controller.transact)
);

router
  .route("/memberships")
  .get(
    asyncHandler(controller.listMemberships)
  )
  .post(
    asyncHandler(controller.createMembership)
  );

router.patch(
  "/memberships/:id",
  asyncHandler(controller.updateMembership)
);

export default router;
