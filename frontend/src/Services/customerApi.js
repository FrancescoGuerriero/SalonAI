import api from "./api";

/*
|--------------------------------------------------------------------------
| Customers API
|--------------------------------------------------------------------------
*/

export const getCustomers = (params = {}) =>
  api.get("/customers", { params });

export const getCustomer = (id) =>
  api.get(`/customers/${id}`);

export const createCustomer = (customer) =>
  api.post("/customers", customer);

export const updateCustomer = (id, customer) =>
  api.put(`/customers/${id}`, customer);

export const archiveCustomer = (id) =>
  api.patch(`/customers/${id}/archive`);

export const restoreCustomer = (id) =>
  api.patch(`/customers/${id}/restore`);

export const deleteCustomer = (id) =>
  api.delete(`/customers/${id}`);