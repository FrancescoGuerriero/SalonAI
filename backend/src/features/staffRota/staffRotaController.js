import * as service from "./staffRotaService.js";

export async function week(request, response) {
  const data = await service.getStaffRota(request.query);

  return response.status(200).json({
    success: true,
    data,
  });
}

export async function createShift(request, response) {
  const shift = await service.createStaffShift(
    request.body,
    request.user
  );

  return response.status(201).json({
    success: true,
    data: shift,
  });
}

export async function updateShift(request, response) {
  const shift = await service.updateStaffShift(
    request.params.shiftId,
    request.body,
    request.user
  );

  return response.status(200).json({
    success: true,
    data: shift,
  });
}

export async function deleteShift(request, response) {
  const result = await service.deleteStaffShift(
    request.params.shiftId
  );

  return response.status(200).json({
    success: true,
    data: result,
  });
}

export async function publishWeek(request, response) {
  const result = await service.publishStaffRotaWeek(
    request.body.startDate,
    request.user
  );

  return response.status(200).json({
    success: true,
    data: result,
  });
}

export async function clockIn(request, response) {
  const attendance = await service.clockInStaffShift(
    request.params.shiftId,
    request.body,
    request.user
  );

  return response.status(200).json({
    success: true,
    data: attendance,
  });
}

export async function clockOut(request, response) {
  const attendance = await service.clockOutStaffShift(
    request.params.shiftId,
    request.body,
    request.user
  );

  return response.status(200).json({
    success: true,
    data: attendance,
  });
}

export async function updateAttendance(request, response) {
  const attendance = await service.updateStaffAttendance(
    request.params.shiftId,
    request.body,
    request.user
  );

  return response.status(200).json({
    success: true,
    data: attendance,
  });
}
