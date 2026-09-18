import { Router } from "express";
import {
  createItem,
  deleteItem,
  listItems,
  updateItem,
} from "./inventoryController.js";
import {
  requireAnyPermission,
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";

const router = Router();

const readInventory =
  requireAnyPermission(
    "inventory:read",
    "inventory:manage"
  );

const manageInventory =
  requirePermissions(
    "inventory:manage"
  );

router.get(
  "/",
  readInventory,
  listItems
);

router.post(
  "/",
  manageInventory,
  createItem
);

router.patch(
  "/:itemId",
  manageInventory,
  updateItem
);

router.delete(
  "/:itemId",
  manageInventory,
  deleteItem
);

export default router;
