import Supplier from "../models/Supplier.js";
import SupplierProduct from "../models/SupplierProduct.js";


export async function listSuppliers(
  request,
  response
) {
  const query = {};

  if (
    request.query.active !==
    undefined
  ) {
    query.active =
      request.query.active !==
      "false";
  }

  if (request.query.search) {
    query.$text = {
      $search:
        request.query.search,
    };
  }

  const suppliers =
    await Supplier.find(query)
      .sort({
        preferred: -1,
        name: 1,
      })
      .lean();

  response.status(200).json({
    success: true,
    suppliers,
  });
}


export async function createSupplier(
  request,
  response
) {
  const supplier =
    await Supplier.create(
      request.body
    );

  response.status(201).json({
    success: true,
    supplier,
  });
}


export async function getSupplier(
  request,
  response
) {
  const supplier =
    await Supplier.findById(
      request.params.supplierId
    ).lean();

  if (!supplier) {
    const error = new Error(
      "Supplier not found."
    );

    error.statusCode = 404;
    throw error;
  }

  const products =
    await SupplierProduct.find({
      supplier: supplier._id,
    })
      .populate("product")
      .sort({
        preferred: -1,
        createdAt: -1,
      })
      .lean();

  response.status(200).json({
    success: true,
    supplier,
    products,
  });
}


export async function updateSupplier(
  request,
  response
) {
  const supplier =
    await Supplier.findByIdAndUpdate(
      request.params.supplierId,
      request.body,
      {
        new: true,
        runValidators: true,
      }
    );

  if (!supplier) {
    const error = new Error(
      "Supplier not found."
    );

    error.statusCode = 404;
    throw error;
  }

  response.status(200).json({
    success: true,
    supplier,
  });
}


export async function deactivateSupplier(
  request,
  response
) {
  const supplier =
    await Supplier.findByIdAndUpdate(
      request.params.supplierId,
      {
        active: false,
      },
      {
        new: true,
      }
    );

  if (!supplier) {
    const error = new Error(
      "Supplier not found."
    );

    error.statusCode = 404;
    throw error;
  }

  response.status(200).json({
    success: true,
    supplier,
  });
}
