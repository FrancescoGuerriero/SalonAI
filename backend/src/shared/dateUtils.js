export function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + Number(days));
  return date;
}

export function addMinutes(value, minutes) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + Number(minutes));
  return date;
}

export function dateRange(startDate, endDate) {
  const filter = {};

  if (startDate) {
    filter.$gte = startOfDay(startDate);
  }

  if (endDate) {
    filter.$lte = endOfDay(endDate);
  }

  return Object.keys(filter).length ? filter : undefined;
}
