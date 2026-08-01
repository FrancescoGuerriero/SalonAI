from datetime import date
from app.schemas.management_copilot import ManagementCopilotRequest
from app.services.management_copilot import build_management_copilot_brief
def payload(): return {"as_of_date":date.today().isoformat(),"period_label":"Last 30 days","metrics":[{"key":"revenue","label":"Revenue","value":12000,"previous_value":10000,"unit":"GBP","area":"revenue"}],"issues":[{"key":"no-show","title":"No-show rate above target","description":"Capacity is affected.","priority":"high","area":"appointments","impact_value":450}],"include_action_plan":True}
def test_brief():
    r=build_management_copilot_brief(ManagementCopilotRequest(**payload())); assert r.insights and r.action_plan
def test_endpoint_requires_key(client): assert client.post("/api/v1/management-copilot/brief",json=payload()).status_code==401
def test_endpoint(client,auth_headers): assert client.post("/api/v1/management-copilot/brief",headers=auth_headers,json=payload()).status_code==200
