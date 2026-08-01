import {
  closeDailyClose,
  getDailyClose,
  listDailyCloseHistory,
  reopenDailyClose,
  saveDailyCloseDraft,
} from "../services/dailyCloseService.js";

export async function getDailyCloseSnapshot(request, response, next) {
  try {
    const result = await getDailyClose(request.query.date);

    return response.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getDailyCloseHistory(request, response, next) {
  try {
    const history = await listDailyCloseHistory(request.query);

    return response.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    return next(error);
  }
}

export async function saveDailyCloseDraftController(request, response, next) {
  try {
    const result = await saveDailyCloseDraft(
      request.body?.date,
      request.body,
      request.user
    );

    return response.status(200).json({
      success: true,
      message: "Daily closing draft saved.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function closeDailyCloseController(request, response, next) {
  try {
    const result = await closeDailyClose(
      request.body?.date,
      request.body,
      request.user
    );

    return response.status(200).json({
      success: true,
      message: "Business day closed successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function reopenDailyCloseController(request, response, next) {
  try {
    const result = await reopenDailyClose(
      request.body?.date,
      request.body,
      request.user
    );

    return response.status(200).json({
      success: true,
      message: "Business day reopened.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export default {
  closeDailyCloseController,
  getDailyCloseHistory,
  getDailyCloseSnapshot,
  reopenDailyCloseController,
  saveDailyCloseDraftController,
};
