import API from "../api/axios.js";

export async function getTenantProductComposition() {
  const response = await API.get("/system-administration/tenant-product-composition");
  return response.data?.productComposition || null;
}

export default {
  getTenantProductComposition,
};
