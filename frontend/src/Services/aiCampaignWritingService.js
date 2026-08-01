import API from "../api/axios.js";

const AI_CAMPAIGN_COPY_ENDPOINT =
  "/future/ai/campaign-copy";

const AI_CAMPAIGN_TYPES = [
  "general",
  "promotion",
  "appointment_reminder",
  "follow_up",
  "dormant_customer",
  "birthday",
];

const AI_CAMPAIGN_CHANNELS = [
  "email",
  "sms",
  "whatsapp",
  "phone",
  "in_app",
];

const AI_CAMPAIGN_TONES = [
  {
    value: "friendly",
    label: "Friendly",
    description:
      "Warm, approachable and conversational.",
  },
  {
    value: "professional",
    label: "Professional",
    description:
      "Clear, polished and business-like.",
  },
  {
    value: "luxury",
    label: "Luxury",
    description:
      "Premium, refined and exclusive.",
  },
  {
    value: "persuasive",
    label: "Persuasive",
    description:
      "Benefit-led with a strong call to action.",
  },
  {
    value: "reassuring",
    label: "Reassuring",
    description:
      "Calm, helpful and confidence-building.",
  },
  {
    value: "concise",
    label: "Concise",
    description:
      "Direct and economical with words.",
  },
];

const CHANNEL_CHARACTER_LIMITS = {
  email: 10000,
  sms: 480,
  whatsapp: 4096,
  phone: 10000,
  in_app: 10000,
};

const CHANNEL_RECOMMENDED_LENGTHS = {
  email: 1200,
  sms: 320,
  whatsapp: 800,
  phone: 1000,
  in_app: 700,
};

function normaliseText(value) {
  return String(
    value ?? ""
  )
    .trim()
    .replace(
      /\r\n/g,
      "\n"
    );
}

function normaliseSingleLine(value) {
  return normaliseText(
    value
  ).replace(
    /\s+/g,
    " "
  );
}

function normaliseEnum(
  value,
  allowedValues,
  fallback,
  fieldName
) {
  const normalisedValue =
    normaliseSingleLine(
      value || fallback
    ).toLowerCase();

  if (
    !allowedValues.includes(
      normalisedValue
    )
  ) {
    throw new Error(
      `${fieldName} must be one of: ${allowedValues.join(
        ", "
      )}.`
    );
  }

  return normalisedValue;
}

function getCharacterLimit(
  channel
) {
  return (
    CHANNEL_CHARACTER_LIMITS[
      channel
    ] ||
    CHANNEL_CHARACTER_LIMITS.email
  );
}

function getRecommendedLength(
  channel
) {
  return (
    CHANNEL_RECOMMENDED_LENGTHS[
      channel
    ] ||
    CHANNEL_RECOMMENDED_LENGTHS.email
  );
}

function extractTemplateVariables(
  ...values
) {
  const variables =
    new Set();

  const pattern =
    /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g;

  for (
    const value of values
  ) {
    const content =
      String(
        value || ""
      );

    let match =
      pattern.exec(
        content
      );

    while (match) {
      variables.add(
        match[1]
      );

      match =
        pattern.exec(
          content
        );
    }

    pattern.lastIndex =
      0;
  }

  return Array.from(
    variables
  ).sort();
}

function parseGeneratedCopy(
  value
) {
  if (
    !value
  ) {
    return {};
  }

  if (
    typeof value ===
    "object"
  ) {
    return value;
  }

  const text =
    normaliseText(
      value
    );

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(
      text
    );
  } catch {
    return {
      message:
        text,
    };
  }
}

function unwrapGeneratedCopy(
  responseData
) {
  const payload =
    responseData?.copy ||
    responseData?.data?.copy ||
    responseData?.data ||
    responseData ||
    {};

  return parseGeneratedCopy(
    payload
  );
}

