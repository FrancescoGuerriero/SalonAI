import * as service from "./campaignService.js";

export async function create(req, res) {
  res.status(201).json(
    await service.createCampaign(req.body, req.user)
  );
}

export async function list(req, res) {
  res.json(await service.listCampaigns(req.query));
}

export async function get(req, res) {
  res.json(await service.getCampaign(req.params.id));
}

export async function update(req, res) {
  res.json(
    await service.updateCampaign(
      req.params.id,
      req.body,
      req.user
    )
  );
}

export async function preview(req, res) {
  res.json(
    await service.previewCampaign(req.params.id)
  );
}

export async function schedule(req, res) {
  res.json(
    await service.scheduleCampaign(
      req.params.id,
      req.body.scheduledFor
    )
  );
}

export async function cancel(req, res) {
  res.json(
    await service.cancelCampaign(req.params.id)
  );
}

export async function jobs(req, res) {
  res.json(
    await service.campaignJobs(
      req.params.id,
      req.query
    )
  );
}
