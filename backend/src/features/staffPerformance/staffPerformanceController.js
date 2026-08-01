import {
  assignRetailOrder,
  generateStaffPerformance,
  removeRetailOrderAttribution,
  upsertStaffCompensationPlan,
} from "./staffPerformanceService.js";

function readQueryValue(request, key) {
  const value = request.query?.[key];
  return Array.isArray(value) ? value[0] : value;
}

async function getStaffPerformance(request, response, next) {
  try {
    const analytics = await generateStaffPerformance({
      months: readQueryValue(request, "months"),
    });

    return response.status(200).json({
      success: true,
      analytics,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateStaffCompensationPlan(request, response, next) {
  try {
    const plan = await upsertStaffCompensationPlan(
      request.params.stylistId,
      request.body,
      request.user
    );

    return response.status(200).json({
      success: true,
      message: "Staff commission plan and targets were saved.",
      plan,
    });
  } catch (error) {
    return next(error);
  }
}

async function assignRetailSale(request, response, next) {
  try {
    const attribution = await assignRetailOrder(
      request.params.orderId,
      request.body?.stylistId,
      request.user,
      request.body?.notes
    );

    return response.status(200).json({
      success: true,
      message: "Retail sale was attributed to the selected stylist.",
      attribution,
    });
  } catch (error) {
    return next(error);
  }
}

async function unassignRetailSale(request, response, next) {
  try {
    const result = await removeRetailOrderAttribution(request.params.orderId);

    return response.status(200).json({
      success: true,
      message: "Retail sale attribution was removed.",
      result,
    });
  } catch (error) {
    return next(error);
  }
}

export {
  assignRetailSale,
  getStaffPerformance,
  unassignRetailSale,
  updateStaffCompensationPlan,
};
