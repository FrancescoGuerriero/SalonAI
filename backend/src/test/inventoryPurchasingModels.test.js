import assert from "node:assert/strict";
import test from "node:test";

import PurchaseOrder from "../features/inventoryPurchasing/models/PurchaseOrder.js";
import Supplier from "../features/inventoryPurchasing/models/Supplier.js";
import SupplierProduct from "../features/inventoryPurchasing/models/SupplierProduct.js";


test(
  "Supplier model is registered",
  () => {
    assert.equal(
      Supplier.modelName,
      "Supplier"
    );
  }
);


test(
  "SupplierProduct model is registered",
  () => {
    assert.equal(
      SupplierProduct.modelName,
      "SupplierProduct"
    );
  }
);


test(
  "PurchaseOrder calculates totals",
  async () => {
    const order =
      new PurchaseOrder({
        orderNumber:
          "PO-TEST-001",
        supplier:
          "507f1f77bcf86cd799439011",
        items: [
          {
            product:
              "507f191e810c19729de860ea",
            productName:
              "Shampoo",
            orderedQuantity: 10,
            unitCost: 5,
            vatRate: 20,
          },
        ],
      });

    await order.validate();

    assert.equal(
      order.subtotal,
      50
    );

    assert.equal(
      order.vatTotal,
      10
    );

    assert.equal(
      order.total,
      60
    );
  }
);
