import { generateNoShowPredictions } from "./aiNoShowPredictionService.js";
const number = (v) => v === undefined || v === "" ? undefined : Number(v);
const boolean = (v) => v === undefined || v === "" ? undefined : ["true","1","yes","on"].includes(String(v).toLowerCase());
export function buildNoShowPredictionOptions(req) { return { asOfDate:req.query?.asOfDate,horizonDays:number(req.query?.horizonDays),highRiskThreshold:number(req.query?.highRiskThreshold),mediumRiskThreshold:number(req.query?.mediumRiskThreshold),includeRecommendations:boolean(req.query?.includeRecommendations),requestId:req.id||req.headers?.["x-request-id"] }; }
export async function getAiNoShowPredictions(req,res) { const result=await generateNoShowPredictions(buildNoShowPredictionOptions(req)); return res.status(200).json({success:true,message:"AI no-show predictions generated successfully.",...result}); }
export default { buildNoShowPredictionOptions,getAiNoShowPredictions };
