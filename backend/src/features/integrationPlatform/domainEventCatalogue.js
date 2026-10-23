import { randomUUID } from "node:crypto";

export const DOMAIN_EVENT_CATALOGUE = Object.freeze({
  "customer.created": Object.freeze({ versions: Object.freeze(["1"]) }),
  "customer.updated": Object.freeze({ versions: Object.freeze(["1"]) }),
  "appointment.created": Object.freeze({ versions: Object.freeze(["1"]) }),
  "appointment.rescheduled": Object.freeze({ versions: Object.freeze(["1"]) }),
  "appointment.status_changed": Object.freeze({ versions: Object.freeze(["1"]) }),
  "membership.contract_created": Object.freeze({ versions: Object.freeze(["1"]) }),
  "membership.contract_updated": Object.freeze({ versions: Object.freeze(["1"]) }),
  "membership.collection_succeeded": Object.freeze({ versions: Object.freeze(["1"]) }),
  "membership.collection_failed": Object.freeze({ versions: Object.freeze(["1"]) }),
  "membership.benefit_issued": Object.freeze({ versions: Object.freeze(["1"]) }),
  "membership.benefit_redeemed": Object.freeze({ versions: Object.freeze(["1"]) }),
  "lead.captured": Object.freeze({ versions: Object.freeze(["1"]) }),
  "lead.updated": Object.freeze({ versions: Object.freeze(["1"]) }),
  "lead.scored": Object.freeze({ versions: Object.freeze(["1"]) }),
  "lead.opportunity_created": Object.freeze({ versions: Object.freeze(["1"]) }),
  "lead.converted": Object.freeze({ versions: Object.freeze(["1"]) }),
  "lead.booking_attributed": Object.freeze({ versions: Object.freeze(["1"]) }),
  "opportunity.updated": Object.freeze({ versions: Object.freeze(["1"]) }),
  "booking.abandoned": Object.freeze({ versions: Object.freeze(["1"]) }),
  "booking.recovered": Object.freeze({ versions: Object.freeze(["1"]) }),
  "order.completed": Object.freeze({ versions: Object.freeze(["1"]) }),
});

function text(value) {
  return String(value ?? "").trim();
}

export function domainEventDefinition(type, version = "1") {
  const eventType = text(type).toLowerCase();
  const eventVersion = text(version || "1");
  const definition = DOMAIN_EVENT_CATALOGUE[eventType];

  if (!definition || !definition.versions.includes(eventVersion)) {
    const error = new Error(
      `Unsupported domain event schema: ${eventType}@${eventVersion}.`
    );
    error.code = "DOMAIN_EVENT_SCHEMA_NOT_REGISTERED";
    error.statusCode = 400;
    throw error;
  }

  return Object.freeze({
    type: eventType,
    version: eventVersion,
  });
}

export function normaliseDomainEvent(input = {}) {
  const definition = domainEventDefinition(input.type, input.version);
  const businessId = text(input.businessId || input.business);

  if (!businessId) {
    const error = new Error("Domain events require business ownership.");
    error.code = "DOMAIN_EVENT_BUSINESS_REQUIRED";
    error.statusCode = 400;
    throw error;
  }

  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    const error = new Error("Domain event payload must be an object.");
    error.code = "DOMAIN_EVENT_PAYLOAD_INVALID";
    error.statusCode = 400;
    throw error;
  }

  const occurredAt = new Date(input.occurredAt || Date.now());
  if (Number.isNaN(occurredAt.getTime())) {
    const error = new Error("Domain event occurredAt is invalid.");
    error.code = "DOMAIN_EVENT_DATE_INVALID";
    error.statusCode = 400;
    throw error;
  }

  return Object.freeze({
    eventId: text(input.eventId) || randomUUID(),
    businessId,
    type: definition.type,
    version: definition.version,
    aggregateType: text(input.aggregateType).toLowerCase(),
    aggregateId: text(input.aggregateId),
    payload: Object.freeze({ ...input.payload }),
    occurredAt: occurredAt.toISOString(),
    source: text(input.source || "platform"),
    correlationId: text(input.correlationId),
    causationId: text(input.causationId),
    metadata:
      input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
        ? Object.freeze({ ...input.metadata })
        : Object.freeze({}),
  });
}

export function subscriptionMatchesEvent(subscription, event) {
  const selectors = Array.isArray(subscription?.events)
    ? subscription.events
    : [];

  return selectors.some((selector) => {
    const selectedType = text(selector?.type).toLowerCase();
    const selectedVersion = text(selector?.version || "1");
    return (
      (selectedType === "*" || selectedType === event.type) &&
      (selectedVersion === "*" || selectedVersion === event.version)
    );
  });
}

export function listDomainEventSchemas() {
  return Object.freeze(
    Object.entries(DOMAIN_EVENT_CATALOGUE).flatMap(([type, definition]) =>
      definition.versions.map((version) => Object.freeze({ type, version }))
    )
  );
}

export default Object.freeze({
  DOMAIN_EVENT_CATALOGUE,
  domainEventDefinition,
  listDomainEventSchemas,
  normaliseDomainEvent,
  subscriptionMatchesEvent,
});
