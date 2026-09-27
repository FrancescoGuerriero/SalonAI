import CapabilityProvenanceCard from "./CapabilityProvenanceCard.jsx";
import TenantManifestSummary from "./TenantManifestSummary.jsx";
import TenantProductActivationReview from "./TenantProductActivationReview.jsx";
import TenantProductUpgradeReview from "./TenantProductUpgradeReview.jsx";

export default function TenantProductCompositionWorkspace({
  manifest,
  verticalLabel = "",
  manifestHash = "",
  composition,
  upgradePlan = null,
  activationPlan = null,
  canRequestActivationApproval = false,
  onRequestActivationApproval,
}) {
  const capabilities = Array.isArray(composition?.capabilities)
    ? composition.capabilities
    : [];

  return (
    <section
      className="space-y-5"
      aria-labelledby="tenant-product-composition-title"
    >
      <header className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
          AI Intelligent Business Platform
        </p>
        <h1
          id="tenant-product-composition-title"
          className="mt-1 text-xl font-bold text-black sm:text-2xl"
        >
          Tenant product composition
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
          Review the authoritative tenant manifest, effective capability
          provenance, upgrade delta and activation requirements. This
          workspace does not calculate entitlement or perform activation.
        </p>
      </header>

      <TenantManifestSummary
        manifest={manifest}
        verticalLabel={verticalLabel || composition?.vertical?.label}
        manifestHash={manifestHash}
      />

      <section
        className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
        aria-labelledby="effective-capabilities-title"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
              Effective composition
            </p>
            <h2
              id="effective-capabilities-title"
              className="mt-1 text-lg font-bold text-black"
            >
              Capability provenance
            </h2>
          </div>

          <p className="text-xs font-semibold text-stone-600">
            {capabilities.length}{" "}
            {capabilities.length === 1 ? "capability" : "capabilities"}
          </p>
        </div>

        {capabilities.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {capabilities.map((capability) => (
              <CapabilityProvenanceCard
                key={capability.key}
                capability={capability}
              />
            ))}
          </div>
        ) : (
          <p
            className="mt-4 rounded-xl border border-black/10 bg-stone-50 p-4 text-sm text-stone-600"
            role="status"
          >
            No effective capability states were supplied for this tenant.
          </p>
        )}
      </section>

      {upgradePlan ? (
        <TenantProductUpgradeReview plan={upgradePlan} />
      ) : null}

      {activationPlan ? (
        <TenantProductActivationReview
          plan={activationPlan}
          canRequestApproval={canRequestActivationApproval}
          onRequestApprove={onRequestActivationApproval}
        />
      ) : null}
    </section>
  );
}
