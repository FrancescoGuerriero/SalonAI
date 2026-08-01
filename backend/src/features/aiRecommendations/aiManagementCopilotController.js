import { generateManagementCopilot } from "./aiManagementCopilotService.js";
export async function getAiManagementCopilot(req,res){const result=await generateManagementCopilot({asOfDate:req.query?.asOfDate,periodDays:Number(req.query?.periodDays)||30,includeActionPlan:req.query?.includeActionPlan!=="false",requestId:req.id||req.headers?.["x-request-id"]});return res.status(200).json({success:true,message:"AI management brief generated successfully.",...result});}
export default { getAiManagementCopilot };
