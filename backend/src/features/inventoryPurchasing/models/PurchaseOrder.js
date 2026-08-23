import mongoose from "mongoose";

const purchaseOrderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    supplierProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierProduct",
    },
    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },
    sku: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    orderedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    receivedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    damagedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    vatRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 20,
    },
    lineSubtotal: {
      type: Number,
      min: 0,
      default: 0,
    },
    lineVat: {
      type: Number,
      min: 0,
      default: 0,
    },
    lineTotal: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    _id: true,
  }
);

const goodsReceiptItemSchema = new mongoose.Schema(
  {
    purchaseOrderItem: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    receivedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    damagedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    _id: true,
  }
);

const goodsReceiptSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    receivedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deliveryReference: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    supplierInvoiceReference: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    items: {
      type: [goodsReceiptItemSchema],
      default: [],
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      maxlength: 80,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "draft",
        "submitted",
        "approved",
        "partially_received",
        "received",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    currency: {
      type: String,
      default: "GBP",
      uppercase: true,
      trim: true,
      maxlength: 3,
    },
    items: {
      type: [purchaseOrderItemSchema],
      validate: {
        validator(items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: "At least one purchase-order item is required.",
      },
    },
    subtotal: {
      type: Number,
      min: 0,
      default: 0,
    },
    vatTotal: {
      type: Number,
      min: 0,
      default: 0,
    },
    total: {
      type: Number,
      min: 0,
      default: 0,
    },
    expectedDeliveryDate: {
      type: Date,
    },
    submittedAt: {
      type: Date,
    },
    approvedAt: {
      type: Date,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    receivedAt: {
      type: Date,
    },
    supplierInvoiceReference: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    deliveryReference: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    goodsReceipts: {
      type: [goodsReceiptSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

purchaseOrderSchema.pre(
  "validate",
  function calculateTotals() {
    let subtotal = 0;
    let vatTotal = 0;

    for (const item of this.items || []) {
      item.lineSubtotal =
        Number(item.orderedQuantity || 0) *
        Number(item.unitCost || 0);

      item.lineVat =
        item.lineSubtotal *
        (Number(item.vatRate || 0) / 100);

      item.lineTotal =
        item.lineSubtotal +
        item.lineVat;

      subtotal += item.lineSubtotal;
      vatTotal += item.lineVat;
    }

    this.subtotal = subtotal;
    this.vatTotal = vatTotal;
    this.total = subtotal + vatTotal;


  }
);

purchaseOrderSchema.index({
  supplier: 1,
  status: 1,
  createdAt: -1,
});

const PurchaseOrder =
  mongoose.models.PurchaseOrder ||
  mongoose.model(
    "PurchaseOrder",
    purchaseOrderSchema
  );

export default PurchaseOrder;
