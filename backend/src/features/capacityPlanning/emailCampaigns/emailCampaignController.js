// Compatibility exports retained for historical capacity-planning imports.
// Canonical email-campaign business logic lives in features/premium/emailCampaigns.
export {
  createCampaign,
  listCampaigns,
  scheduleCampaign,
} from "../../premium/emailCampaigns/emailCampaignController.js";
