import express from "express";

import asyncHandler from "../../../middleware/asyncHandler.js";
import {
  protect,
} from "../../../middleware/authMiddleware.js";
import {
  managementOnly,
} from "../../../middleware/roleMiddleware.js";

import {
  createSupplier,
  deactivateSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from "../controllers/supplierController.js";


const router = express.Router();

router.use(protect);
router.use(managementOnly);

router
  .route("/")
  .get(
    asyncHandler(
      listSuppliers
    )
  )
  .post(
    asyncHandler(
      createSupplier
    )
  );

router
  .route("/:supplierId")
  .get(
    asyncHandler(
      getSupplier
    )
  )
  .patch(
    asyncHandler(
      updateSupplier
    )
  )
  .delete(
    asyncHandler(
      deactivateSupplier
    )
  );

export default router;
