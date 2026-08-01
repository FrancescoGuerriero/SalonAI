import {
  createInventoryItem,
  deleteInventoryItem,
  listInventoryItems,
  updateInventoryItem,
} from "./inventoryService.js";

async function listItems(request, response) {
  const analytics = await listInventoryItems(request.query);
  return response.status(200).json({ success: true, analytics });
}

async function createItem(request, response) {
  const item = await createInventoryItem(request.body);
  return response.status(201).json({ success: true, item });
}

async function updateItem(request, response) {
  const item = await updateInventoryItem(request.params.itemId, request.body);
  return response.status(200).json({ success: true, item });
}

async function deleteItem(request, response) {
  const item = await deleteInventoryItem(request.params.itemId);
  return response.status(200).json({ success: true, item });
}

export { createItem, deleteItem, listItems, updateItem };