function createWritingWarnings({
  channel,
  subject,
  message,
}) {
  const warnings = [];

  const characterLimit =
    getCharacterLimit(
      channel
    );

  const recommendedLength =
    getRecommendedLength(
      channel
    );

  if (
    channel === "email" &&
    subject.length > 200
  ) {
    warnings.push({
      field: "subject",
      code:
        "SUBJECT_TOO_LONG",
      message:
        "The generated email subject exceeds 200 characters.",
    });
  }

  if (
    message.length >
    characterLimit
  ) {
    warnings.push({
      field: "message",
      code:
        "MESSAGE_TOO_LONG",
      message:
        `The generated message exceeds the ${characterLimit.toLocaleString(
          "en-GB"
        )}-character limit for this channel.`,
    });
  } else if (
    message.length >
    recommendedLength
  ) {
    warnings.push({
      field: "message",
      code:
        "MESSAGE_LONGER_THAN_RECOMMENDED",
      message:
        `The generated message is valid but longer than the recommended ${recommendedLength.toLocaleString(
          "en-GB"
        )} characters for this channel.`,
    });
  }

  if (
    channel !== "email" &&
    subject
  ) {
    warnings.push({
      field: "subject",
      code:
        "SUBJECT_NOT_SUPPORTED",
      message:
        "The selected channel does not use an email subject.",
    });
  }

  return warnings;
}

function calculateSmsSegments(
  message
) {
  const content =
    String(
      message || ""
    );

  if (!content) {
    return 0;
  }

  const containsUnicode =
    /[^\x00-\x7F]/.test(
      content
    );

  const singleSegmentLimit =
    containsUnicode
      ? 70
      : 160;

  const multipartSegmentLimit =
    containsUnicode
      ? 67
      : 153;

  if (
    content.length <=
    singleSegmentLimit
  ) {
    return 1;
  }

  return Math.ceil(
    content.length /
      multipartSegmentLimit
  );
}

function buildGenerationObjective({
  objective,
  offer,
  instruction,
  channel,
  currentSubject,
  currentMessage,
}) {
  const requirements = [];

  const cleanObjective =
    normaliseText(
      objective
    );

  const cleanOffer =
    normaliseText(
      offer
    );

  const cleanInstruction =
    normaliseText(
      instruction
    );

  if (
    cleanObjective
  ) {
    requirements.push(
      `Campaign objective: ${cleanObjective}`
    );
  }

  if (
    cleanOffer
  ) {
    requirements.push(
      `Offer or incentive: ${cleanOffer}`
    );
  }

  if (
    cleanInstruction
  ) {
    requirements.push(
      `Additional instruction: ${cleanInstruction}`
    );
  }

  if (
    currentSubject
  ) {
    requirements.push(
      `Existing subject for context: ${normaliseSingleLine(
        currentSubject
      )}`
    );
  }

  if (
    currentMessage
  ) {
    requirements.push(
      `Existing message for context: ${normaliseText(
        currentMessage
      )}`
    );
  }

  requirements.push(
    `Keep the message within ${getRecommendedLength(
      channel
    )} characters where practical.`
  );

  requirements.push(
    "Preserve all template variables exactly in double braces, for example {{firstName}} and {{salonName}}."
  );

  requirements.push(
    "Include one clear and appropriate call to action."
  );

  return requirements.join(
    "\n"
  );
}

function normaliseGenerationPayload(
  payload = {}
) {
  const campaignType =
    normaliseEnum(
      payload.campaignType,
      AI_CAMPAIGN_TYPES,
      "general",
      "Campaign type"
    );

  const channel =
    normaliseEnum(
      payload.channel,
      AI_CAMPAIGN_CHANNELS,
      "email",
      "Channel"
    );

  const tone =
    normaliseEnum(
      payload.tone,
      AI_CAMPAIGN_TONES.map(
        (option) =>
          option.value
      ),
      "friendly",
      "Tone"
    );

  const currentSubject =
    normaliseSingleLine(
      payload.currentSubject ||
        payload.subject
    );

  const currentMessage =
    normaliseText(
      payload.currentMessage ||
        payload.message ||
        payload.body
    );

  const objective =
    buildGenerationObjective({
      objective:
        payload.objective,
      offer:
        payload.offer,
      instruction:
        payload.instruction,
      channel,
      currentSubject,
      currentMessage,
    });

  return {
    campaignType,
    channel,
    tone,

    offer:
      normaliseText(
        payload.offer
      ),

    objective,

    currentSubject,
    currentMessage,

    requestedVariables:
      Array.from(
        new Set(
          [
            ...extractTemplateVariables(
              currentSubject,
              currentMessage
            ),

            ...(
              Array.isArray(
                payload.variables
              )
                ? payload.variables
                : []
            )
              .map(
                normaliseSingleLine
              )
              .filter(Boolean),
          ]
        )
      ).sort(),

    replacementMode:
      normaliseEnum(
        payload.replacementMode,
        [
          "replace",
          "append",
          "insert",
        ],
        "replace",
        "Replacement mode"
      ),
  };
}

