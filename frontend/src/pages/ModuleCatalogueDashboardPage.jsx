import { useEffect, useMemo, useState } from "react";
import API from "../api/axios.js";

const UNKNOWN = "Not independently verified";
const acceptanceAxes = [
  ["entitled", "Entitled"],
  ["configured", "Configured"],
  ["providerVerified", "Provider verified"],
  ["ingestionActive", "Ingestion active"],
  ["productionAccepted", "Production accepted"],
];

function evidenceText(value) {
  return value === true ? "Verified by supplied evidence" :
    value === false ? "Not satisfied" : UNKNOWN;
}

export default function ModuleCatalogueDashboardPage() {
  const [catalogue, setCatalogue] = useState(null);
  const [tenantEvidence, setTenantEvidence] = useState(null);
  const [operationalAssessment, setOperationalAssessment] = useState(null);
  const [assessmentError, setAssessmentError] = useState("");
  const [deploymentProvenance, setDeploymentProvenance] = useState(null);
  const [backendRuntimeIdentity, setBackendRuntimeIdentity] = useState(null);
  const [fullStackSnapshot, setFullStackSnapshot] = useState(null);
  const [tenantEvidenceError, setTenantEvidenceError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [candidates, setCandidates] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    let active = true;
    API.get("/system-administration/module-catalogue/fullstack-runtime-snapshot")
      .then(({ data }) => { if (active) setFullStackSnapshot(data.snapshot); })
      .catch(() => {
        if (active) setFullStackSnapshot({ outcome: "unavailable" });
      });
    API.get("/system-administration/module-catalogue/backend-runtime-identity")
      .then(({ data }) => { if (active) setBackendRuntimeIdentity(data.runtimeIdentity); })
      .catch(() => {
        if (active) setBackendRuntimeIdentity({ outcome: "unavailable" });
      });
    API.get("/system-administration/module-catalogue/deployment-provenance")
      .then(({ data }) => { if (active) setDeploymentProvenance(data.provenance); })
      .catch(() => {
        if (active) setDeploymentProvenance({
          evidenceValidated: null,
          reason: "trusted_deployment_evidence_unavailable",
        });
      });
    API.get("/system-administration/module-catalogue/operational-acceptance")
      .then(({ data }) => {
        if (active) setOperationalAssessment(data.assessment);
      })
      .catch((cause) => {
        if (active) setAssessmentError(cause?.response?.status === 403
          ? "Business-wide module acceptance assessment requires all-location management authority."
          : "Module operational acceptance evidence is currently unavailable.");
      });
    API.get("/system-administration/module-catalogue/tenant-evidence")
      .then(({ data }) => {
        if (active) setTenantEvidence(data.evidence);
      })
      .catch((cause) => {
        if (active) setTenantEvidenceError(cause?.response?.status === 403
          ? "Tenant-wide evidence requires all-location management authority."
          : "Trusted tenant evidence is unavailable; no runtime status can be inferred.");
      });
    API.get("/system-administration/module-catalogue").then(({ data }) => {
      if (active) setCatalogue(data.catalogue);
    }).catch((cause) => {
      if (active) setError(cause?.response?.data?.message || "The module catalogue could not be loaded.");
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, []);

  const rows = useMemo(() => (catalogue?.entries || []).filter((item) => {
    if (!candidates && item.kind === "candidate") return false;
    if (category && category !== item.category) return false;
    if (priority && priority !== item.priority) return false;
    const term = query.trim().toLowerCase();
    return !term || [item.moduleId, item.displayName, item.category, item.sourceStatus,
      item.aiOpportunity].join(" ").toLowerCase().includes(term);
  }), [catalogue, category, priority, query, candidates]);

  if (busy) return <main className="p-6" role="status">Loading the module catalogue…</main>;
  if (error) return <main className="p-6"><h1 className="text-2xl font-bold">Module catalogue</h1><p role="alert">{error}</p></main>;
  if (!catalogue) return <main className="p-6" role="alert">No catalogue data was returned.</main>;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-stone-600">AIIBP / DEV1 / Governance</p>
        <h1 className="text-3xl font-bold text-stone-950">Module catalogue & status</h1>
        <p className="max-w-4xl text-sm text-stone-700">
          Read-only requirements view. Catalogue inclusion is not permission to use a module, and a merged
          source change is not evidence of production acceptance.
        </p>
      </header>
      <section aria-label="Catalogue totals" className="grid gap-3 sm:grid-cols-3">
        {[
          ["Roadmap requirements", catalogue.integrity.requirementCount],
          ["Candidate capabilities", catalogue.integrity.candidateCount],
          ["Categories", catalogue.integrity.categoryCount],
        ].map(([label, count]) => (
          <div key={label} className="rounded-xl border border-stone-300 bg-white p-4">
            <div className="text-2xl font-bold">{count}</div>
            <div className="text-sm text-stone-700">{label}</div>
          </div>
        ))}
      </section>
      <section aria-label="Filter catalogue" className="grid gap-3 rounded-xl border border-stone-300 bg-white p-4 md:grid-cols-3">
        <label className="space-y-1 text-sm font-semibold">
          <span>Search modules</span>
          <input className="w-full rounded-lg border border-stone-400 p-2" type="search"
            value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Requirement ID, module, AI opportunity" />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          <span>Category</span>
          <select className="w-full rounded-lg border border-stone-400 p-2" value={category}
            onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {catalogue.categories.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          <span>Priority</span>
          <select className="w-full rounded-lg border border-stone-400 p-2" value={priority}
            onChange={(event) => setPriority(event.target.value)}>
            <option value="">All priorities</option>
            {["P0", "P1", "P2", "P3"].map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={candidates}
            onChange={(event) => setCandidates(event.target.checked)} />
          Include proposed capability candidates
        </label>
      </section>
      <section aria-label="Full-stack runtime snapshot" className="space-y-2 rounded-xl border border-stone-300 bg-white p-4">
        <h2 className="text-lg font-bold">Observed application containers</h2>
        <p className="text-sm text-stone-700">
          Compares an operator-collected production-host snapshot with the reviewed release archive.
          A recent snapshot is not cryptographic host attestation, continuously verified health,
          tenant activation or production acceptance.
        </p>
        {fullStackSnapshot && (
          <div className="space-y-2 text-sm">
            <p><strong>Snapshot result:</strong>{" "}
              {fullStackSnapshot.snapshotEvidenceValid === true
                ? "Archived running-image and health observations agree"
                : fullStackSnapshot.snapshotEvidenceValid === false
                  ? "Snapshot rejected or mismatched" : UNKNOWN}</p>
            <p><strong>Collected:</strong> {fullStackSnapshot.snapshotCollectedAt || UNKNOWN}</p>
            <p><strong>Current live release:</strong> {UNKNOWN}</p>
            {fullStackSnapshot.services?.length > 0 && (
              <ul className="list-disc pl-5">
                {fullStackSnapshot.services.map((service) => (
                  <li key={service.service}>{service.service}: {service.state}, {service.health}, image digest matched</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
      <section aria-label="Backend runtime identity" className="space-y-2 rounded-xl border border-stone-300 bg-white p-4">
        <h2 className="text-lg font-bold">Current backend release identity</h2>
        <p className="text-sm text-stone-700">
          Compares this backend process's release tag and commit with a reviewed deployment archive.
          Even a match does not confirm the running container image, other services, tenant activation or production acceptance.
        </p>
        {backendRuntimeIdentity && (
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="font-semibold">Backend identity comparison</dt>
              <dd>{backendRuntimeIdentity.backendIdentityMatched === true
                ? "Matches archived release identity"
                : backendRuntimeIdentity.backendIdentityMatched === false
                  ? "Mismatch — investigate deployment"
                  : UNKNOWN}</dd></div>
            <div><dt className="font-semibold">Process release</dt>
              <dd>{backendRuntimeIdentity.releaseTag || UNKNOWN}</dd></div>
            <div><dt className="font-semibold">Process commit</dt>
              <dd>{backendRuntimeIdentity.commitSha?.slice(0, 12) || UNKNOWN}</dd></div>
            <div><dt className="font-semibold">Running image digests</dt><dd>{UNKNOWN}</dd></div>
            <div><dt className="font-semibold">Other service runtime</dt><dd>{UNKNOWN}</dd></div>
            <div><dt className="font-semibold">Production acceptance</dt><dd>{UNKNOWN}</dd></div>
          </dl>
        )}
      </section>
      <section aria-label="Deployment provenance" className="space-y-2 rounded-xl border border-stone-300 bg-white p-4">
        <h2 className="text-lg font-bold">Deployment provenance</h2>
        <p className="text-sm text-stone-700">
          Archived release, image-digest and smoke-test evidence, where available.
          A historical deployment record does not prove current runtime health,
          tenant activation or production acceptance.
        </p>
        {deploymentProvenance && (
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="font-semibold">Archive verification</dt>
              <dd>{deploymentProvenance.evidenceValidated === true
                ? "Deployment archive consistent" : UNKNOWN}</dd></div>
            <div><dt className="font-semibold">Release</dt>
              <dd>{deploymentProvenance.releaseTag || UNKNOWN}</dd></div>
            <div><dt className="font-semibold">Source commit</dt>
              <dd>{deploymentProvenance.sourceCommit?.slice(0, 12) || UNKNOWN}</dd></div>
            <div><dt className="font-semibold">Archived deployment time</dt>
              <dd>{deploymentProvenance.deployedAtUtc || UNKNOWN}</dd></div>
            <div><dt className="font-semibold">Current running release</dt>
              <dd>{UNKNOWN}</dd></div>
            <div><dt className="font-semibold">Production acceptance</dt>
              <dd>{UNKNOWN}</dd></div>
          </dl>
        )}
      </section>
      <section aria-label="Trusted tenant evidence" className="space-y-2 rounded-xl border border-stone-300 bg-white p-4">
        <h2 className="text-lg font-bold">Tenant composition evidence</h2>
        <p className="text-sm text-stone-700">
          Read-only persisted manifest and subscription state for the authorised business.
          These records do not verify deployment, runtime health, provider readiness or production acceptance.
        </p>
        {tenantEvidenceError && <p role="status" className="text-sm text-stone-700">{tenantEvidenceError}</p>}
        {tenantEvidence && (
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="font-semibold">Record integrity</dt><dd>{tenantEvidence.integrity}</dd></div>
            <div><dt className="font-semibold">Manifest revision</dt><dd>{tenantEvidence.manifestRevision || UNKNOWN}</dd></div>
            <div><dt className="font-semibold">Subscription revision</dt><dd>{tenantEvidence.subscriptionRevision ?? UNKNOWN}</dd></div>
            <div><dt className="font-semibold">Deployment</dt><dd>{UNKNOWN}</dd></div>
            <div><dt className="font-semibold">Runtime verification</dt><dd>{UNKNOWN}</dd></div>
            <div><dt className="font-semibold">Production acceptance</dt><dd>{UNKNOWN}</dd></div>
          </dl>
        )}
      </section>
      <section aria-label="Module acceptance overview" className="space-y-2 rounded-xl border border-stone-300 bg-white p-4">
        <h2 className="text-lg font-bold">Operational acceptance prerequisites</h2>
        <p className="text-sm text-stone-700">
          Checklist evidence is advisory and read-only. Source merges, tenant entitlements and
          healthy containers are not sufficient for module-specific production acceptance.
        </p>
        {assessmentError && <p role="status">{assessmentError}</p>}
        {operationalAssessment && (
          <div className="space-y-3 text-sm">
            <p>{operationalAssessment.assessmentCount} assessed requirements and candidates.
              No production sign-offs have been granted.</p>
            {operationalAssessment.deliveryGaps && (
              <div className="space-y-2" aria-label="Prioritised module delivery gaps">
                <p><strong>Confirmed prerequisite blockers:</strong> {operationalAssessment.deliveryGaps.totals.blocked}.
                  <strong> Entries requiring verification:</strong> {operationalAssessment.deliveryGaps.totals.verificationRequired}.
                  <strong> Capability mappings requiring review:</strong> {operationalAssessment.deliveryGaps.totals.unmapped}.
                  <strong> Taxonomy-only entries:</strong> {operationalAssessment.deliveryGaps.totals.taxonomyOnly}.
                  <strong> AI opportunities without verified tool contracts:</strong> {operationalAssessment.deliveryGaps.totals.aiEvidenceUnverified}.
                  <strong> Registered integration declarations:</strong> {operationalAssessment.deliveryGaps.totals.withDeclaredIntegrationContracts}.
                  <strong> Modules with reviewed source history:</strong> {operationalAssessment.deliveryGaps.totals.withRelatedSourceReviews}.
                  <strong> Entries with reviewed existing implementation:</strong> {operationalAssessment.deliveryGaps.totals.withReviewedImplementationSources}.
                  <strong> Entries without a reviewed implementation reference:</strong> {operationalAssessment.deliveryGaps.totals.implementationReviewNotRecorded}.</p>
                <p className="text-stone-700">
                  These are tenant-evidence assessment counts, not completed modules, deployment results or activation decisions. An unreviewed implementation reference does not mean a module is absent.
                </p>
                <ul className="grid gap-2 sm:grid-cols-4">
                  {operationalAssessment.deliveryGaps.priorities.map((group) => (
                    <li key={group.priority} className="rounded-lg border border-stone-300 p-3">
                      <strong>{group.priority}</strong>: {group.count} entries;
                      {" "}{group.blocked} with confirmed blockers;
                      {" "}{group.verificationRequired} awaiting checks
                    </li>
                  ))}
                </ul>
                <div className="space-y-2" aria-label="Module catalogue next verification queue">
                  <h3 className="font-semibold">Priority review queue</h3>
                  <p className="text-stone-700">Unmapped capabilities and confirmed tenant prerequisite blockers only; this list is not an activation or deployment schedule.</p>
                  {operationalAssessment.deliveryGaps.reviewQueue.length === 0
                    ? <p>No currently evidenced mapping or prerequisite review items.</p>
                    : <ol className="list-decimal space-y-1 pl-5">
                        {operationalAssessment.deliveryGaps.reviewQueue.map((entry) => (
                          <li key={entry.moduleId}>
                            <strong>{entry.priority} · {entry.moduleId} — {entry.displayName}</strong>:
                            {" "}{entry.nextReview.replaceAll("_", " ")}
                          </li>
                        ))}
                      </ol>}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
      <section aria-label="Module requirements" className="space-y-3">
        <p className="text-sm text-stone-700" role="status">
          Showing {rows.length} {candidates ? "requirements and candidates" : "requirements"}.
          Production verification remains unknown unless separately evidenced. Reviewed GitHub source/CI snapshots do not prove a module is complete.
        </p>
        {rows.length === 0 && <p className="rounded-xl border p-6">No entries match the filters.</p>}
        {rows.map((item) => {
          const open = item.moduleId === expanded;
          return (
            <article key={item.moduleId} className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="text-lg font-bold">{item.moduleId} — {item.displayName}</h2>
                  <p className="text-sm text-stone-700">{item.category}</p>
                  <p className="text-sm">Planning baseline: {item.sourceStatus}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-stone-400 px-2 py-1 text-xs font-semibold">{item.priority}</span>
                  <button type="button" aria-expanded={open}
                    aria-controls={`module-details-${item.moduleId}`}
                    className="rounded-lg border border-stone-500 px-3 py-2 text-sm font-semibold hover:bg-stone-100"
                    onClick={() => setExpanded(open ? null : item.moduleId)}>
                    {open ? "Hide details" : "View status"}
                  </button>
                </div>
              </div>
              {open && (
                <div id={`module-details-${item.moduleId}`} className="mt-4 space-y-4 border-t pt-4 text-sm">
                  <p><strong>AI opportunity:</strong> {item.aiOpportunity || UNKNOWN}</p>
                  <p><strong>Delivery owner:</strong> {item.owner} · <strong>Lifecycle:</strong> {item.lifecycle}</p>
                  <p><strong>Canonical capability:</strong> {item.capabilityPackKeys.join(", ") || "Unmapped / taxonomy-only"}</p>
                  {(() => {
                    const assessment = operationalAssessment?.entries?.find(
                      (entry) => entry.moduleId === item.moduleId,
                    );
                    const contract = assessment?.contractEvidence;
                    if (!contract) return null;
                    return (
                      <section className="space-y-1 rounded-lg border border-stone-300 p-3"
                        aria-label={`Declared integration contracts for ${item.moduleId}`}>
                        <h3 className="font-bold">Registered capability contracts</h3>
                        <p><strong>Registry declarations:</strong>{" "}
                          {contract.integrationContracts.join(", ") || "No integration contracts declared"}</p>
                        <p><strong>Configuration definitions:</strong>{" "}
                          {contract.configurationDefinitions.join(", ") || "None declared"}</p>
                        <p><strong>Related source reviews:</strong>{" "}
                          {contract.relatedSourceReviews.length
                            ? contract.relatedSourceReviews.map((record) => `PR #${record.prNumber}`).join(", ")
                            : "No reviewed source PR mapped"}</p>
                        <p><strong>API route and workflow acceptance:</strong> Not independently verified</p>
                        <p><strong>AI tool-contract verification:</strong> Not independently verified</p>
                        <p><strong>Provider readiness:</strong> Not independently verified</p>
                      </section>
                    );
                  })()}
                  <p><strong>Dependencies:</strong> {item.dependencies.join(", ") || "None verified"}</p>
                  <p><strong>Scope and permissions:</strong> {item.scopeClass}; {item.permissions.join(", ") || "Not verified"}</p>
                  <section aria-label={`Delivery evidence for ${item.moduleId}`} className="space-y-2">
                    <h3 className="font-bold">Verified delivery evidence</h3>
                    <p>Related source changes merged: {item.deliveryMilestones?.relatedSourceWorkMerged === true ? "Yes — partial module evidence" : UNKNOWN}</p>
                    <p>Recorded CI success: {item.deliveryMilestones?.recordedCiSuccess === true ? "Yes — on listed PR heads" : UNKNOWN}</p>
                    <p>Deployed: {evidenceText(item.deliveryMilestones?.deployed)}</p>
                    <p>Runtime verified: {evidenceText(item.deliveryMilestones?.runtimeVerified)}</p>
                    <p>Production accepted: {evidenceText(item.deliveryMilestones?.productionAccepted)}</p>
                    {item.deliveryEvidence?.length ? (
                      <ul className="list-disc space-y-2 pl-5">
                        {item.deliveryEvidence.map((record) => (
                          <li key={record.prNumber}>
                            <a className="font-semibold underline underline-offset-2"
                              href={record.sourceUrl} target="_blank" rel="noopener noreferrer">
                              PR #{record.prNumber}
                            </a>
                            {" — "}{record.description} (related source work merged)
                            <p className="text-xs text-stone-600">Review snapshot: {record.verifiedAt}</p>
                            {record.checks.length > 0 ? (
                              <p className="text-xs text-stone-700">
                                CI passed on PR head {record.checks[0].commitSha.slice(0, 8)}:
                                {" "}{record.checks.map((check) => check.name).join(", ")}
                              </p>
                            ) : <p className="text-xs text-stone-600">CI outcome not recorded in this evidence snapshot.</p>}
                          </li>
                        ))}
                      </ul>
                    ) : <p>No verified source delivery records mapped to this requirement yet.</p>}
                  </section>
                  {(() => {
                    const evidence = tenantEvidence?.entries?.find((row) => row.moduleId === item.moduleId);
                    return (
                      <p><strong>Trusted tenant composition:</strong>{" "}
                        {evidence
                          ? `Selected: ${evidence.manifestSelected ? "Yes" : "No"}; subscription grant: ${evidence.subscriptionEntitled ? "Yes" : "No"}`
                          : UNKNOWN}
                      </p>
                    );
                  })()}
                  {(() => {
                    const assessment = operationalAssessment?.entries?.find(
                      (entry) => entry.moduleId === item.moduleId,
                    );
                    if (!assessment) return <p><strong>Operational acceptance:</strong> {UNKNOWN}</p>;
                    return (
                      <section className="space-y-2" aria-label={`Acceptance prerequisites for ${item.moduleId}`}>
                        <h3 className="font-bold">Operational acceptance checklist</h3>
                        {assessment.implementationReference?.existingImplementationReview === true && (
                          <div className="space-y-1 rounded-lg border border-stone-300 p-3">
                            <h4 className="font-semibold">Existing module implementation</h4>
                            <p>Source reviewed — preserve existing behaviour; no module recreation is required.</p>
                            <p><strong>Current capabilities:</strong> {assessment.implementationReference.preservedCapability}</p>
                            <p><strong>Mounted API paths:</strong>{" "}
                              {assessment.implementationReference.apiMounts.join(", ")}</p>
                            <ul className="list-disc pl-5">
                              {assessment.implementationReference.routeSources.map((path) => (
                                <li key={path}><code>{path}</code></li>
                              ))}
                            </ul>
                            <p>Runtime and production acceptance: not independently verified.</p>
                          </div>
                        )}
                        <div className="space-y-1 rounded-lg border border-stone-300 p-3">
                          <h4 className="font-semibold">Reviewed module test sources</h4>
                          <p>Source reviewed only; per-test CI execution, tenant acceptance and deployment are not verified by these links.</p>
                          {assessment.reviewedTestSourceEvidence?.length ? (
                            <ul className="list-disc pl-5">
                              {assessment.reviewedTestSourceEvidence.map((record) => (
                                <li key={record.path}>
                                  <code>{record.path}</code> — {record.verifies}
                                </li>
                              ))}
                            </ul>
                          ) : <p>No module-specific reviewed test file is recorded yet.</p>}
                        </div>
                        {assessment.acceptanceContract && (
                          <div className="space-y-2 rounded-lg border border-stone-300 p-3">
                            <h4 className="font-semibold">Module API, tenancy and AI evidence required</h4>
                            <p>Contract: {assessment.acceptanceContract.contractType.replaceAll("_", " ")}.
                              Route inventory: not verified; production approval: not granted.</p>
                            <ul className="list-disc pl-5">
                              {assessment.acceptanceContract.verificationItems.map((item) => (
                                <li key={item}>{item.replaceAll("_", " ")}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <p>Outstanding checks: {assessment.outstandingVerification.length};
                          confirmed blockers: {assessment.confirmedBlockers.length}.
                          Production approval: not granted.</p>
                        <p><strong>Expected dependencies:</strong>{" "}
                          {assessment.expectedDependencies.join(", ") || "None registered"}
                        </p>
                        {assessment.dependencyEvidence?.length > 0 && (
                          <ul className="list-disc space-y-1 pl-5" aria-label="Dependency prerequisite evidence">
                            {assessment.dependencyEvidence.map((dependency) => (
                              <li key={dependency.capabilityKey}>
                                <strong>{dependency.capabilityKey}:</strong>{" "}
                                {dependency.state === "prerequisites_evidenced"
                                  ? "Tenant prerequisite records present; operational acceptance not verified"
                                  : dependency.state === "confirmed_prerequisite_blocker"
                                    ? "Tenant prerequisite blocked"
                                    : "Tenant prerequisite evidence not verified"}
                              </li>
                            ))}
                          </ul>
                        )}
                        <ul className="list-disc space-y-1 pl-5">
                          {assessment.checks.map((check) => (
                            <li key={check.key}>
                              <strong>{check.description}:</strong>{" "}
                              {check.status === "evidence_present" ? "Evidence present"
                                : check.status === "failed_or_missing" ? "Blocking prerequisite"
                                  : UNKNOWN}
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })()}
                  <p><strong>Provider readiness:</strong> {item.providerReadiness}</p>
                  <p><strong>Deployment:</strong> {item.deploymentStatus}; <strong>Production acceptance:</strong> {item.productionAcceptance}</p>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {acceptanceAxes.map(([key, label]) => (
                      <div key={key} className="rounded-lg bg-stone-100 p-3">
                        <dt className="font-semibold">{label}</dt>
                        <dd>{evidenceText(item.status?.[key])}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-xs text-stone-600">Evidence links are reviewed snapshots, not live GitHub status. No activation controls are provided. Production acceptance requires separate runtime evidence.</p>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
