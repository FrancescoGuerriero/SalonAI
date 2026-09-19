import { generateNoShowPredictions } from "./aiNoShowPredictionService.js";

const number = (value) =>
  value === undefined ||
  value === ""
    ? undefined
    : Number(value);

const boolean = (value) =>
  value === undefined ||
  value === ""
    ? undefined
    : [
        "true",
        "1",
        "yes",
        "on",
      ].includes(
        String(
          value
        ).toLowerCase()
      );

export function buildNoShowPredictionOptions(
  request
) {
  return {
    asOfDate:
      request.query
        ?.asOfDate,
    horizonDays:
      number(
        request.query
          ?.horizonDays
      ),
    highRiskThreshold:
      number(
        request.query
          ?.highRiskThreshold
      ),
    mediumRiskThreshold:
      number(
        request.query
          ?.mediumRiskThreshold
      ),
    includeRecommendations:
      boolean(
        request.query
          ?.includeRecommendations
      ),
    requestId:
      request.id ||
      request.headers?.[
        "x-request-id"
      ],
    actorUserId:
      request.user
        ?._id ||
      null,
    actorRole:
      request.user
        ?.role ||
      "",
  };
}

export async function getAiNoShowPredictions(
  request,
  response
) {
  const result =
    await generateNoShowPredictions(
      buildNoShowPredictionOptions(
        request
      )
    );

  return response
    .status(200)
    .json({
      success: true,
      message:
        "AI no-show predictions generated successfully.",
      ...result,
    });
}

export default {
  buildNoShowPredictionOptions,
  getAiNoShowPredictions,
};
