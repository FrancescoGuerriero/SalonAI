import API from "../api/axios.js";


export async function getSuppliers(
  params = {}
) {
  const response =
    await API.get(
      "/suppliers",
      {
        params,
      }
    );

  return response.data;
}


export async function createSupplier(
  payload
) {
  const response =
    await API.post(
      "/suppliers",
      payload
    );

  return response.data;
}


export async function updateSupplier(
  supplierId,
  payload
) {
  const response =
    await API.patch(
      `/suppliers/${supplierId}`,
      payload
    );

  return response.data;
}


export async function deactivateSupplier(
  supplierId
) {
  const response =
    await API.delete(
      `/suppliers/${supplierId}`
    );

  return response.data;
}


export async function getPurchaseOrders(
  params = {}
) {
  const response =
    await API.get(
      "/purchase-orders",
      {
        params,
      }
    );

  return response.data;
}


export async function getPurchaseOrder(
  purchaseOrderId
) {
  const response =
    await API.get(
      `/purchase-orders/${purchaseOrderId}`
    );

  return response.data;
}


export async function createPurchaseOrder(
  payload
) {
  const response =
    await API.post(
      "/purchase-orders",
      payload
    );

  return response.data;
}


export async function submitPurchaseOrder(
  purchaseOrderId
) {
  const response =
    await API.post(
      `/purchase-orders/${purchaseOrderId}/submit`
    );

  return response.data;
}


export async function approvePurchaseOrder(
  purchaseOrderId
) {
  const response =
    await API.post(
      `/purchase-orders/${purchaseOrderId}/approve`
    );

  return response.data;
}


export async function cancelPurchaseOrder(
  purchaseOrderId,
  reason
) {
  const response =
    await API.post(
      `/purchase-orders/${purchaseOrderId}/cancel`,
      {
        reason,
      }
    );

  return response.data;
}


export async function receivePurchaseOrder(
  purchaseOrderId,
  payload
) {
  const response =
    await API.post(
      `/purchase-orders/${purchaseOrderId}/receive`,
      payload
    );

  return response.data;
}


export async function getReorderRecommendations() {
  const response =
    await API.get(
      "/inventory-purchasing/reorder-recommendations"
    );

  return response.data;
}


export async function getSupplierPerformance() {
  const response =
    await API.get(
      "/inventory-purchasing/supplier-performance"
    );

  return response.data;
}


export default {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  createSupplier,
  deactivateSupplier,
  getPurchaseOrder,
  getPurchaseOrders,
  getReorderRecommendations,
  getSupplierPerformance,
  getSuppliers,
  receivePurchaseOrder,
  submitPurchaseOrder,
  updateSupplier,
};
