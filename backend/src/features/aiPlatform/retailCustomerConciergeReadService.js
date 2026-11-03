import mongoose from "mongoose";

import Product from "../commerce/Product.js";
import CustomerCommercePolicy from "../commerce/CustomerCommercePolicy.js";
import { createServiceError } from "../../shared/serviceError.js";
import { escapedRegex } from "../../shared/modelHelpers.js";

function requireBusinessId(value) {
  const businessId = String(value || "").trim();
  if (!mongoose.isValidObjectId(businessId)) {
    throw createServiceError("A valid trusted business is required for Retail concierge reads.", 400, {
      code: "RETAIL_CONCIERGE_BUSINESS_REQUIRED",
    });
  }
  return businessId;
}

function optionalLocationId(value) {
  const locationId = String(value || "").trim();
  if (!locationId) return null;
  if (!mongoose.isValidObjectId(locationId)) {
    throw createServiceError("location must be a valid identifier.", 400, {
      code: "RETAIL_CONCIERGE_LOCATION_INVALID",
    });
  }
  return locationId;
}

function scopeFilter({ businessId, locationId }) {
  const filter = { business: requireBusinessId(businessId) };
  const cleanLocationId = optionalLocationId(locationId);
  if (cleanLocationId) filter.location = cleanLocationId;
  return filter;
}

function cleanLimit(value, fallback = 8, maximum = 20) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(maximum, parsed);
}

export async function readRetailProductCatalogue(
  { businessId, locationId, search = "", category = "", limit = 8 } = {}
) {
  const filter = {
    ...scopeFilter({ businessId, locationId }),
    active: true,
  };

  const cleanSearch = String(search || "").trim().slice(0, 120);
  const cleanCategory = String(category || "").trim().slice(0, 120);
  if (cleanCategory) filter.category = cleanCategory;
  if (cleanSearch) {
    const expression = escapedRegex(cleanSearch);
    filter.$or = [
      { name: expression },
      { sku: expression },
      { brand: expression },
      { description: expression },
      { category: expression },
      { collectionName: expression },
    ];
  }

  const items = await Product.find(filter)
    .select("name slug sku brand description category collectionName badge size price stockQuantity images featured")
    .sort({ featured: -1, name: 1 })
    .limit(cleanLimit(limit))
    .lean();

  return items.map((item) => ({
    id: String(item._id),
    name: item.name,
    slug: item.slug,
    sku: item.sku,
    brand: item.brand,
    description: item.description,
    category: item.category,
    collectionName: item.collectionName,
    badge: item.badge,
    size: item.size,
    price: item.price,
    inStock: Number(item.stockQuantity || 0) > 0,
    image: Array.isArray(item.images) && item.images.length ? item.images[0] : "",
    featured: Boolean(item.featured),
  }));
}

export async function readRetailCustomerPolicy(
  { businessId, locationId, policyType, at = new Date() } = {}
) {
  const cleanPolicyType = String(policyType || "").trim().toLowerCase();
  if (!["delivery", "returns"].includes(cleanPolicyType)) {
    throw createServiceError("Retail customer policy type must be delivery or returns.", 400, {
      code: "RETAIL_CONCIERGE_POLICY_TYPE_INVALID",
    });
  }

  const scoped = scopeFilter({ businessId, locationId });
  const effectiveAt = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(effectiveAt.getTime())) {
    throw createServiceError("Policy effective date is invalid.", 400, {
      code: "RETAIL_CONCIERGE_POLICY_DATE_INVALID",
    });
  }

  const common = {
    business: scoped.business,
    policyType: cleanPolicyType,
    published: true,
    $and: [
      { $or: [{ effectiveFrom: null }, { effectiveFrom: { $lte: effectiveAt } }] },
      { $or: [{ effectiveTo: null }, { effectiveTo: { $gt: effectiveAt } }] },
    ],
  };

  let policy = null;
  if (scoped.location) {
    policy = await CustomerCommercePolicy.findOne({ ...common, location: scoped.location })
      .sort({ effectiveFrom: -1, updatedAt: -1 })
      .lean();
  }
  if (!policy) {
    policy = await CustomerCommercePolicy.findOne({
      ...common,
      $or: [{ location: { $exists: false } }, { location: null }],
    })
      .sort({ effectiveFrom: -1, updatedAt: -1 })
      .lean();
  }

  if (!policy) {
    throw createServiceError(`No published ${cleanPolicyType} policy is configured for this business.`, 404, {
      code: "RETAIL_CONCIERGE_POLICY_NOT_CONFIGURED",
      policyType: cleanPolicyType,
    });
  }

  return {
    policyType: policy.policyType,
    title: policy.title,
    summary: policy.summary,
    content: policy.content,
    effectiveFrom: policy.effectiveFrom || null,
    effectiveTo: policy.effectiveTo || null,
  };
}

export function retailOrderStatusReadiness() {
  return Object.freeze({
    ready: false,
    code: "RETAIL_ORDER_SCOPE_NOT_READY",
    reason:
      "Canonical Order records do not yet carry trusted Business/Location ownership. order.status.read must remain unavailable until Commerce order tenancy is reconciled and backfilled through a controlled migration.",
  });
}

export default {
  readRetailCustomerPolicy,
  readRetailProductCatalogue,
  retailOrderStatusReadiness,
};
