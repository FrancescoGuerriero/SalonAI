import {
  getMessageDeliverySchedulerStatus,
  restartMessageDeliveryScheduler,
  runMessageDeliverySchedulerCycle,
  startMessageDeliveryScheduler,
  stopMessageDeliveryScheduler,
} from "../services/messageDeliverySchedulerService.js";

function normaliseText(value) {
  return String(value ?? "").trim();
}

function normaliseBoolean(
  value,
  fallback = false
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalisedValue =
    normaliseText(value).toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "on",
      "enabled",
    ].includes(normalisedValue)
  ) {
    return true;
  }

  if (
    [
      "false",
      "0",
      "no",
      "off",
      "disabled",
    ].includes(normalisedValue)
  ) {
    return false;
  }

  return fallback;
}

function normaliseInteger(
  value,
  fallback,
  minimum,
  maximum
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      Math.floor(number)
    )
  );
}

function createControllerError(
  message,
  {
    statusCode = 400,
    code =
      "MESSAGE_DELIVERY_SCHEDULER_REQUEST_ERROR",
  } = {}
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;

  return error;
}

function getAuthenticatedUserId(
  request
) {
  return (
    request.user?._id ||
    request.user?.id ||
    null
  );
}

function parseDate(
  value,
  {
    fieldName,
    fallback = null,
  }
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw createControllerError(
      `${fieldName} must be a valid date.`,
      {
        code:
          "INVALID_SCHEDULER_DATE",
      }
    );
  }

  return date;
}

function buildCampaignDeliveryOptions(
  body
) {
  return {
    batchSize:
      normaliseInteger(
        body.batchSize,
        100,
        1,
        1000
      ),

    delayBetweenBatchesSeconds:
      normaliseInteger(
        body
          .delayBetweenBatchesSeconds,
        0,
        0,
        86400
      ),

    concurrency:
      normaliseInteger(
        body
          .recipientConcurrency,
        5,
        1,
        50
      ),

    maximumRecipients:
      normaliseInteger(
        body.maximumRecipients,
        10000,
        1,
        10000
      ),

    maximumAttempts:
      normaliseInteger(
        body.maximumAttempts,
        3,
        1,
        10
      ),

    retryDelayMs:
      normaliseInteger(
        body.retryDelayMs,
        5000,
        0,
        3600000
      ),

    deferRetries:
      normaliseBoolean(
        body.deferRetries,
        true
      ),

    consentRequired:
      normaliseBoolean(
        body.consentRequired,
        true
      ),

    excludeUnsubscribed:
      normaliseBoolean(
        body.excludeUnsubscribed,
        true
      ),
  };
}

function buildSchedulerOptions(
  request,
  {
    force = false,
    source = "management_api",
  } = {}
) {
  const body =
    request.body || {};

  return {
    force,

    enabled:
      normaliseBoolean(
        body.enabled,
        true
      ),

    intervalMs:
      normaliseInteger(
        body.intervalMs,
        60000,
        10000,
        86400000
      ),

    runImmediately:
      normaliseBoolean(
        body.runImmediately,
        true
      ),

    unrefTimer:
      normaliseBoolean(
        body.unrefTimer,
        true
      ),

    campaignLimit:
      normaliseInteger(
        body.campaignLimit,
        25,
        1,
        100
      ),

    campaignConcurrency:
      normaliseInteger(
        body.campaignConcurrency,
        2,
        1,
        10
      ),

    retryLimit:
      normaliseInteger(
        body.retryLimit,
        100,
        1,
        1000
      ),

    retryConcurrency:
      normaliseInteger(
        body.retryConcurrency,
        5,
        1,
        50
      ),

    dueBefore:
      parseDate(
        body.dueBefore,
        {
          fieldName:
            "dueBefore",

          fallback:
            new Date(),
        }
      ),

    source,

    userId:
      getAuthenticatedUserId(
        request
      ),

    campaignDeliveryOptions:
      buildCampaignDeliveryOptions(
        body
      ),
  };
}

async function getSchedulerStatus(
  request,
  response,
  next
) {
  try {
    const scheduler =
      getMessageDeliverySchedulerStatus();

    response.status(200).json({
      success: true,

      message:
        "Message-delivery scheduler status retrieved successfully.",

      scheduler,
    });
  } catch (error) {
    next(error);
  }
}

async function runSchedulerNow(
  request,
  response,
  next
) {
  try {
    const result =
      await runMessageDeliverySchedulerCycle(
        buildSchedulerOptions(
          request,
          {
            force: true,
            source:
              "manual_management_cycle",
          }
        )
      );

    const successful =
      result.success &&
      !result.skipped;

    response
      .status(
        successful
          ? 200
          : result.skipped
            ? 409
            : 207
      )
      .json({
        success:
          result.success,

        skipped:
          Boolean(
            result.skipped
          ),

        message:
          result.skipped
            ? result.reason
            : result.success
              ? "Message-delivery scheduler cycle completed successfully."
              : "Message-delivery scheduler cycle completed with one or more failures.",

        cycle: result,

        scheduler:
          getMessageDeliverySchedulerStatus(),
      });
  } catch (error) {
    next(error);
  }
}

async function startScheduler(
  request,
  response,
  next
) {
  try {
    const result =
      await startMessageDeliveryScheduler(
        buildSchedulerOptions(
          request,
          {
            force: true,
            source:
              "management_start",
          }
        )
      );

    response.status(200).json({
      success:
        result.success,

      started:
        Boolean(
          result.started
        ),

      alreadyRunning:
        Boolean(
          result.alreadyRunning
        ),

      message:
        result.message,

      initialCycle:
        result.initialCycle ||
        null,

      scheduler:
        result.scheduler,
    });
  } catch (error) {
    next(error);
  }
}

async function stopScheduler(
  request,
  response,
  next
) {
  try {
    const result =
      await stopMessageDeliveryScheduler(
        {
          waitForCycle:
            normaliseBoolean(
              request.body
                ?.waitForCycle,
              true
            ),
        }
      );

    response.status(200).json({
      success:
        result.success,

      message:
        result.message,

      scheduler:
        result.scheduler,
    });
  } catch (error) {
    next(error);
  }
}

async function restartScheduler(
  request,
  response,
  next
) {
  try {
    const options =
      buildSchedulerOptions(
        request,
        {
          force: true,
          source:
            "management_restart",
        }
      );

    options.waitForCycle =
      normaliseBoolean(
        request.body
          ?.waitForCycle,
        true
      );

    const result =
      await restartMessageDeliveryScheduler(
        options
      );

    response.status(200).json({
      success:
        result.success,

      started:
        Boolean(
          result.started
        ),

      message:
        result.message,

      initialCycle:
        result.initialCycle ||
        null,

      scheduler:
        result.scheduler,
    });
  } catch (error) {
    next(error);
  }
}

export {
  getSchedulerStatus,
  restartScheduler,
  runSchedulerNow,
  startScheduler,
  stopScheduler,
};