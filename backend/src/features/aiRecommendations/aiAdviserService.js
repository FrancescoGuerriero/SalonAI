import AiInferenceLog from "../aiPlatform/AiInferenceLog.js";
import AiAgentRun from "../aiPlatform/AiAgentRun.js";
import {
  getBuiltinAiAgentDefinition,
} from "../aiPlatform/aiWorkforceBuiltinAgents.js";
import {
  evaluateAgentToolPolicy,
} from "../aiPlatform/aiWorkforcePolicy.js";
import {
  requireAiWorkforceTool,
} from "../aiPlatform/aiWorkforceToolRegistry.js";
import {
  generateText,
} from "../../providers/aiProvider.js";
import {
  buildManagementCopilotPayload,
} from "./aiManagementCopilotService.js";

const MODEL_NAME =
  "salonai-business-adviser-grounded";
const MODEL_VERSION =
  "v3-a0-1";
const AGENT_KEY =
  "business-adviser";
const TOOL_KEY =
  "business.metrics.read";

function text(value) {
  return String(
    value ?? ""
  ).trim();
}

function metricSummary(
  payload
) {
  return (
    payload.metrics || []
  ).map(
    (metric) => ({
      key: metric.key,
      version:
        metric.version ||
        "unversioned",
      label:
        metric.label,
      value:
        metric.value,
      previousValue:
        metric.previous_value,
      unit:
        metric.unit ||
        "",
      area:
        metric.area ||
        "",
      definition:
        metric.evidence ||
        null,
    })
  );
}

function fallbackAnswer({
  payload,
}) {
  const facts =
    metricSummary(
      payload
    )
      .map(
        (metric) => {
          const unit =
            metric.unit ===
            "GBP"
              ? "£"
              : "";
          const suffix =
            metric.unit ===
            "percent"
              ? "%"
              : "";
          const decimals =
            metric.unit ===
            "percent"
              ? 1
              : 0;

          return (
            `${metric.label}: ${unit}${Number(metric.value).toFixed(decimals)}${suffix}`
          );
        }
      )
      .join("; ");

  return (
    `For ${payload.period_label.toLowerCase()}, the authorised Business evidence is: ${facts}. ` +
    "This A0 Adviser response is read-only and uses tenant-scoped canonical Appointment aggregates only."
  );
}

function systemPrompt() {
  return [
    "You are the AIIBP AI Business Adviser operating at autonomy A0 Explain.",
    "Answer only from the supplied authorised tenant-scoped evidence.",
    "Do not infer or invent customers, appointments, revenue, policies, causes or data outside the supplied scope.",
    "Distinguish observed facts from possible explanations.",
    "Do not claim that you performed, prepared or approved an action.",
    "Do not provide instructions that imply access to another business or location.",
    "If evidence is insufficient, say what is missing.",
    "Keep the answer concise and operational.",
  ].join(" ");
}

function userPrompt({
  question,
  contextPath,
  payload,
}) {
  return JSON.stringify(
    {
      question,
      contextPath,
      period:
        payload.period_label,
      asOfDate:
        payload.as_of_date,
      timeBasis:
        payload.time_basis,
      metrics:
        metricSummary(
          payload
        ),
      issues:
        payload.issues || [],
      scope: {
        locationScoped:
          Boolean(
            payload.scope
              ?.locationId
          ),
        locationAccessMode:
          payload.scope
            ?.locationAccessMode,
        authorisedLocationCount:
          payload.scope
            ?.authorisedLocationCount,
      },
      evidenceLimitations: [
        "Only tenant-safe canonical Appointment aggregates are enabled in this A0 pilot.",
        "Customer, communications, inventory and other domain context are omitted until their Adviser data paths are independently tenant-safe.",
      ],
    },
    null,
    2
  );
}

