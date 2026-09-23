import {
  addGroupParticipant,
  changeGroupParticipantStatus,
  changeGroupStatus,
  createGroupBooking,
  getGroupBooking,
  listGroupBookings,
  rescheduleGroupParticipant,
} from "./groupBookingService.js";

function body(request) {
  return request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? request.body
    : {};
}

export async function list(request, response) {
  const items = await listGroupBookings(request.query || {});
  return response.status(200).json({ success: true, items, total: items.length });
}

export async function getOne(request, response) {
  const groupBooking = await getGroupBooking(request.params.id);
  return response.status(200).json({ success: true, groupBooking });
}

export async function create(request, response) {
  const groupBooking = await createGroupBooking(body(request), {
    actor: request.user,
  });
  return response.status(201).json({
    success: true,
    message: "Group booking created successfully.",
    groupBooking,
  });
}

export async function addParticipant(request, response) {
  const groupBooking = await addGroupParticipant(request.params.id, body(request), {
    actor: request.user,
  });
  return response.status(201).json({
    success: true,
    message: "Group participant added successfully.",
    groupBooking,
  });
}

export async function rescheduleParticipant(request, response) {
  const result = await rescheduleGroupParticipant(
    request.params.id,
    request.params.participantId,
    body(request),
    { actor: request.user }
  );
  return response.status(200).json({
    success: true,
    message: "Group participant rescheduled successfully.",
    ...result,
  });
}

export async function participantStatus(request, response) {
  const result = await changeGroupParticipantStatus(
    request.params.id,
    request.params.participantId,
    body(request),
    { actor: request.user }
  );
  return response.status(200).json({
    success: true,
    message: "Group participant status updated successfully.",
    ...result,
  });
}

export async function groupStatus(request, response) {
  const result = await changeGroupStatus(request.params.id, body(request), {
    actor: request.user,
  });
  return response.status(result.failed > 0 && result.updated === 0 ? 422 : 200).json({
    success: result.failed === 0,
    partialSuccess: result.failed > 0 && result.updated > 0,
    message:
      result.failed === 0
        ? "Group status updated successfully."
        : `${result.updated} participant appointment(s) updated and ${result.failed} failed.`,
    ...result,
  });
}
