import API from "../api/axios.js";

export async function askSalonAiAdviser({
  question,
  contextPath,
  periodDays = 30,
}) {
  const response =
    await API.post(
      "/ai/adviser/query",
      {
        question,
        contextPath,
        periodDays,
      }
    );

  return (
    response?.data ||
    response
  );
}

export default {
  ask:
    askSalonAiAdviser,
  feedback:
    submitSalonAiAdviserFeedback,
  evaluation:
    getSalonAiAdviserEvaluation,
};

export async function submitSalonAiAdviserFeedback({
  inferenceId,
  rating,
  comment = "",
}) {
  const response =
    await API.patch(
      `/ai/adviser/inferences/${inferenceId}/feedback`,
      {
        rating,
        comment,
      }
    );

  return (
    response?.data ||
    response
  );
}

export async function getSalonAiAdviserEvaluation({
  periodDays = 30,
} = {}) {
  const response =
    await API.get(
      "/ai/adviser/evaluation",
      {
        params: {
          periodDays,
        },
      }
    );

  return (
    response?.data
      ?.evaluation ||
    response?.evaluation ||
    response?.data ||
    response
  );
}
