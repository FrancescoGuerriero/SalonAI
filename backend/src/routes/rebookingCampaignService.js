// Compatibility entry retained for historical imports under backend/src/routes.
// Canonical rebooking campaign business logic lives in features/rebookingCampaigns.
export {
  calculateCampaignResults,
  cancelRebookingCampaign,
  createRebookingCampaign,
  getRebookingCampaign,
  listRebookingCampaigns,
  scheduleRebookingCampaign,
  sendRebookingCampaign,
  updateRebookingCampaign,
} from "../features/rebookingCampaigns/rebookingCampaignService.js";
