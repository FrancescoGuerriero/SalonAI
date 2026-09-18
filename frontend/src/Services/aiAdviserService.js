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
};
