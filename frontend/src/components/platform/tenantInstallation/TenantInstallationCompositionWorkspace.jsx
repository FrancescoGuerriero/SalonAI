import BrandingTerminologyPreview from "./BrandingTerminologyPreview.jsx";
import InstallationStepper from "./InstallationStepper.jsx";
import IntegrationPlanningList from "./IntegrationPlanningList.jsx";
import LocationDomainLifecycle from "./LocationDomainLifecycle.jsx";
import TenantIdentityLocaleSummary from "./TenantIdentityLocaleSummary.jsx";
import VerticalPackSelector from "./VerticalPackSelector.jsx";

export default function TenantInstallationCompositionWorkspace({
  steps,
  currentStepId,
  onRequestStep,
  verticals,
  selectedVerticalId,
  onRequestVertical,
  tenant,
  location,
  domains,
  onRequestDomainAction,
  branding,
  terminology,
  publicModules,
  integrations,
  onRequestIntegrationAction,
}) {
  return (
    <section
      className="space-y-5"
      aria-labelledby="tenant-installation-composition-title"
    >
      <header className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
          AI Intelligent Business Platform
        </p>
        <h1
          id="tenant-installation-composition-title"
          className="mt-1 text-xl font-bold text-black sm:text-2xl"
        >
          Tenant installation composition
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
          Review platform-supplied vertical, tenant, location, branding and
          integration configuration without creating tenant-specific code
          forks or provisioning authority in the browser.
        </p>
      </header>

      <InstallationStepper
        steps={steps}
        currentStepId={currentStepId}
        onRequestStep={onRequestStep}
      />

      <VerticalPackSelector
        verticals={verticals}
        selectedVerticalId={selectedVerticalId}
        onRequestSelect={onRequestVertical}
      />

      <TenantIdentityLocaleSummary tenant={tenant} />

      <LocationDomainLifecycle
        location={location}
        domains={domains}
        onRequestAction={onRequestDomainAction}
      />

      <BrandingTerminologyPreview
        branding={branding}
        terminology={terminology}
        publicModules={publicModules}
      />

      <IntegrationPlanningList
        integrations={integrations}
        onRequestAction={onRequestIntegrationAction}
      />
    </section>
  );
}
