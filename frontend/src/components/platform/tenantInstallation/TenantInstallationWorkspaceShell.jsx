function displayValue(value, fallback = "Not supplied") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function modeLabel(mode) {
  return String(mode || "dry-run").toLowerCase() === "write-request"
    ? "Write request"
    : "Dry run";
}

export default function TenantInstallationWorkspaceShell({
  platformRelease,
  referenceId,
  mode = "dry-run",
  status = "review",
  verticalLabel,
  businessName,
  blockerCount = 0,
  warningCount = 0,
  children,
}) {
  const blockers = Number.isFinite(Number(blockerCount))
    ? Number(blockerCount)
    : 0;
  const warnings = Number.isFinite(Number(warningCount))
    ? Number(warningCount)
    : 0;

  return (
    <section
      className="space-y-5"
      aria-labelledby="tenant-installation-workspace-title"
    >
      <header className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
              AI Intelligent Business Platform
            </p>
            <h1
              id="tenant-installation-workspace-title"
              className="mt-1 text-xl font-bold text-black sm:text-2xl"
            >
              Tenant installation workspace
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
              Review platform-supplied installation state. This workspace does
              not create tenant authority or execute provisioning writes in the
              browser.
            </p>
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Installation state">
            <span className="inline-flex min-h-7 items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 text-xs font-bold text-amber-800">
              {modeLabel(mode)}
            </span>
            <span
              className="inline-flex min-h-7 items-center rounded-full border border-black/10 bg-stone-100 px-2.5 text-xs font-bold text-stone-700"
              aria-live="polite"
            >
              {displayValue(status, "Unknown status")}
            </span>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Platform release", platformRelease],
            ["Installation reference", referenceId],
            ["Vertical", verticalLabel],
            ["Business", businessName],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-black/10 bg-stone-50 p-3"
            >
              <dt className="text-xs font-bold uppercase tracking-wide text-stone-600">
                {label}
              </dt>
              <dd className="mt-1 break-words text-sm font-bold text-black">
                {displayValue(value)}
              </dd>
            </div>
          ))}
        </dl>

        <div
          className="mt-4 flex flex-wrap gap-2"
          aria-label="Installation review counts"
        >
          <span className="inline-flex min-h-7 items-center rounded-full border border-black/10 bg-white px-2.5 text-xs font-bold text-stone-700">
            {blockers} {blockers === 1 ? "blocker" : "blockers"}
          </span>
          <span className="inline-flex min-h-7 items-center rounded-full border border-black/10 bg-white px-2.5 text-xs font-bold text-stone-700">
            {warnings} {warnings === 1 ? "warning" : "warnings"}
          </span>
        </div>
      </header>

      {children ? <div className="space-y-5">{children}</div> : null}
    </section>
  );
}
