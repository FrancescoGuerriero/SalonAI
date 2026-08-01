import EmailCampaign from "./EmailCampaign.js";

export async function listCampaigns(req, res) {
  res.json({ success: true, campaigns: await EmailCampaign.find().sort({ createdAt: -1 }).lean() });
}

export async function createCampaign(req, res) {
  res.status(201).json({ success: true, campaign: await EmailCampaign.create(req.body) });
}

export async function scheduleCampaign(req, res) {
  const campaign = await EmailCampaign.findByIdAndUpdate(
    req.params.campaignId,
    { status: "scheduled", scheduledFor: new Date(req.body.scheduledFor) },
    { new: true }
  );
  res.json({ success: true, campaign });
}
