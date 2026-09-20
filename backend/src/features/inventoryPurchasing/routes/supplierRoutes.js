import express from "express";

import asyncHandler from "../../../middleware/asyncHandler.js";
import {
  protect,
} from "../../../middleware/authMiddleware.js";
import {
  requireAnyPermission,
  requirePermissions,
} from "../../../middleware/permissionMiddleware.js";

import {
  createSupplier,
  deactivateSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from "../controllers/supplierController.js";


const router = express.Router();

const readInventory =
  requireAnyPermission(
    "inventory:read",
    "inventory:manage"
  );

const manageInventory =
  requirePermissions(
    "inventory:manage"
  );

router.use(protect);

router
  .route("/")
  .get(
    readInventory,
    asyncHandler(
      listSuppliers
    )
  )
  .post(
    manageInventory,
    asyncHandler(
      createSupplier
    )
  );

router
  .route("/:supplierId")
  .get(
    readInventory,
    asyncHandler(
      getSupplier
    )
  )
  .patch(
    manageInventory,
    asyncHandler(
      updateSupplier
    )
  )
  .delete(
    manageInventory,
    asyncHandler(
      deactivateSupplier
    )
  );

export default router;
