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