function getAiCampaignWritingErrorMessage(
  error,
  fallbackMessage =
    "Unable to generate campaign copy."
) {
  const responseData =
    error?.response?.data ||
    error?.data ||
    {};

  if (
    typeof responseData.message ===
      "string" &&
    responseData.message.trim()
  ) {
    return responseData.message.trim();
  }

  if (
    typeof responseData.error ===
      "string" &&
    responseData.error.trim()
  ) {
    return responseData.error.trim();
  }

  if (
    Array.isArray(
      responseData.errors
    ) &&
    responseData.errors.length
  ) {
    const messages =
      responseData.errors
        .map(
          (
            item
          ) =>
            typeof item ===
            "string"
              ? item
              : item?.message ||
                item?.msg ||
                ""
        )
        .filter(Boolean);

    if (
      messages.length
    ) {
      return messages.join(
        " "
      );
    }
  }

  if (
    error?.code ===
    "ECONNABORTED"
  ) {
    return "The AI writing request timed out.";
  }

  if (
    error?.message ===
    "Network Error"
  ) {
    return "Unable to connect to the SalonAI backend.";
  }

  return (
    error?.message ||
    fallbackMessage
  );
}

async function generateAiCampaignCopy(
  payload = {}
) {
  const requestPayload =
    normaliseGenerationPayload(
      payload
    );

  try {
    const response =
      await API.post(
        AI_CAMPAIGN_COPY_ENDPOINT,
        {
          campaignType:
            requestPayload.campaignType,

          channel:
            requestPayload.channel,

          tone:
            requestPayload.tone,

          offer:
            requestPayload.offer,

          objective:
            requestPayload.objective,

          currentSubject:
            requestPayload.currentSubject,

          currentMessage:
            requestPayload.currentMessage,

          variables:
            requestPayload.requestedVariables,
        }
      );

    const generatedCopy =
      unwrapGeneratedCopy(
        response.data
      );

    const subject =
      requestPayload.channel ===
      "email"
        ? normaliseSingleLine(
            generatedCopy.subject ||
              generatedCopy.title ||
              ""
          )
        : "";

    const message =
      normaliseText(
        generatedCopy.message ||
          generatedCopy.body ||
          generatedCopy.content ||
          ""
      );

    if (!message) {
      throw new Error(
        "The AI provider returned an empty campaign message."
      );
    }

    const variables =
      extractTemplateVariables(
        subject,
        message
      );

    return {
      provider:
        normaliseSingleLine(
          generatedCopy.provider ||
            response.data?.provider ||
            "local"
        ) || "local",

      subject,
      message,
      body: message,

      variables,

      characterCount:
        message.length,

      characterLimit:
        getCharacterLimit(
          requestPayload.channel
        ),

      recommendedLength:
        getRecommendedLength(
          requestPayload.channel
        ),

      smsSegments:
        requestPayload.channel ===
        "sms"
          ? calculateSmsSegments(
              message
            )
          : null,

      warnings:
        createWritingWarnings({
          channel:
            requestPayload.channel,
          subject,
          message,
        }),

      replacementMode:
        requestPayload.replacementMode,

      request:
        requestPayload,
    };
  } catch (error) {
    const writingError =
      new Error(
        getAiCampaignWritingErrorMessage(
          error
        )
      );

    writingError.name =
      "AiCampaignWritingError";

    writingError.status =
      error?.response?.status ||
      null;

    writingError.code =
      error?.response?.data
        ?.code ||
      error?.code ||
      "AI_CAMPAIGN_WRITING_ERROR";

    writingError.details =
      error?.response?.data
        ?.details ||
      null;

    writingError.originalError =
      error;

    throw writingError;
  }
}

export {
  AI_CAMPAIGN_CHANNELS,
  AI_CAMPAIGN_COPY_ENDPOINT,
  AI_CAMPAIGN_TONES,
  AI_CAMPAIGN_TYPES,
  CHANNEL_CHARACTER_LIMITS,
  CHANNEL_RECOMMENDED_LENGTHS,
  calculateSmsSegments,
  extractTemplateVariables,
  generateAiCampaignCopy,
  getAiCampaignWritingErrorMessage,
  getCharacterLimit,
  getRecommendedLength,
};

export default {
  generateAiCampaignCopy,
  getAiCampaignWritingErrorMessage,
};