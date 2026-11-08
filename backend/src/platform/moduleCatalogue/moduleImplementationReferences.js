/**
 * DEV1-reviewed existing module implementation entry points.
 *
 * Source observations only, not newly created modules or proof of every
 * route's operational/tenant acceptance. API paths are inspected mounts
 * from backend/src/app.js, not alternative route registrations.
 */
const REFERENCES = Object.freeze({
  "01": {
    routeSources: ["backend/src/routes/appointmentRoutes.js", "backend/src/features/appointments/appointmentManagementRoutes.js"],
    apiMounts: ["/api/appointments"],
    preservedCapability: "Existing appointments, customer booking and staff management",
  },
  "02": {
    routeSources: ["backend/src/routes/stylistRoutes.js"],
    apiMounts: ["/api/stylists"],
    preservedCapability: "Existing staff profiles, booking visibility and workforce management",
  },
  "03": {
    routeSources: ["backend/src/routes/serviceRoutes.js"],
    apiMounts: ["/api/services"],
    preservedCapability: "Existing published services and scoped management catalogue",
  },
  "04": {
    routeSources: ["backend/src/features/commerce/commerceRoutes.js"],
    apiMounts: ["/api/commerce"],
    preservedCapability: "Existing product, checkout and order functionality",
  },
  "09": {
    routeSources: [
      "backend/src/routes/communicationTemplateRoutes.js",
      "backend/src/routes/communicationCampaignRoutes.js",
      "backend/src/routes/messageDeliveryRoutes.js",
    ],
    apiMounts: ["/api/communication-templates", "/api/communication-campaigns", "/api/message-delivery"],
    preservedCapability: "Existing templates, campaigns and provider messaging",
  },
});
const frozen = (array) => Object.freeze([...array]);

export function inspectExistingModuleImplementation(moduleId) {
  const definition = REFERENCES[String(moduleId)];
  if (!definition) {
    return Object.freeze({
      sourceState: "not_reviewed_in_this_inventory",
      existingImplementationReview: null,
      routeSources: frozen([]),
      apiMounts: frozen([]),
      preservedCapability: null,
      runtimeVerified: null,
      productionAccepted: null,
      activationAuthorised: false,
    });
  }
  return Object.freeze({
    sourceState: "existing_implementation_source_reviewed",
    existingImplementationReview: true,
    routeSources: frozen(definition.routeSources),
    apiMounts: frozen(definition.apiMounts),
    preservedCapability: definition.preservedCapability,
    runtimeVerified: null,
    productionAccepted: null,
    activationAuthorised: false,
  });
}
