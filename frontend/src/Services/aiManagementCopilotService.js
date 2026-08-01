import API from "../api/axios.js";
export const DEFAULT_COPILOT_PARAMETERS={periodDays:30,includeActionPlan:true};
export async function getAiManagementCopilot(values={}){const response=await API.get("/ai/management-copilot",{params:{...DEFAULT_COPILOT_PARAMETERS,...values}});return response?.data||response;}
export default {getAiManagementCopilot};
