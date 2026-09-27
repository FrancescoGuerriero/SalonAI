import {
  getVerticalDefinition,
  listVerticalDefinitions,
} from "../verticals/verticalRegistry.js";
import {
  capabilitySupportsVertical,
  listCapabilityPacks,
} from "./capabilityRegistry.js";

export function getVerticalPackDefinition(verticalId) {
  const vertical = getVerticalDefinition(verticalId);

  const defaultCapabilityPackKeys = Object.freeze(
    vertical.capabilities.filter((key) =>
      capabilitySupportsVertical(key, vertical.id)
    )
  );

  const supportedCapabilityPackKeys = Object.freeze(
    listCapabilityPacks()
      .filter(
        (capability) =>
          capability.status !== "retired" &&
          capabilitySupportsVertical(capability.key, vertical.id)
      )
      .map(({ key }) => key)
  );

  return Object.freeze({
    id: vertical.id,
    label: vertical.label,
    terminology: vertical.terminology,
    defaultCapabilityPackKeys,
    supportedCapabilityPackKeys,
  });
}

export function listVerticalPackDefinitions() {
  return listVerticalDefinitions().map(({ id }) =>
    getVerticalPackDefinition(id)
  );
}

export default getVerticalPackDefinition;
