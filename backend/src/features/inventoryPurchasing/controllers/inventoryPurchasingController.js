import Supplier from "../models/Supplier.js";

import {
  getReorderRecommendations,
} from "../services/reorderService.js";


export async function listReorderRecommendations(
  request,
  response
) {
  const recommendations =
    await getReorderRecommendations();

  response.status(200).json({
    success: true,
    recommendations,
  });
}


export async function getSupplierPerformance(
  request,
  response
) {
  const suppliers =
    await Supplier.find({
      active: true,
    })
      .select(
        "name code preferred performance"
      )
      .sort({
        preferred: -1,
        "performance.averageDeliveryDays": 1,
      })
      .lean();

  const performance =
    suppliers.map(
      (supplier) => {
        const received =
          supplier.performance
            ?.receivedUnits || 0;

        const damaged =
          supplier.performance
            ?.damagedUnits || 0;

        const completed =
          supplier.performance
            ?.completedOrders || 0;

        const late =
          supplier.performance
            ?.lateDeliveries || 0;

        const damageRate =
          received > 0
            ? damaged / received
            : 0;

        const onTimeRate =
          completed > 0
            ? Math.max(
                0,
                1 - late / completed
              )
            : 1;

        const reliabilityScore =
          Math.round(
            (
              onTimeRate * 0.7 +
              (1 - damageRate) * 0.3
            ) *
            100
          );

        return {
          ...supplier,
          damageRate,
          onTimeRate,
          reliabilityScore,
        };
      }
    );

  response.status(200).json({
    success: true,
    performance,
  });
}
