import * as service from "./schedulerService.js";

export async function list(req, res) {
  res.json({
    items: await service.listScheduledJobs(
      req.query
    ),
  });
}

export async function process(req, res) {
  const limit = Number(req.body.limit) || 25;

  res.json({
    items: await service.processBatch(
      Math.min(limit, 100)
    ),
  });
}

export async function cancel(req, res) {
  res.json(
    await service.cancelScheduledJob(req.params.id)
  );
}
