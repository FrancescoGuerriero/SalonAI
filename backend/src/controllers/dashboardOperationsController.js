import dashboardOperationsService from "../services/dashboardOperationsService.js";

class DashboardOperationsController {
  async getSnapshot(
    request,
    response,
    next
  ) {
    try {
      const data =
        await dashboardOperationsService.getSnapshot();

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
}

export default new DashboardOperationsController();