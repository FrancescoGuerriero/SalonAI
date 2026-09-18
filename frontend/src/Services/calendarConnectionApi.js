import API from "../api/axios.js";

const BASE_URL =
  "/future/calendar-connections";

function data(response) {
  return response.data;
}

export function listCalendarConnections() {
  return API.get(
    BASE_URL
  ).then(data);
}

export function startCalendarConnection(
  provider
) {
  return API.post(
    `${BASE_URL}/${provider}/connect`
  ).then(data);
}

export function listProviderCalendars(
  provider
) {
  return API.get(
    `${BASE_URL}/${provider}/calendars`
  ).then(data);
}

export function selectProviderCalendar(
  provider,
  calendarId
) {
  return API.patch(
    `${BASE_URL}/${provider}/calendar`,
    {
      calendarId,
    }
  ).then(data);
}

export function setCalendarSync(
  provider,
  enabled
) {
  return API.patch(
    `${BASE_URL}/${provider}/sync`,
    {
      enabled:
        enabled === true,
    }
  ).then(data);
}

export function disconnectCalendar(
  provider
) {
  return API.delete(
    `${BASE_URL}/${provider}`
  ).then(data);
}

export default {
  list: listCalendarConnections,
  connect:
    startCalendarConnection,
  calendars:
    listProviderCalendars,
  selectCalendar:
    selectProviderCalendar,
  setSync:
    setCalendarSync,
  disconnect:
    disconnectCalendar,
};
