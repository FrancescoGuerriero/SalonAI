function normaliseTerms(terms) {
  return Array.isArray(terms) ? terms : [];
}

function normaliseModules(modules) {
  return Array.isArray(modules) ? modules : [];
}

export default function BrandingTerminologyPreview({
  branding,
  terminology,
  publicModules,
}) {
  const terms = normaliseTerms(terminology);
  const modules = normaliseModules(publicModules);

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
      aria-labelledby="branding-terminology-preview-title"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
        Tenant experience
      </p>
      <h2
        id="branding-terminology-preview-title"
        className="mt-1 text-lg font-bold text-black"
      >
        Branding and terminology preview
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
        Tenant presentation may vary without changing the underlying AIIBP
        codebase. This preview only renders supplied configuration evidence.
      </p>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Public business name", branding?.publicBusinessName],
          ["Theme profile", branding?.themeProfile],
          ["Content / template pack", branding?.contentPack],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-black/10 bg-stone-50 p-3"
          >
            <dt className="text-xs font-bold uppercase tracking-wide text-stone-600">
              {label}
            </dt>
            <dd className="mt-1 break-words text-sm font-bold text-black">
              {value || "Not supplied"}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="tenant-terminology-title">
          <h3
            id="tenant-terminology-title"
            className="text-sm font-bold text-black"
          >
            Terminology
          </h3>

          {terms.length ? (
            <dl className="mt-3 space-y-2">
              {terms.map((term, index) => (
                <div
                  key={term?.key || term?.label || index}
                  className="rounded-xl border border-black/10 bg-stone-50 p-3"
                >
                  <dt className="text-xs font-bold uppercase tracking-wide text-stone-600">
                    {term?.label || term?.key || "Term"}
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-black">
                    {term?.value || "Not supplied"}
                  </dd>
                  {term?.source ? (
                    <p className="mt-1 text-xs text-stone-600">
                      Source · {term.source}
                    </p>
                  ) : null}
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-stone-600">
              No terminology overrides were supplied.
            </p>
          )}
        </section>

        <section aria-labelledby="tenant-public-modules-title">
          <h3
            id="tenant-public-modules-title"
            className="text-sm font-bold text-black"
          >
            Public navigation and modules
          </h3>

          {modules.length ? (
            <ul className="mt-3 space-y-2">
              {modules.map((module, index) => (
                <li
                  key={module?.id || module?.key || module?.label || index}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-black/10 bg-stone-50 px-3 py-2"
                >
                  <span className="text-sm font-bold text-black">
                    {module?.label || module?.name || module?.key || "Module"}
                  </span>
                  <span className="text-xs font-bold text-stone-600">
                    {module?.visible === false ? "Hidden" : "Visible"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-stone-600">
              No public module visibility evidence was supplied.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
