import * as service from "./staffService.js";

export async function setAvailability(req, res) {
  res.json(
    await service.setWeeklyAvailability(
      req.params.staffId,
      req.body
    )
  );
}

export async function week(req, res) {
  res.json({
    items: await service.weeklyAvailability(
      req.params.staffId
    ),
  });
}

export async function day(req, res) {
  res.json(
    await service.dayAvailability(
      req.params.staffId,
      req.query.date
    )
  );
}

export async function requestTimeOff(req, res) {
  res.status(201).json(
    await service.requestTimeOff(
      req.params.staffId,
      req.body
    )
  );
}

export async function updateTimeOff(req, res) {
  res.json(
    await service.updateTimeOff(
      req.params.id,
      req.body.status,
      req.user
    )
  );
}

export async function listTimeOff(req, res) {
  res.json({
    items: await service.listTimeOff(req.query),
  });
}
