import { Router } from "express";
import {
  createItem,
  deleteItem,
  listItems,
  updateItem,
} from "./inventoryController.js";

const router = Router();
router.get("/", listItems);
router.post("/", createItem);
router.patch("/:itemId", updateItem);
router.delete("/:itemId", deleteItem);
export default router;
