import assert from "node:assert/strict";
import test from "node:test";
import { generateManagementCopilotBrief } from "../services/aiMicroserviceClient.js";
test("missing payload",()=>assert.throws(()=>generateManagementCopilotBrief(),e=>e.code==="MANAGEMENT_COPILOT_PAYLOAD_REQUIRED"));
test("correct endpoint",async()=>{let url;await generateManagementCopilotBrief({metrics:[],issues:[]},{environment:{AI_SERVICE_URL:"http://127.0.0.1:8000",AI_SERVICE_KEY:"12345678901234567890123456789012"},fetchImpl:async(u)=>{url=u;return{ok:true,status:200,headers:{get:()=>"application/json"},json:async()=>({summary:{health_score:100}})}}});assert.equal(url,"http://127.0.0.1:8000/api/v1/management-copilot/brief")});
