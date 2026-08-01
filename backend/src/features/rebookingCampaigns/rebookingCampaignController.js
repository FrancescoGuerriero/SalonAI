import {
  calculateCampaignResults,
  cancelRebookingCampaign,
  createRebookingCampaign,
  getRebookingCampaign,
  listRebookingCampaigns,
  scheduleRebookingCampaign,
  sendRebookingCampaign,
  updateRebookingCampaign,
} from "./rebookingCampaignService.js";

import { getRequestActor } from "../shared/analyticsUtils.js";

async function listCampaigns(request, response) {
  const result = await listRebookingCampaigns(request.query);
  return response.status(200).json({ success: true, ...result });
}

async function getCampaign(request, response) {
  const campaign = await getRebookingCampaign(request.params.campaignId);
  return response.status(200).json({ success: true, campaign });
}

async function createCampaign(request, response) {
  const campaign = await createRebookingCampaign(
    request.body,
    getRequestActor(request)
  );
  return response.status(201).json({ success: true, campaign });
}

async function updateCampaign(request, response) {
  const campaign = await updateRebookingCampaign(
    request.params.campaignId,
    request.body
  );
  return response.status(200).json({ success: true, campaign });
}

async function scheduleCampaign(request, response) {
  const campaign = await scheduleRebookingCampaign(
    request.params.campaignId,
    request.body?.scheduleAt
  );
  return response.status(200).json({ success: true, campaign });
}

async function sendCampaign(request, response) {
  const result = await sendRebookingCampaign(request.params.campaignId);
  return response.status(200).json({ success: true, ...result });
}

async function cancelCampaign(request, response) {
  const campaign = await cancelRebookingCampaign(request.params.campaignId);
  return response.status(200).json({ success: true, campaign });
}

async function getCampaignResults(request, response) {
  const results = await calculateCampaignResults(request.params.campaignId);
  return response.status(200).json({ success: true, results });
}

export {
  cancelCampaign,
  createCampaign,
  getCampaign,
  getCampaignResults,
  listCampaigns,
  scheduleCampaign,
  sendCampaign,
  updateCampaign,
};
