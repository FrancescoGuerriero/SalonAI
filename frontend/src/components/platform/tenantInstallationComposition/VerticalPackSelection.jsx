function normaliseVerticals(verticals) {
  return Array.isArray(verticals) ? verticals : [];
}

function listLabels(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => {
      if (typeof value === "string") {
        return value;
      }

      return value?.label || value?.name || value?.key || "";
    })
    .filter(Boolean);
}

function compatibilityLabel(vertical) {
  if (typeof vertical?.compatibilityLabel === "string") {
    return vertical.compatibilityLabel;
  }

  if (typeof vertical?.compatibility === "string") {
    return vertical.compatibility;
  }

  return vertical?.compatibility?.label || "Compatibility not supplied";
}

export default function VerticalPackSelection({
  verticals,
  selectedVerticalId,
  onRequestSelect,
}) {
  const values = normaliseVerticals(verticals);

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
      aria-labelledby="vertical-pack-selection-title"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
        Platform registry
      </p>
      <h2
        id="vertical-pack-selection-title"
        className="mt-1 text-lg font-bold text-black"
      >
        Select a vertical pack
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
        Options and compatibility are supplied by the platform registry. A
        browser selection requests a choice; it does not establish tenant or
        entitlement authority.
      </p>

      {values.length ? (
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {values.map((vertical, index) => {
            const id =
              vertical?.id || vertical?.verticalId || `vertical-${index + 1}`;
            const name = vertical?.displayName || vertical?.name || id;
            const selected = id === selectedVerticalId;
            const selectable = vertical?.selectable !== false;
            const terminology = listLabels(vertical?.defaultTerminology);
            const capabilities = listLabels(vertical?.defaultCapabilities);

            return (
              <li
                key={id}
                className="rounded-xl border border-black/10 bg-stone-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-black">{name}</h3>
                    {vertical?.description ? (
                      <p className="mt-1 text-sm leading-6 text-stone-600">
                        {vertical.description}
                      </p>
                    ) : null}
                  </div>

                  <span className="inline-flex min-h-7 items-center rounded-full border border-black/10 bg-white px-2.5 text-xs font-bold text-stone-700">
                    {compatibilityLabel(vertical)}
                  </span>
                </div>

                {terminology.length ? (
                  <div className="mt-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-stone-600">
                      Default terminology
                    </p>
                    <p className="mt-1 text-sm text-stone-700">
                      {terminology.join(" · ")}
                    </p>
                  </div>
                ) : null}

                {capabilities.length ? (
                  <div className="mt-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-stone-600">
                      Default capabilities
                    </p>
                    <p className="mt-1 text-sm text-stone-700">
                      {capabilities.join(" · ")}
                    </p>
                  </div>
                ) : null}

                {vertical?.warning ? (
                  <p className="mt-3 rounded-lg border border-black/10 bg-white p-3 text-xs leading-5 text-stone-700">
                    {vertical.warning}
                  </p>
                ) : null}

                <div className="mt-4">
                  {typeof onRequestSelect === "function" ? (
                    <button
                      type="button"
                      disabled={!selectable}
                      aria-pressed={selected}
                      onClick={() => onRequestSelect(id)}
                      className="min-h-11 rounded-xl border border-black bg-black px-4 py-2 text-sm font-bold text-white transition hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-200 disabled:text-stone-500"
                    >
                      {selected
                        ? "Selected vertical"
                        : "Request vertical selection"}
                    </button>
                  ) : (
                    <span className="text-sm font-bold text-black">
                      {selected ? "Selected vertical" : "Available vertical"}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-5 rounded-xl border border-black/10 bg-stone-50 p-4 text-sm text-stone-600">
          No registered vertical packs were supplied.
        </p>
      )}
    </section>
  );
}
