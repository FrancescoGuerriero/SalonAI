const TOOL_DEFINITIONS =
  Object.freeze({
    "business.metrics.read":
      Object.freeze({
        key:
          "business.metrics.read",
        domain:
          "business-intelligence",
        description:
          "Read governed aggregate business metrics through canonical analytics services.",
        requiredPermission:
          "ai:use",
        mutation:
          false,
        riskLevel:
          "low",
        maximumAutonomy:
          "A0",
        requiresHumanApproval:
          false,
      }),
    "service.catalogue.read":
      Object.freeze({
        key:
          "service.catalogue.read",
        domain:
          "services",
        description:
          "Read the published and bookable service catalogue without changing service state.",
        requiredPermission:
          "service:read",
        mutation:
          false,
        riskLevel:
          "low",
        maximumAutonomy:
          "A0",
        requiresHumanApproval:
          false,
      }),
    "product.catalogue.read":
      Object.freeze({
        key:
          "product.catalogue.read",
        domain:
          "commerce",
        description:
          "Read active tenant-scoped product catalogue data without exposing cost price or mutating catalogue or stock state.",
        requiredPermission:
          "inventory:read",
        mutation:
          false,
        riskLevel:
          "low",
        maximumAutonomy:
          "A0",
        requiresHumanApproval:
          false,
      }),
    "delivery.policy.read":
      Object.freeze({
        key:
          "delivery.policy.read",
        domain:
          "commerce",
        description:
          "Read the currently published tenant-scoped customer delivery policy without changing policy or order state.",
        requiredPermission:
          "ai:use",
        mutation:
          false,
        riskLevel:
          "low",
        maximumAutonomy:
          "A0",
        requiresHumanApproval:
          false,
      }),
    "returns.policy.read":
      Object.freeze({
        key:
          "returns.policy.read",
        domain:
          "commerce",
        description:
          "Read the currently published tenant-scoped customer returns policy without changing policy, refund or order state.",
        requiredPermission:
          "ai:use",
        mutation:
          false,
        riskLevel:
          "low",
        maximumAutonomy:
          "A0",
        requiresHumanApproval:
          false,
      }),
    "availability.search":
      Object.freeze({
        key:
          "availability.search",
        domain:
          "appointments",
        description:
          "Search canonical appointment availability without creating or changing a booking.",
        requiredPermission:
          "appointment:read",
        mutation:
          false,
        riskLevel:
          "low",
        maximumAutonomy:
          "A0",
        requiresHumanApproval:
          false,
      }),
    "appointment.create.propose":
      Object.freeze({
        key:
          "appointment.create.propose",
        domain:
          "appointments",
        description:
          "Prepare a structured appointment-creation proposal for authorised human review without creating an Appointment.",
        requiredPermission:
          "appointment:create",
        mutation:
          false,
        riskLevel:
          "medium",
        maximumAutonomy:
          "A1",
        requiresHumanApproval:
          true,
      }),
    "appointment.reschedule.propose":
      Object.freeze({
        key:
          "appointment.reschedule.propose",
        domain:
          "appointments",
        description:
          "Prepare a structured appointment reschedule proposal for authorised human review.",
        requiredPermission:
          "appointment:update",
        mutation:
          false,
        riskLevel:
          "medium",
        maximumAutonomy:
          "A1",
        requiresHumanApproval:
          true,
      }),
    "appointment.cancel.propose":
      Object.freeze({
        key:
          "appointment.cancel.propose",
        domain:
          "appointments",
        description:
          "Prepare a structured appointment-cancellation proposal for authorised human review without changing Appointment state.",
        requiredPermission:
          "appointment:cancel",
        mutation:
          false,
        riskLevel:
          "medium",
        maximumAutonomy:
          "A1",
        requiresHumanApproval:
          true,
      }),
    "retention.risk.read":
      Object.freeze({
        key:
          "retention.risk.read",
        domain:
          "customer-retention",
        description:
          "Read or refresh the canonical tenant-scoped customer retention-risk prediction without enrolling journeys or sending communications.",
        requiredPermission:
          "customer:read",
        mutation:
          false,
        riskLevel:
          "low",
        maximumAutonomy:
          "A0",
        requiresHumanApproval:
          false,
      }),
    "lead.score.read":
      Object.freeze({
        key:
          "lead.score.read",
        domain:
          "crm-lead",
        description:
          "Read the latest canonical LeadScore snapshot and lead conversion state without changing CRM data.",
        requiredPermission:
          "customer:read",
        mutation:
          false,
        riskLevel:
          "low",
        maximumAutonomy:
          "A0",
        requiresHumanApproval:
          false,
      }),
    "workflow.enrolment.propose":
      Object.freeze({
        key:
          "workflow.enrolment.propose",
        domain:
          "workflow",
        description:
          "Prepare a workflow-enrolment proposal for authorised human review. Approval does not automatically execute the workflow.",
        requiredPermission:
          "communications:manage",
        mutation:
          false,
        riskLevel:
          "medium",
        maximumAutonomy:
          "A1",
        requiresHumanApproval:
          true,
      }),
    "communications.campaign.draft":
      Object.freeze({
        key:
          "communications.campaign.draft",
        domain:
          "communications",
        description:
          "Prepare campaign content or configuration as a draft without publication or sending.",
        requiredPermission:
          "communications:manage",
        mutation:
          false,
        riskLevel:
          "medium",
        maximumAutonomy:
          "A1",
        requiresHumanApproval:
          true,
      }),
    "inventory.restock.propose":
      Object.freeze({
        key:
          "inventory.restock.propose",
        domain:
          "inventory",
        description:
          "Prepare a restock or purchase-order proposal without committing stock or supplier state.",
        requiredPermission:
          "inventory:manage",
        mutation:
          false,
        riskLevel:
          "medium",
        maximumAutonomy:
          "A1",
        requiresHumanApproval:
          true,
      }),
  });

export function getAiWorkforceTool(
  key
) {
  const cleanKey =
    String(
      key ||
      ""
    ).trim();

  return (
    TOOL_DEFINITIONS[
      cleanKey
    ] ||
    null
  );
}

export function listAiWorkforceTools() {
  return Object.values(
    TOOL_DEFINITIONS
  );
}

export function requireAiWorkforceTool(
  key
) {
  const tool =
    getAiWorkforceTool(
      key
    );

  if (!tool) {
    const error = new Error(
      "AI agents may call registered tools only."
    );
    error.code =
      "AI_TOOL_NOT_REGISTERED";
    error.statusCode = 403;
    throw error;
  }

  return tool;
}

export default {
  getAiWorkforceTool,
  listAiWorkforceTools,
  requireAiWorkforceTool,
};
