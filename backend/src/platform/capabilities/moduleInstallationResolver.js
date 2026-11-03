import "./commercialCapabilityExtensions.js";

import {
  capabilitySupportsVertical,
  getCapabilityPack,
  listAllocatableCapabilityPacks,
} from "./capabilityRegistry.js";

function unique(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean))];
}

function dependencyClosure(selectedKeys, verticalId) {
  const resolved = new Map();
  const visiting = new Set();

  function visit(key, requestedBy = null) {
    const capability = getCapabilityPack(key);
    if (capability.status === "retired") {
      throw new Error(`Capability "${key}" is retired and cannot be installed.`);
    }
    if (!capabilitySupportsVertical(key, verticalId)) {
      throw new Error(`Capability "${key}" does not support vertical "${verticalId}".`);
    }
    if (visiting.has(key)) {
      throw new Error(`Capability dependency cycle detected at "${key}".`);
    }
    if (resolved.has(key)) return;

    visiting.add(key);
    for (const dependency of capability.dependencies) visit(dependency, key);
    visiting.delete(key);
    resolved.set(key, {
      ...capability,
      selectedDirectly: selectedKeys.includes(key),
      requestedBy,
      installationRole: capability.allocatable ? "commercial-module" : "internal-dependency",
    });
  }

  for (const key of selectedKeys) visit(key);
  return [...resolved.values()];
}

export function resolveModuleInstallationPlan({ selectedModuleKeys = [], verticalId } = {}) {
  const selected = unique(selectedModuleKeys);
  if (!selected.length) {
    return Object.freeze({
      verticalId: String(verticalId || "").trim().toLowerCase(),
      selectedModuleKeys: Object.freeze([]),
      requiredCapabilityKeys: Object.freeze([]),
      internalDependencyKeys: Object.freeze([]),
      modules: Object.freeze([]),
    });
  }

  for (const key of selected) {
    const capability = getCapabilityPack(key);
    if (!capability.allocatable) {
      throw new Error(`Capability "${key}" is internal and cannot be selected as a commercial module.`);
    }
  }

  const modules = dependencyClosure(selected, verticalId);
  const requiredCapabilityKeys = modules.map(({ key }) => key);
  const internalDependencyKeys = modules
    .filter((capability) => !selected.includes(capability.key))
    .map(({ key }) => key);

  for (const capability of modules) {
    for (const conflict of capability.conflicts || []) {
      if (requiredCapabilityKeys.includes(conflict)) {
        throw new Error(`Capability "${capability.key}" conflicts with "${conflict}".`);
      }
    }
  }

  return Object.freeze({
    verticalId: String(verticalId || "").trim().toLowerCase(),
    selectedModuleKeys: Object.freeze(selected),
    requiredCapabilityKeys: Object.freeze(requiredCapabilityKeys),
    internalDependencyKeys: Object.freeze(internalDependencyKeys),
    modules: Object.freeze(modules.map((module) => Object.freeze(module))),
  });
}

export function auditCommercialModuleInstallability(verticalId) {
  const modules = listAllocatableCapabilityPacks()
    .filter((capability) => capabilitySupportsVertical(capability.key, verticalId));

  const results = modules.map((module) => {
    try {
      const plan = resolveModuleInstallationPlan({
        selectedModuleKeys: [module.key],
        verticalId,
      });
      return Object.freeze({
        key: module.key,
        label: module.label,
        installable: true,
        requiredCapabilityKeys: plan.requiredCapabilityKeys,
        internalDependencyKeys: plan.internalDependencyKeys,
      });
    } catch (error) {
      return Object.freeze({
        key: module.key,
        label: module.label,
        installable: false,
        error: error?.message || String(error),
        requiredCapabilityKeys: Object.freeze([]),
        internalDependencyKeys: Object.freeze([]),
      });
    }
  });

  return Object.freeze({
    verticalId: String(verticalId || "").trim().toLowerCase(),
    moduleCount: results.length,
    installableCount: results.filter(({ installable }) => installable).length,
    failedCount: results.filter(({ installable }) => !installable).length,
    results: Object.freeze(results),
  });
}

export default {
  auditCommercialModuleInstallability,
  resolveModuleInstallationPlan,
};
