from datetime import datetime,timezone
from app.schemas.common import ServiceMetadata
from app.schemas.management_copilot import *
MODEL_NAME="salonai-management-copilot-rules-v1"
RULES_APPLIED=["period-change","priority-ranking","health-score","action-plan"]
WEIGHT={"critical":28,"high":16,"medium":7,"low":2}
def fmt(v,u): return f"£{v:,.2f}" if u=="GBP" else f"{v:.1f}%" if u=="percent" else f"{v:,.2f}"
def build_management_copilot_brief(payload:ManagementCopilotRequest,provider_mode="mock"):
    insights=[CopilotInsight(insight_id=f"issue-{x.key}",title=x.title,description=x.description,priority=x.priority,area=x.area,evidence=[f"Estimated impact: £{x.impact_value:,.2f}"] if x.impact_value is not None else [],recommended_action="Assign an owner, deadline and measurable resolution target.") for x in payload.issues]
    for m in payload.metrics:
        if m.previous_value is None: continue
        change=0 if m.previous_value==0 and m.value==0 else 1 if m.previous_value==0 else (m.value-m.previous_value)/abs(m.previous_value)
        if abs(change)<.08: continue
        direction="increased" if change>0 else "decreased"
        insights.append(CopilotInsight(insight_id=f"metric-{m.key}",title=f"{m.label} {direction}",description=f"{m.label} moved by {abs(change)*100:.1f}% compared with the previous period.",priority="high" if abs(change)>=.2 else "medium",area=m.area,evidence=[f"Current: {fmt(m.value,m.unit)}",f"Previous: {fmt(m.previous_value,m.unit)}"],recommended_action="Review the drivers and assign an owner."))
    insights.sort(key=lambda x:WEIGHT[x.priority],reverse=True)
    critical=sum(x.priority=="critical" for x in insights); high=sum(x.priority=="high" for x in insights)
    score=max(0,min(100,100-sum(WEIGHT[x.priority] for x in insights)))
    headline=f"{critical} critical management issue(s) require immediate action." if critical else f"{high} high-priority issue(s) should be addressed." if high else "Salon performance is stable with targeted improvement opportunities." if insights else "No material management exceptions were detected."
    actions=[CopilotAction(action_id=f"action-{i}",title=f"Address: {x.title}",owner_role="Marketing manager" if x.area=="marketing" else "Salon manager",priority=x.priority,area=x.area,rationale=x.description,success_measure="Record the corrective action and demonstrate an improved metric or closed issue.") for i,x in enumerate(insights[:8],1)] if payload.include_action_plan else []
    return ManagementCopilotResponse(generated_at=datetime.now(timezone.utc).isoformat(),as_of_date=payload.as_of_date,period_label=payload.period_label,summary=ManagementCopilotSummary(headline=headline,health_score=round(score,1),critical_count=critical,high_priority_count=high,top_priorities=[x.title for x in insights[:5]]),insights=insights,action_plan=actions,metadata=ServiceMetadata(model_name=MODEL_NAME,provider_mode=provider_mode,rules_applied=RULES_APPLIED))
build_copilot_brief=build_management_copilot_brief
