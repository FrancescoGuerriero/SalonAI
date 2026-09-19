const verticalRegistry = new Map();

export const DEFAULT_VERTICAL_ID = "salon";

function cleanString(value) {
  return String(value || "").trim();
}

function normaliseDefinition(definition = {}) {
  const id = cleanString(definition.id).toLowerCase();
  const label = cleanString(definition.label);

  if (!/^[a-z][a-z0-9-]{1,39}$/.test(id)) {
    throw new TypeError(
      "Vertical id must be 2-40 lowercase letters, numbers or hyphens."
    );
  }

  if (!label) {
    throw new TypeError("Vertical label is required.");
  }

  const terminology = Object.freeze({
    business: cleanString(definition.terminology?.business || "Business"),
    staffMember: cleanString(definition.terminology?.staffMember || "Staff member"),
    service: cleanString(definition.terminology?.service || "Service"),
    booking: cleanString(definition.terminology?.booking || "Booking"),
    customer: cleanString(definition.terminology?.customer || "Customer"),
  });

  const capabilities = Object.freeze(
    [...new Set(
      (Array.isArray(definition.capabilities) ? definition.capabilities : [])
        .map((capability) => cleanString(capability))
        .filter(Boolean)
    )]
  );

  return Object.freeze({
    id,
    label,
    terminology,
    capabilities,
  });
}

export function registerVertical(definition) {
  const normalised = normaliseDefinition(definition);

  if (verticalRegistry.has(normalised.id)) {
    throw new Error(`Vertical "${normalised.id}" is already registered.`);
  }

  verticalRegistry.set(normalised.id, normalised);
  return normalised;
}

export function isRegisteredVertical(verticalId) {
  return verticalRegistry.has(
    cleanString(verticalId).toLowerCase()
  );
}

export function getVerticalDefinition(verticalId = DEFAULT_VERTICAL_ID) {
  const id = cleanString(verticalId || DEFAULT_VERTICAL_ID).toLowerCase();
  const definition = verticalRegistry.get(id);

  if (!definition) {
    const error = new Error(
      `Business type "${id || verticalId}" is not supported by this build.`
    );
    error.statusCode = 400;
    error.code = "UNSUPPORTED_BUSINESS_TYPE";
    throw error;
  }

  return definition;
}

export function listVerticalDefinitions() {
  return [...verticalRegistry.values()];
}

registerVertical({
  id: "salon",
  label: "Salon AI",
  terminology: {
    business: "Salon",
    staffMember: "Stylist",
    service: "Service",
    booking: "Appointment",
    customer: "Customer",
  },
  capabilities: [
    "appointments",
    "staff",
    "services",
    "commerce",
    "communications",
    "calendar",
    "analytics",
    "ai",
  ],
});

registerVertical({
  id: "plastic-surgery",
  label: "Plastic Surgery AI",
  terminology: {
    business: "Plastic Surgery Clinic",
    staffMember: "Practitioner",
    service: "Procedure",
    booking: "Consultation",
    customer: "Patient",
  },
  capabilities: [
    "appointments",
    "staff",
    "services",
    "communications",
    "calendar",
    "analytics",
    "ai",
  ],
});

registerVertical({
  id: "spa",
  label: "Spa AI",
  terminology: {
    business: "Spa",
    staffMember: "Therapist",
    service: "Treatment",
    booking: "Appointment",
    customer: "Client",
  },
  capabilities: [
    "appointments",
    "staff",
    "services",
    "commerce",
    "communications",
    "calendar",
    "analytics",
    "ai",
  ],
});

registerVertical({
  id: "fitness",
  label: "Fitness AI",
  terminology: {
    business: "Fitness Business",
    staffMember: "Trainer",
    service: "Session",
    booking: "Booking",
    customer: "Member",
  },
  capabilities: [
    "appointments",
    "staff",
    "services",
    "commerce",
    "communications",
    "calendar",
    "analytics",
    "ai",
  ],
});
