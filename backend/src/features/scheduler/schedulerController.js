import * as service from "./schedulerService.js";
import {
  processWorkflowTick,
} from "../workflows/workflowEngineService.js";

export async function list(req, res) {
  res.json({
    items: await service.listScheduledJobs(
      req.query
    ),
  });
}

export async function process(req, res) {
  const limit = Number(req.body.limit) || 25;
  const boundedLimit = Math.min(Math.max(1, limit), 100);

  const workflows = await processWorkflowTick({
    eventLimit: boundedLimit,
    runLimit: boundedLimit,
  });

  res.json({
    items: await service.processBatch(
      boundedLimit
    ),
    workflows,
  });
}

export async function cancel(req, res) {
  res.json(
    await service.cancelScheduledJob(req.params.id)
  );
}
