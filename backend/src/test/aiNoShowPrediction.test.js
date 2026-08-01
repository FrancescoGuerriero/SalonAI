import assert from "node:assert/strict";
import test from "node:test";
import { predictNoShowRisk } from "../services/aiMicroserviceClient.js";
import { buildNoShowPredictionOptions } from "../features/aiRecommendations/aiNoShowPredictionController.js";
test("missing payload",()=>assert.throws(()=>predictNoShowRisk(),e=>e.code==="NO_SHOW_PREDICTION_PAYLOAD_REQUIRED"));
test("correct endpoint",async()=>{let url;await predictNoShowRisk({appointments:[{}]},{environment:{AI_SERVICE_URL:"http://127.0.0.1:8000",AI_SERVICE_KEY:"12345678901234567890123456789012"},fetchImpl:async(u)=>{url=u;return{ok:true,status:200,headers:{get:()=>"application/json"},json:async()=>({predictions:[]})}}});assert.equal(url,"http://127.0.0.1:8000/api/v1/no-show-prediction/predict")});
test("options",()=>{const x=buildNoShowPredictionOptions({query:{horizonDays:"21",includeRecommendations:"false"}});assert.equal(x.horizonDays,21);assert.equal(x.includeRecommendations,false)});
