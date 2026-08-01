from __future__ import annotations
from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.common import ServiceMetadata
Priority=Literal["critical","high","medium","low"]
Area=Literal["appointments","customers","revenue","staff","inventory","marketing","operations"]
class Model(BaseModel): model_config=ConfigDict(extra="forbid",str_strip_whitespace=True)
class ManagementMetric(Model):
    key:str; label:str; value:float; previous_value:float|None=None; unit:str|None=None; area:Area="operations"
class ManagementIssue(Model):
    key:str; title:str; description:str; priority:Priority; area:Area; impact_value:float|None=None
class ManagementCopilotRequest(Model):
    as_of_date:date; period_label:str="Current period"; metrics:list[ManagementMetric]=Field(default_factory=list,max_length=200); issues:list[ManagementIssue]=Field(default_factory=list,max_length=100); include_action_plan:bool=True
class CopilotInsight(Model):
    insight_id:str; title:str; description:str; priority:Priority; area:Area; evidence:list[str]=Field(default_factory=list); recommended_action:str|None=None
class CopilotAction(Model):
    action_id:str; title:str; owner_role:str; priority:Priority; area:Area; rationale:str; success_measure:str
class ManagementCopilotSummary(Model):
    headline:str; health_score:float=Field(ge=0,le=100); critical_count:int=Field(ge=0); high_priority_count:int=Field(ge=0); top_priorities:list[str]=Field(default_factory=list)
class ManagementCopilotResponse(Model):
    generated_at:str; as_of_date:date; period_label:str; summary:ManagementCopilotSummary; insights:list[CopilotInsight]; action_plan:list[CopilotAction]; metadata:ServiceMetadata
