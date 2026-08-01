import * as service from "./retentionActionService.js";

export async function dormant(req, res) {
  res.json({
    items: await service.dormantCustomers(
      req.query
    ),
  });
}

export async function queueDormant(req, res) {
  res.status(201).json(
    await service.queueDormantOutreach(
      req.body
    )
  );
}

export async function queueFollowUps(req, res) {
  res.status(201).json(
    await service.queuePostAppointmentFollowUps(
      req.body
    )
  );
}
