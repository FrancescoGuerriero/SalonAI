import express from "express";

import asyncHandler from "../../../middleware/asyncHandler.js";
import {
  protect,
} from "../../../middleware/authMiddleware.js";
import {
  managementOnly,
} from "../../../middleware/roleMiddleware.js";

import {
  approvePurchaseOrderHandler,
  cancelPurchaseOrderHandler,
  createPurchaseOrderHandler,
  getPurchaseOrder,
  listPurchaseOrders,
  receivePurchaseOrderHandler,
  submitPurchaseOrderHandler,
  updatePurchaseOrder,
} from "../controllers/purchaseOrderController.js";


const router = express.Router();

router.use(protect);
router.use(managementOnly);

router
  .route("/")
  .get(
    asyncHandler(
      listPurchaseOrders
    )
  )
  .post(
    asyncHandler(
      createPurchaseOrderHandler
    )
  );

router
  .route("/:purchaseOrderId")
  .get(
    asyncHandler(
      getPurchaseOrder
    )
  )
  .patch(
    asyncHandler(
      updatePurchaseOrder
    )
  );

router.post(
  "/:purchaseOrderId/submit",
  asyncHandler(
    submitPurchaseOrderHandler
  )
);

router.post(
  "/:purchaseOrderId/approve",
  asyncHandler(
    approvePurchaseOrderHandler
  )
);

router.post(
  "/:purchaseOrderId/cancel",
  asyncHandler(
    cancelPurchaseOrderHandler
  )
);

router.post(
  "/:purchaseOrderId/receive",
  asyncHandler(
    receivePurchaseOrderHandler
  )
);

export default router;
