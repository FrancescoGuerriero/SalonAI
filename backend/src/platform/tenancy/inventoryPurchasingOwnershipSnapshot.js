import Business from "../../models/Business.js";
import Location from "../../models/Location.js";
import Product from "../../features/commerce/Product.js";
import Supplier from "../../features/inventoryPurchasing/models/Supplier.js";
import SupplierProduct from "../../features/inventoryPurchasing/models/SupplierProduct.js";
import PurchaseOrder from "../../features/inventoryPurchasing/models/PurchaseOrder.js";

import {
  buildInventoryPurchasingOwnershipPlan,
} from "./inventoryPurchasingOwnershipMigration.js";

function querySession(query, session) {
  return session ? query.session(session) : query;
}

export async function resolveCanonicalInventoryPurchasingOwnership({
  configuration,
  session = null,
} = {}) {
  if (!configuration?.business?.slug || !configuration?.location?.slug) {
    throw new Error("Canonical inventory/purchasing tenant configuration is required.");
  }

  const business = await querySession(
    Business.findOne({ slug: configuration.business.slug })
      .select("_id slug businessType status"),
    session
  ).lean();

  if (!business) {
    throw new Error(
      "Canonical Business is missing. Complete tenant bootstrap before inventory/purchasing ownership work."
    );
  }

  const location = await querySession(
    Location.findOne({
      business: business._id,
      slug: configuration.location.slug,
      status: "active",
    }).select("_id business slug status"),
    session
  ).lean();

  if (!location) {
    throw new Error(
      "Canonical active primary Location is missing. Complete tenant bootstrap before inventory/purchasing ownership work."
    );
  }

  return Object.freeze({ business, location });
}

export async function loadInventoryPurchasingOwnershipSnapshot({
  configuration,
  session = null,
  includeIndexes = false,
} = {}) {
  const { business, location } = await resolveCanonicalInventoryPurchasingOwnership({
    configuration,
    session,
  });

  const [products, suppliers, supplierProducts, purchaseOrders] = await Promise.all([
    querySession(
      Product.find({})
        .sort({ _id: 1 })
        .select("_id business location slug sku"),
      session
    ).lean(),
    querySession(
      Supplier.find({}).sort({ _id: 1 }).select("_id business location code"),
      session
    ).lean(),
    querySession(
      SupplierProduct.find({})
        .sort({ _id: 1 })
        .select("_id business location supplier product"),
      session
    ).lean(),
    querySession(
      PurchaseOrder.find({})
        .sort({ _id: 1 })
        .select("_id business location supplier orderNumber"),
      session
    ).lean(),
  ]);

  const plan = buildInventoryPurchasingOwnershipPlan({
    business,
    location,
    products,
    suppliers,
    supplierProducts,
    purchaseOrders,
  });

  let productIndexes = [];
  let supplierIndexes = [];
  let purchaseOrderIndexes = [];
  if (includeIndexes && !session) {
    [productIndexes, supplierIndexes, purchaseOrderIndexes] = await Promise.all([
      Product.collection.indexes().catch(() => []),
      Supplier.collection.indexes().catch(() => []),
      PurchaseOrder.collection.indexes().catch(() => []),
    ]);
  }

  return Object.freeze({
    business,
    location,
    products: Object.freeze([...products]),
    suppliers: Object.freeze([...suppliers]),
    supplierProducts: Object.freeze([...supplierProducts]),
    purchaseOrders: Object.freeze([...purchaseOrders]),
    plan,
    indexes: Object.freeze({
      products: Object.freeze([...productIndexes]),
      suppliers: Object.freeze([...supplierIndexes]),
      purchaseOrders: Object.freeze([...purchaseOrderIndexes]),
    }),
  });
}

export default {
  resolveCanonicalInventoryPurchasingOwnership,
  loadInventoryPurchasingOwnershipSnapshot,
};
