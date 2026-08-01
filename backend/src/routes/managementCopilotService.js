import InventoryItem from "./InventoryItem.js";

import {
  addDays,
  clampInteger,
  roundMoney,
  roundNumber,
} from "../shared/analyticsUtils.js";

function finaliseInventoryItem(item) {
  const quantityOnHand = Number(item.quantityOnHand || 0);
  const averageDailyUsage = Number(item.averageDailyUsage || 0);
  const leadTimeDays = Number(item.leadTimeDays || 0);
  const reorderPoint = Number(item.reorderPoint || 0);
  const daysOfCover =
    averageDailyUsage > 0 ? quantityOnHand / averageDailyUsage : null;
  const projectedStockOutAt =
    daysOfCover === null ? null : addDays(new Date(), Math.floor(daysOfCover));
  const leadTimeDemand = averageDailyUsage * leadTimeDays;
  const recommendedReorderPoint = leadTimeDemand + Math.max(1, averageDailyUsage * 3);
  const shouldReorder =
    quantityOnHand <= reorderPoint ||
    (daysOfCover !== null && daysOfCover <= leadTimeDays + 3);

  return {
    ...item,
    quantityOnHand: roundNumber(quantityOnHand, 2),
    unitCost: roundMoney(item.unitCost),
    retailPrice: roundMoney(item.retailPrice),
    inventoryValue: roundMoney(quantityOnHand * Number(item.unitCost || 0)),
    daysOfCover: daysOfCover === null ? null : roundNumber(daysOfCover, 1),
    projectedStockOutAt: projectedStockOutAt?.toISOString() || null,
    leadTimeDemand: roundNumber(leadTimeDemand, 2),
    recommendedReorderPoint: roundNumber(recommendedReorderPoint, 2),
    shouldReorder,
    urgency:
      quantityOnHand <= 0
        ? "out_of_stock"
        : shouldReorder
          ? "reorder_now"
          : daysOfCover !== null && daysOfCover <= 30
            ? "watch"
            : "healthy",
  };
}

async function listInventoryItems({ active, search, limit = 200 } = {}) {
  const query = {};

  if (active === "true") query.active = true;
  if (active === "false") query.active = false;
  if (String(search || "").trim()) {
    const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { sku: { $regex: escaped, $options: "i" } },
      { category: { $regex: escaped, $options: "i" } },
    ];
  }

  const items = await InventoryItem.find(query)
    .sort({ active: -1, name: 1 })
    .limit(clampInteger(limit, 1, 1000, 200))
    .lean();

  const forecast = items.map(finaliseInventoryItem);

  return {
    summary: {
      itemCount: forecast.length,
      activeItems: forecast.filter((item) => item.active).length,
      reorderNow: forecast.filter((item) => item.urgency === "reorder_now").length,
      outOfStock: forecast.filter((item) => item.urgency === "out_of_stock").length,
      inventoryValue: roundMoney(
        forecast.reduce((total, item) => total + item.inventoryValue, 0)
      ),
    },
    items: forecast,
  };
}

async function createInventoryItem(payload) {
  const item = await InventoryItem.create({
    sku: String(payload?.sku || "").trim().toUpperCase(),
    name: String(payload?.name || "").trim(),
    category: String(payload?.category || "General").trim(),
    supplier: String(payload?.supplier || "").trim(),
    unit: String(payload?.unit || "unit").trim(),
    quantityOnHand: Number(payload?.quantityOnHand || 0),
    reorderPoint: Number(payload?.reorderPoint || 5),
    reorderQuantity: Number(payload?.reorderQuantity || 10),
    averageDailyUsage: Number(payload?.averageDailyUsage || 0),
    leadTimeDays: Number(payload?.leadTimeDays || 7),
    unitCost: Number(payload?.unitCost || 0),
    retailPrice: Number(payload?.retailPrice || 0),
    active: payload?.active !== false,
    lastRestockedAt:
      Number(payload?.quantityOnHand || 0) > 0 ? new Date() : null,
  });

  return finaliseInventoryItem(item.toObject());
}

async function updateInventoryItem(itemId, payload) {
  const item = await InventoryItem.findById(itemId);

  if (!item) {
    const error = new Error("Inventory item not found.");
    error.statusCode = 404;
    throw error;
  }

  const editableFields = [
    "sku",
    "name",
    "category",
    "supplier",
    "unit",
    "quantityOnHand",
    "reorderPoint",
    "reorderQuantity",
    "averageDailyUsage",
    "leadTimeDays",
    "unitCost",
    "retailPrice",
    "active",
  ];

  const previousQuantity = item.quantityOnHand;

  for (const field of editableFields) {
    if (payload?.[field] !== undefined) {
      item[field] = payload[field];
    }
  }

  if (Number(item.quantityOnHand) > Number(previousQuantity)) {
    item.lastRestockedAt = new Date();
  }

  await item.save();
  return finaliseInventoryItem(item.toObject());
}

async function deleteInventoryItem(itemId) {
  const item = await InventoryItem.findByIdAndDelete(itemId).lean();

  if (!item) {
    const error = new Error("Inventory item not found.");
    error.statusCode = 404;
    throw error;
  }

  return item;
}

export {
  createInventoryItem,
  deleteInventoryItem,
  listInventoryItems,
  updateInventoryItem,
};
