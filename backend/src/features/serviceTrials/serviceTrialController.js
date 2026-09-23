import {
  bookServiceTrial,
  createServiceTrial,
  getServiceTrialBooking,
  listServiceTrialBookings,
  listServiceTrials,
  recordServiceTrialConversion,
  updateServiceTrial,
} from "./serviceTrialService.js";

function body(request) {
  return request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? request.body
    : {};
}

export async function definitions(request, response) {
  const items = await listServiceTrials(request.query || {});
  return response.status(200).json({ success: true, items, total: items.length });
}

export async function createDefinition(request, response) {
  const trial = await createServiceTrial(body(request), { actor: request.user });
  return response.status(201).json({
    success: true,
    message: "Service trial created successfully.",
    trial,
  });
}

export async function updateDefinition(request, response) {
  const trial = await updateServiceTrial(request.params.id, body(request), {
    actor: request.user,
  });
  return response.status(200).json({
    success: true,
    message: "Service trial updated successfully.",
    trial,
  });
}

export async function bookings(request, response) {
  const items = await listServiceTrialBookings(request.query || {});
  return response.status(200).json({ success: true, items, total: items.length });
}

export async function getBooking(request, response) {
  const booking = await getServiceTrialBooking(request.params.id);
  return response.status(200).json({ success: true, booking });
}

export async function book(request, response) {
  const booking = await bookServiceTrial(body(request), { actor: request.user });
  return response.status(201).json({
    success: true,
    message: "Service trial booked successfully.",
    booking,
  });
}

export async function conversion(request, response) {
  const booking = await recordServiceTrialConversion(
    request.params.id,
    body(request),
    { actor: request.user }
  );
  return response.status(200).json({
    success: true,
    message: "Service trial conversion recorded successfully.",
    booking,
  });
}
