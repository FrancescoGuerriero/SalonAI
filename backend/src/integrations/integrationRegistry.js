import {
  getIntegrationDefinition,
  integrationCatalog,
} from "./integrationCatalog.js";

function normaliseCapabilities(capabilities = []) {
  return [...new Set(capabilities.map((value) => String(value).trim()).filter(Boolean))].sort();
}

function assertKnownCapabilities(definition, capabilities) {
  const allowed = new Set(definition.capabilities);
  const unsupported = capabilities.filter((capability) => !allowed.has(capability));

  if (unsupported.length > 0) {
    throw new Error(
      `Integration "${definition.id}" declared unsupported capabilities: ${unsupported.join(", ")}`
    );
  }
}

export class IntegrationRegistry {
  #adapters = new Map();

  register({ id, capabilities, adapter }) {
    const definition = getIntegrationDefinition(id);

    if (!definition) {
      throw new Error(`Unknown integration "${id}"`);
    }

    if (!adapter || typeof adapter !== "object") {
      throw new TypeError(`Integration "${id}" requires an adapter object`);
    }

    if (this.#adapters.has(id)) {
      throw new Error(`Integration "${id}" is already registered`);
    }

    const declaredCapabilities = normaliseCapabilities(
      capabilities ?? definition.capabilities
    );

    assertKnownCapabilities(definition, declaredCapabilities);

    this.#adapters.set(id, {
      adapter,
      capabilities: declaredCapabilities,
    });

    return this.describe(id);
  }

  has(id) {
    return this.#adapters.has(id);
  }

  getAdapter(id) {
    return this.#adapters.get(id)?.adapter || null;
  }

  describe(id) {
    const definition = getIntegrationDefinition(id);

    if (!definition) {
      return null;
    }

    const registration = this.#adapters.get(id);

    return Object.freeze({
      id: definition.id,
      provider: definition.provider,
      category: definition.category,
      implementationStatus: definition.status,
      registered: Boolean(registration),
      capabilities: Object.freeze(
        registration
          ? [...registration.capabilities]
          : [...definition.capabilities]
      ),
    });
  }

  list() {
    return integrationCatalog.map((definition) => this.describe(definition.id));
  }

  clear() {
    this.#adapters.clear();
  }
}

export const integrationRegistry = new IntegrationRegistry();
