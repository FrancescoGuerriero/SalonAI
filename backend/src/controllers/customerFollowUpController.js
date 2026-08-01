import {
  getCustomerFollowUpSummary,
  listCustomerFollowUps,
  scheduleCustomerFollowUp,
} from "../services/customerFollowUpService.js";

function normaliseText(value) {
  return String(value ?? "").trim();
}

function normaliseInteger(
  value,
  fallback,
  minimum,
  maximum
) {
  const parsedValue = Number.parseInt(
    value,
    10
  );

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, parsedValue)
  );
}

function getAuthenticatedUser(request) {
  return request.user || null;
}

async function listFollowUps(
  request,
  response,
  next
) {
  try {
    const result =
      await listCustomerFollowUps(
        {
          page: normaliseInteger(
            request.query?.page,
            1,
            1,
            1000000
          ),

          limit: normaliseInteger(
            request.query?.limit,
            20,
            1,
            100
          ),

          state: normaliseText(
            request.query?.state
          ),

          search: normaliseText(
            request.query?.search
          ),

          customerId: normaliseText(
            request.query?.customerId
          ),

          type: normaliseText(
            request.query?.type
          ),
        },
        {
          viewer:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response.status(200).json({
      success: true,
      message:
        "Customer follow-ups retrieved successfully.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

async function getFollowUpSummary(
  request,
  response,
  next
) {
  try {
    const summary =
      await getCustomerFollowUpSummary({
        viewer:
          getAuthenticatedUser(
            request
          ),
      });

    return response.status(200).json({
      success: true,
      message:
        "Customer follow-up summary retrieved successfully.",
      summary,
    });
  } catch (error) {
    return next(error);
  }
}

async function scheduleFollowUp(
  request,
  response,
  next
) {
  try {
    const followUp =
      await scheduleCustomerFollowUp(
        request.params.noteId,
        request.body?.followUpAt,
        {
          actor:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response.status(200).json({
      success: true,
      message:
        "Customer follow-up scheduled successfully.",
      followUp,
    });
  } catch (error) {
    return next(error);
  }
}

export {
  getFollowUpSummary,
  listFollowUps,
  scheduleFollowUp,
};

export default {
  getFollowUpSummary,
  listFollowUps,
  scheduleFollowUp,
};
