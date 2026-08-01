import {
  getCustomerOperations,
} from "../services/customerOperationsService.js";

export async function getCustomerOperationsSummary(
  request,
  response,
  next
) {
  try {
    const data =
      await getCustomerOperations(
        request.params.customerId
      );

    return response
      .status(200)
      .json({
        success: true,
        data,
      });
  } catch (error) {
    return next(error);
  }
}

export default {
  getCustomerOperationsSummary,
};