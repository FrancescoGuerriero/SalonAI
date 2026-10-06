const INTEGRATION_STATE_LABELS = {
  "not-configured": "Not configured",
  planned: "Planned",
  connected: "Connected",
  attention: "Attention required",
  "attention-required": "Attention required",
  unavailable: "Unavailable",
};

function normaliseIntegrations(integrations) {
  return Array.isArray(integrations) ? integrations : [];
}

export default function IntegrationPlanningList({
  integrations,
  onRequestAction,
}) {
  const values = normaliseIntegrations(integrations);

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
      aria-labelledby="integration-planning-list-title"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
        Provider-neutral planning
      </p>
      <h2
        id="integration-planning-list-title"
        className="mt-1 text-lg font-bold text-black"
      >
        Integration planning
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
        Connection state and provider labels are supplied for review. Secrets,
        tokens and raw credentials are intentionally not rendered here.
      </p>

      {values.length ? (
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {values.map((integration, index) => {
            const id =
              integration?.id || integration?.key || `integration-${index + 1}`;
            const state = String(
              integration?.state || "not-configured"
            ).toLowerCase();
            const stateLabel =
              INTEGRATION_STATE_LABELS[state] ||
              integration?.state ||
              "State supplied";
            const canRequestAction =
              typeof onRequestAction === "function" &&
              integration?.actionLabel &&
              integration?.actionAllowed !== false;

            return (
              <li
                key={id}
                className="rounded-xl border border-black/10 bg-stone-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-black">
                      {integration?.label || integration?.name || id}
                    </h3>
                    {integration?.providerLabel ? (
                      <p className="mt-1 text-xs text-stone-600">
                        Provider: {integration.providerLabel}
                      </p>
                    ) : null}
                  </div>

                  <span className="inline-flex min-h-7 items-center rounded-full border border-black/10 bg-white px-2.5 text-xs font-bold text-stone-700">
                    {stateLabel}
                  </span>
                </div>

                {integration?.detail ? (
                  <p className="mt-3 text-xs leading-5 text-stone-600">
                    {integration.detail}
                  </p>
                ) : null}

                {canRequestAction ? (
                  <button
                    type="button"
                    onClick={() => onRequestAction(integration)}
                    className="mt-3 min-h-11 rounded-xl border border-black bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800"
                  >
                    {integration.actionLabel}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-5 rounded-xl border border-black/10 bg-stone-50 p-4 text-sm text-stone-600">
          No integration planning evidence was supplied.
        </p>
      )}
    </section>
  );
}
