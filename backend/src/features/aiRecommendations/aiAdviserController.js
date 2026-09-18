import {
  askSalonAiAdviser,
} from "./aiAdviserService.js";

export async function askAdviser(
  request,
  response
) {
  const result =
    await askSalonAiAdviser({
      question:
        request.body
          ?.question,
      contextPath:
        request.body
          ?.contextPath,
      periodDays:
        Number(
          request.body
            ?.periodDays
        ) || 30,
      user:
        request.user,
      requestId:
        request.id ||
        request.requestId ||
        request.headers?.[
          "x-request-id"
        ],
    });

  return response
    .status(200)
    .json({
      success: true,
      ...result,
    });
}

export default {
  askAdviser,
};
