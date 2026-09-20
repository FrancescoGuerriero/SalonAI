import API from "../api/axios.js";

const BASE_URL =
  "/retention-automation/journeys";

async function listRetentionJourneys() {
  const response =
    await API.get(BASE_URL);

  return {
    journeys:
      Array.isArray(
        response.data?.journeys
      )
        ? response.data.journeys
        : [],
  };
}

async function createRetentionJourney(
  payload
) {
  const response =
    await API.post(
      BASE_URL,
      payload
    );

  return response.data;
}


async function previewRetentionJourney(
  journeyId,
  {
    limit = 50,
  } = {}
) {
  const response =
    await API.get(
      BASE_URL +
        "/" +
        encodeURIComponent(
          journeyId
        ) +
        "/preview",
      {
        params: {
          limit,
        },
      }
    );

  return (
    response.data?.preview ||
    null
  );
}

async function updateRetentionJourney(
  journeyId,
  payload
) {
  const response =
    await API.patch(
      BASE_URL +
        "/" +
        encodeURIComponent(
          journeyId
        ),
      payload
    );

  return response.data;
}

export {
  createRetentionJourney,
  listRetentionJourneys,
  previewRetentionJourney,
  updateRetentionJourney,
};

export default {
  createRetentionJourney,
  listRetentionJourneys,
  updateRetentionJourney,
};
