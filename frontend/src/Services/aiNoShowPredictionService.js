import API from "../api/axios.js";
export const DEFAULT_NO_SHOW_PARAMETERS={horizonDays:14,highRiskThreshold:.65,mediumRiskThreshold:.35,includeRecommendations:true};
export async function getAiNoShowPredictions(values={}){const response=await API.get("/ai/no-show-predictions",{params:{...DEFAULT_NO_SHOW_PARAMETERS,...values}});return response?.data||response;}
export default {getAiNoShowPredictions};