export async function askSalonAiAdviser({
  question,
  contextPath = "",
  periodDays = 30,
  user,
  requestId = "",
  businessId,
  locationId = null,
  locationAccessMode = "selected",
  allowedLocationIds = [],
}) {
  const safeQuestion =
    text(question);

  if (
    safeQuestion.length < 3
  ) {
    const error =
      new Error(
        "Ask SalonAI a question of at least 3 characters."
      );
    error.statusCode = 400;
    throw error;
  }

  if (
    safeQuestion.length > 1500
  ) {
    const error =
      new Error(
        "Ask SalonAI questions must be 1500 characters or fewer."
      );
    error.statusCode = 400;
    throw error;
  }

  if (!user?._id) {
    const error =
      new Error(
        "Authenticated user identity is required for AI AgentRun provenance."
      );
    error.statusCode = 401;
    error.code =
      "AI_AGENT_ACTOR_REQUIRED";
    throw error;
  }

  const safePeriodDays =
    Math.max(
      1,
      Math.min(
        365,
        Number(
          periodDays
        ) || 30
      )
    );
  const agent =
    getBuiltinAiAgentDefinition(
      AGENT_KEY
    );
  const tool =
    requireAiWorkforceTool(
      TOOL_KEY
    );
  const policy =
    evaluateAgentToolPolicy({
      agent,
      tool,
      requestedAutonomy:
        "A0",
    });
  const startedAt =
    Date.now();

  const payload =
    await buildManagementCopilotPayload({
      periodDays:
        safePeriodDays,
      businessId,
      locationId,
      locationAccessMode,
      allowedLocationIds,
    });

  const agentRun =
    await AiAgentRun.create({
      business:
        payload.scope
          .businessId,
      ...(payload.scope
        .locationId
        ? {
            location:
              payload.scope
                .locationId,
          }
        : {}),
      agentKey:
        agent.key,
      agentVersion:
        agent.version,
      initiatedBy:
        user._id,
      requestedAutonomy:
        "A0",
      effectiveAutonomy:
        policy.effectiveAutonomy,
      modelName:
        MODEL_NAME,
      modelVersion:
        MODEL_VERSION,
      status:
        "started",
      requestId:
        text(requestId),
      toolInvocations: [
        {
          toolKey:
            tool.key,
          requiredPermission:
            tool.requiredPermission,
          riskLevel:
            tool.riskLevel,
          status:
            "completed",
          evidenceRefs: [
            "canonical:appointments:aggregate",
          ],
          completedAt:
            new Date(),
        },
      ],
      metadata: {
        contextPath:
          text(contextPath),
        aggregateOnly:
          true,
        metricDefinitions:
          metricSummary(
            payload
          ).map(
            (metric) => ({
              key:
                metric.key,
              version:
                metric.version,
            })
          ),
      },
    });

  try {
    const fallback =
      fallbackAnswer({
        payload,
      });
    const generated =
      await generateText({
        system:
          systemPrompt(),
        prompt:
          userPrompt({
            question:
              safeQuestion,
            contextPath:
              text(
                contextPath
              ),
            payload,
          }),
        fallback,
      });

    const evidence = {
      periodLabel:
        payload.period_label,
      asOfDate:
        payload.as_of_date,
      timeBasis:
        payload.time_basis,
      metrics:
        metricSummary(
          payload
        ),
      issues:
        payload.issues || [],
      tenantScope: {
        tenantScoped: true,
        locationScoped:
          Boolean(
            payload.scope
              .locationId
          ),
        locationAccessMode:
          payload.scope
            .locationAccessMode,
        authorisedLocationCount:
          payload.scope
            .authorisedLocationCount,
      },
      registeredTool:
        tool.key,
      agentRunId:
        String(
          agentRun._id
        ),
      omittedUnsafeDomains: [
        "customer-context",
        "communications-context",
        "inventory-context",
        "knowledge-retrieval",
      ],
    };

    const inference =
      await AiInferenceLog.create({
        business:
          payload.scope
            .businessId,
        ...(payload.scope
          .locationId
          ? {
              location:
                payload.scope
                  .locationId,
            }
          : {}),
        capability:
          "management-adviser",
        modelName:
          MODEL_NAME,
        modelVersion:
          MODEL_VERSION,
        entityType:
          "management_context",
        entityKey:
          text(
            contextPath
          ) ||
          "tenant-aggregate",
        latencyMs:
          Date.now() -
          startedAt,
        prediction: {
          answer:
            generated.text,
          provider:
            generated.provider,
        },
        explanation: {
          evidence,
          readOnly: true,
          autonomyLevel:
            "A0",
        },
        context: {
          requestId:
            text(
              requestId
            ),
          actorRole:
            text(
              user?.role
            ),
          actorUserId:
            user._id,
          source:
            "ai-workforce-business-adviser",
        },
      });

    await AiAgentRun.updateOne(
      {
        _id:
          agentRun._id,
      },
      {
        $set: {
          status:
            "completed",
          completedAt:
            new Date(),
          latencyMs:
            Date.now() -
            startedAt,
          "outcome.taskSuccess":
            true,
          "outcome.policyViolation":
            false,
        },
      }
    );

    return {
      adviser: {
        agentKey:
          agent.key,
        agentVersion:
          agent.version,
        autonomyLevel:
          "A0",
        modelName:
          MODEL_NAME,
        modelVersion:
          MODEL_VERSION,
        provider:
          generated.provider,
        readOnly: true,
        registeredTool:
          tool.key,
      },
      answer:
        generated.text,
      evidence,
      suggestedActions: [],
      agentRunId:
        String(
          agentRun._id
        ),
      inferenceId:
        String(
          inference._id
        ),
    };
  } catch (error) {
    await AiAgentRun.updateOne(
      {
        _id:
          agentRun._id,
      },
      {
        $set: {
          status:
            "failed",
          completedAt:
            new Date(),
          latencyMs:
            Date.now() -
            startedAt,
          "outcome.taskSuccess":
            false,
        },
      }
    ).catch(
      () => {}
    );

    throw error;
  }
}

export default {
  askSalonAiAdviser,
};
