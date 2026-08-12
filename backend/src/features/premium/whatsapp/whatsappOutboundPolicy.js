const CUSTOMER_SERVICE_WINDOW_MS =
  24 * 60 * 60 * 1000;

const CONTENT_SID_PATTERN =
  /^HX[A-Za-z0-9]{32}$/;

function createPolicyError(
  message,
  {
    statusCode = 400,
    code =
      "WHATSAPP_POLICY_ERROR",
    details = null,
  } = {}
) {
  const error = new Error(message);

  error.statusCode =
    statusCode;
  error.status =
    statusCode;
  error.code = code;
  error.details = details;

  return error;
}

export function isCustomerServiceWindowOpen(
  lastInboundAt,
  now = new Date()
) {
  if (!lastInboundAt) {
    return false;
  }

  const inbound =
    new Date(lastInboundAt);

  const current =
    new Date(now);

  if (
    Number.isNaN(
      inbound.getTime()
    ) ||
    Number.isNaN(
      current.getTime()
    )
  ) {
    return false;
  }

  const elapsed =
    current.getTime() -
    inbound.getTime();

  return (
    elapsed >= 0 &&
    elapsed <=
      CUSTOMER_SERVICE_WINDOW_MS
  );
}

export function normaliseContentSid(
  value
) {
  const contentSid =
    String(value || "")
      .trim();

  if (!contentSid) {
    return "";
  }

  if (
    !CONTENT_SID_PATTERN.test(
      contentSid
    )
  ) {
    throw createPolicyError(
      "The WhatsApp Content SID is invalid.",
      {
        code:
          "WHATSAPP_CONTENT_SID_INVALID",
        details: {
          field: "contentSid",
        },
      }
    );
  }

  return contentSid;
}

export function normaliseTemplateVariables(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return {};
  }

  let source = value;

  if (
    typeof source === "string"
  ) {
    try {
      source =
        JSON.parse(source);
    } catch {
      throw createPolicyError(
        "WhatsApp template variables must contain valid JSON.",
        {
          code:
            "WHATSAPP_TEMPLATE_VARIABLES_INVALID",
          details: {
            field:
              "contentVariables",
          },
        }
      );
    }
  }

  if (
    !source ||
    typeof source !==
      "object" ||
    Array.isArray(source)
  ) {
    throw createPolicyError(
      "WhatsApp template variables must be an object.",
      {
        code:
          "WHATSAPP_TEMPLATE_VARIABLES_INVALID",
        details: {
          field:
            "contentVariables",
        },
      }
    );
  }

  return Object.fromEntries(
    Object.entries(source).map(
      ([key, item]) => [
        String(key),
        String(item ?? ""),
      ]
    )
  );
}

export function evaluateWhatsAppOutboundPolicy({
  lastInboundAt = null,
  contentSid = "",
  now = new Date(),
} = {}) {
  const templateSid =
    normaliseContentSid(
      contentSid
    );

  const serviceWindowOpen =
    isCustomerServiceWindowOpen(
      lastInboundAt,
      now
    );

  return {
    serviceWindowOpen,
    templateRequired:
      !serviceWindowOpen,
    templateSupplied:
      Boolean(templateSid),
    contentSid:
      templateSid,
    allowed:
      serviceWindowOpen ||
      Boolean(templateSid),
  };
}

export function assertWhatsAppOutboundAllowed(
  input = {}
) {
  const policy =
    evaluateWhatsAppOutboundPolicy(
      input
    );

  if (!policy.allowed) {
    throw createPolicyError(
      "A pre-approved WhatsApp template is required because the customer service window is not open.",
      {
        statusCode: 409,
        code:
          "WHATSAPP_TEMPLATE_REQUIRED",
        details: {
          serviceWindowOpen:
            false,
          field:
            "contentSid",
        },
      }
    );
  }

  return policy;
}

export {
  CONTENT_SID_PATTERN,
  CUSTOMER_SERVICE_WINDOW_MS,
};

export default {
  assertWhatsAppOutboundAllowed,
  evaluateWhatsAppOutboundPolicy,
  isCustomerServiceWindowOpen,
  normaliseContentSid,
  normaliseTemplateVariables,
};
