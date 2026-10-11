const DOMAIN_STATE_LABELS = {
  requested: "Requested",
  pending: "Pending verification",
  "pending-verification": "Pending verification",
  active: "Active",
  disabled: "Disabled",
  blocked: "Blocked / collision",
  collision: "Blocked / collision",
  invalid: "Invalid",
  unavailable: "Unavailable",
};

function normaliseDomains(domains) {
  return Array.isArray(domains) ? domains : [];
}

function displayValue(value, fallback = "Not supplied") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export default function LocationDomainLifecycle({ location, domains, onRequestAction }) {
  const values = normaliseDomains(domains);

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
      aria-labelledby="location-domain-lifecycle-title"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
        Location and domain setup
      </p>
      <h2 id="location-domain-lifecycle-title" className="mt-1 text-lg font-bold text-black">
        Primary location and domain lifecycle
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
        Domain state is review evidence only. No DNS record is created,
        verified or activated by this presentation component.
      </p>

      <div className="mt-5 rounded-xl border border-black/10 bg-stone-50 p-4">
        <h3 className="text-sm font-bold text-black">Primary location</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Location name", location?.name],
            ["Region", location?.region || location?.city],
            ["Country", location?.country],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-bold uppercase tracking-wide text-stone-600">{label}</dt>
              <dd className="mt-1 text-sm font-bold text-black">{displayValue(value)}</dd>
            </div>
          ))}
        </dl>
        {location?.address ? (
          <p className="mt-3 text-sm leading-6 text-stone-700">{location.address}</p>
        ) : null}
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-black">Domains</h3>
        {values.length ? (
          <ul className="mt-3 space-y-3">
            {values.map((domain, index) => {
              const id = domain?.id || domain?.hostname || `domain-${index + 1}`;
              const state = String(domain?.state || "requested").toLowerCase();
              const stateLabel = DOMAIN_STATE_LABELS[state] || domain?.state || "State supplied";
              const canRequestAction =
                typeof onRequestAction === "function" &&
                domain?.actionLabel &&
                domain?.actionAllowed !== false;

              return (
                <li key={id} className="rounded-xl border border-black/10 bg-stone-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-stone-600">
                        {domain?.kind || "Domain"}
                      </p>
                      <p className="mt-1 break-all text-sm font-bold text-black">
                        {displayValue(domain?.hostname || domain?.domain)}
                      </p>
                    </div>
                    <span className="inline-flex min-h-7 items-center rounded-full border border-black/10 bg-white px-2.5 text-xs font-bold text-stone-700">
                      {stateLabel}
                    </span>
                  </div>

                  {domain?.detail || domain?.reason ? (
                    <p className="mt-3 text-xs leading-5 text-stone-600">
                      {domain.detail || domain.reason}
                    </p>
                  ) : null}

                  {canRequestAction ? (
                    <button
                      type="button"
                      onClick={() => onRequestAction(domain)}
                      className="mt-3 min-h-11 rounded-xl border border-black bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800"
                    >
                      {domain.actionLabel}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl border border-black/10 bg-stone-50 p-4 text-sm text-stone-600">
            No domain lifecycle evidence was supplied.
          </p>
        )}
      </div>
    </section>
  );
}
