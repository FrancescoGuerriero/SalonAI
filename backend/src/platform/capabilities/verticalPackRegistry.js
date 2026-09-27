import {
  getVerticalDefinition,
  listVerticalDefinitions,
} from "../verticals/verticalRegistry.js";
import {
  capabilitySupportsVertical,
  getCapabilityPack,
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


export function validateProductRegistryIntegrity() {
  const verticals =
    listVerticalDefinitions();
  const verticalIds =
    new Set(
      verticals.map(
        ({ id }) => id
      )
    );
  const capabilities =
    listCapabilityPacks();
  const capabilityKeys =
    new Set(
      capabilities.map(
        ({ key }) => key
      )
    );

  for (
    const vertical of
      verticals
  ) {
    for (
      const capabilityKey of
        vertical.capabilities
    ) {
      if (
        !capabilityKeys.has(
          capabilityKey
        )
      ) {
        throw new Error(
          `Vertical "${vertical.id}" references unknown capability "${capabilityKey}".`
        );
      }

      const capability =
        getCapabilityPack(
          capabilityKey
        );

      if (
        capability.status ===
          "retired"
      ) {
        throw new Error(
          `Vertical "${vertical.id}" cannot default retired capability "${capabilityKey}".`
        );
      }

      if (
        !capabilitySupportsVertical(
          capabilityKey,
          vertical.id
        )
      ) {
        throw new Error(
          `Vertical "${vertical.id}" defaults capability "${capabilityKey}" that does not support it.`
        );
      }
    }
  }

  for (
    const capability of
      capabilities
  ) {
    for (
      const verticalId of
        capability.supportedVerticals
    ) {
      if (
        verticalId !== "*" &&
        !verticalIds.has(
          verticalId
        )
      ) {
        throw new Error(
          `Capability "${capability.key}" references unknown supported vertical "${verticalId}".`
        );
      }
    }

    for (
      const dependency of
        capability.dependencies
    ) {
      if (
        dependency ===
          capability.key
      ) {
        throw new Error(
          `Capability "${capability.key}" cannot depend on itself.`
        );
      }

      if (
        !capabilityKeys.has(
          dependency
        )
      ) {
        throw new Error(
          `Capability "${capability.key}" depends on unknown capability "${dependency}".`
        );
      }

      for (
        const verticalId of
          capability.supportedVerticals
      ) {
        if (
          verticalId === "*"
        ) {
          continue;
        }

        if (
          !capabilitySupportsVertical(
            dependency,
            verticalId
          )
        ) {
          throw new Error(
            `Capability "${capability.key}" supports vertical "${verticalId}" but dependency "${dependency}" does not.`
          );
        }
      }
    }

    for (
      const conflict of
        capability.conflicts
    ) {
      if (
        conflict ===
          capability.key
      ) {
        throw new Error(
          `Capability "${capability.key}" cannot conflict with itself.`
        );
      }

      if (
        !capabilityKeys.has(
          conflict
        )
      ) {
        throw new Error(
          `Capability "${capability.key}" conflicts with unknown capability "${conflict}".`
        );
      }
    }
  }

  return Object.freeze({
    verticalCount:
      verticals.length,
    capabilityCount:
      capabilities.length,
    valid:
      true,
  });
}
