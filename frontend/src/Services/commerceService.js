import API from "../api/axios.js";

function data(response) {
  return response.data;
}

export const commerceService = {
  getConfig: () => API.get("/commerce/config").then(data),
  listProducts: (params = {}) =>
    API.get("/commerce/products", { params }).then(data),
  listInventoryProducts: (params = {}) =>
    API.get("/commerce/inventory/products", { params }).then(data),
  getProduct: (identifier) =>
    API.get(`/commerce/products/${identifier}`).then(data),
  createProduct: (payload) =>
    API.post("/commerce/products", payload).then(data),
  updateProduct: (id, payload) =>
    API.patch(`/commerce/products/${id}`, payload).then(data),
  adjustStock: (id, payload) =>
    API.post(`/commerce/products/${id}/stock-adjustments`, payload).then(data),
  inventorySummary: () =>
    API.get("/commerce/inventory/summary").then(data),
  createCheckout: (payload) =>
    API.post("/commerce/checkout", payload).then(data),
  confirmDemoCheckout: (orderId) =>
    API.post(`/commerce/checkout/${orderId}/confirm-demo`).then(data),
  listMyOrders: (params = {}) =>
    API.get("/commerce/orders/mine", { params }).then(data),
  getOrder: (id) =>
    API.get(`/commerce/orders/${id}`).then(data),
  cancelOrder: (id) =>
    API.post(`/commerce/orders/${id}/cancel`).then(data),
  listOrders: (params = {}) =>
    API.get("/commerce/orders", { params }).then(data),
  updateOrderStatus: (id, status) =>
    API.patch(`/commerce/orders/${id}/status`, { status }).then(data),
};

export default commerceService;
