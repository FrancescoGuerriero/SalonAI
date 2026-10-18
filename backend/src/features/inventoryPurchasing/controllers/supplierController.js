import mongoose from "mongoose";

import Supplier from "../models/Supplier.js";
import SupplierProduct from "../models/SupplierProduct.js";
import {
  inventoryLocationFilter,
  resolveInventoryAuthority,
  stripInventoryOwnershipInput,
} from "../services/ownershipScope.js";

function notFound(message = "Supplier not found.") {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function objectId(value) {
  const text = String(value || "").trim();
  if (!mongoose.Types.ObjectId.isValid(text)) throw notFound();
  return new mongoose.Types.ObjectId(text);
}

function supplierScope(request) {
  return inventoryLocationFilter(request.effectiveAuthority, {
    includeBusinessWide: true,
  });
}

export async function listSuppliers(request, response) {
  const query = { ...supplierScope(request) };

  if (request.query.active !== undefined) {
    const active = String(request.query.active).trim().toLowerCase();
    if (!["true", "false"].includes(active)) {
      const error = new Error("active must be true or false.");
      error.statusCode = 422;
      throw error;
    }
    query.active = active === "true";
  }

  const search = String(request.query.search || "").trim().slice(0, 200);
  if (search) {
    query.$text = { $search: search };
  }

  const suppliers = await Supplier.find(query)
    .sort({ preferred: -1, name: 1 })
    .lean();

  response.status(200).json({ success: true, suppliers });
}

export async function createSupplier(request, response) {
  const safePayload = stripInventoryOwnershipInput(request.body);
  const authority = resolveInventoryAuthority(request.effectiveAuthority);

  const supplier = await Supplier.create({
    ...safePayload,
    business: authority.businessId,
    ...(authority.selectedLocationId
      ? { location: authority.selectedLocationId }
      : {}),
  });

  response.status(201).json({ success: true, supplier });
}

export async function getSupplier(request, response) {
  const supplierId = objectId(request.params.supplierId);
  const scope = supplierScope(request);
  const supplier = await Supplier.findOne({ ...scope, _id: supplierId }).lean();

  if (!supplier) throw notFound();

  const products = await SupplierProduct.find({
    ...scope,
    supplier: supplier._id,
  })
    .populate("product")
    .sort({ preferred: -1, createdAt: -1 })
    .lean();

  response.status(200).json({ success: true, supplier, products });
}

export async function updateSupplier(request, response) {
  const supplierId = objectId(request.params.supplierId);
  const supplier = await Supplier.findOneAndUpdate(
    { ...supplierScope(request), _id: supplierId },
    stripInventoryOwnershipInput(request.body),
    { new: true, runValidators: true }
  );

  if (!supplier) throw notFound();

  response.status(200).json({ success: true, supplier });
}

export async function deactivateSupplier(request, response) {
  const supplierId = objectId(request.params.supplierId);
  const supplier = await Supplier.findOneAndUpdate(
    { ...supplierScope(request), _id: supplierId },
    { active: false },
    { new: true }
  );

  if (!supplier) throw notFound();

  response.status(200).json({ success: true, supplier });
}
